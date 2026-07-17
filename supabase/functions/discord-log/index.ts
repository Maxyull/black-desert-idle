import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Relais Discord générique. Deux usages :
//   - 'general'  : log interne (anti-triche, événements) appelé fire-and-forget par le CLIENT.
//   - 'patch_fr'/'patch_en' : annonces PUBLIQUES de patch notes, postées UNIQUEMENT par le script
//     admin scripts/announce-patch-note.js (2026-07-14).
//
// Durcissement 2026-07-22 (audit sécurité issue #9, revue des edge functions Discord) :
//   1. Webhooks lus depuis des SECRETS Supabase (DISCORD_GENERAL_WEBHOOK / _PATCH_FR_ / _PATCH_EN_),
//      JAMAIS en dur dans le code (parité avec discord-cheat-log, cf. fuite issue #2). Une cible
//      dont le secret n'est pas configuré renvoie une erreur claire plutôt que de fuiter/deviner.
//   2. verify_jwt ne prouve rien ici : la clé anon est PUBLIQUE (embarquée dans le site). On ajoute
//      donc un rate-limit par IP (RPC rate_limit_hit, service_role) pour brider le spam.
//   3. Les cibles publiques patch_fr/patch_en sont verrouillées derrière un secret d'annonce
//      (header x-announce-secret == ANNOUNCE_SECRET). Tant que ANNOUNCE_SECRET n'est pas posé, la
//      cible reste ouverte (bascule progressive) ; une fois posé, tout appel patch_* sans le bon
//      secret est refusé. Le chemin 'general' (client) n'est jamais concerné par ce verrou.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANNOUNCE_SECRET = Deno.env.get("ANNOUNCE_SECRET") ?? "";

// Webhooks : uniquement depuis les secrets d'environnement. Aucune valeur en dur ici (voir §1).
const WEBHOOKS: Record<string, string> = {
  general: Deno.env.get("DISCORD_GENERAL_WEBHOOK") ?? "",
  patch_fr: Deno.env.get("DISCORD_PATCH_FR_WEBHOOK") ?? "",
  patch_en: Deno.env.get("DISCORD_PATCH_EN_WEBHOOK") ?? "",
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-announce-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

// Rate-limit best-effort via le RPC rate_limit_hit (service_role). Fail-open si indisponible.
async function rateOk(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!SERVICE_ROLE) return true;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_limit_hit`, {
      method: "POST",
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_key: key, p_max: max, p_window_seconds: windowSeconds }),
    });
    if (!r.ok) return true;
    return (await r.json()) !== false;
  } catch { return true; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json();
    const title = String(body.title || "Evenement").slice(0, 256);
    const description = String(body.description || "").slice(0, 2000);
    const color = Number.isInteger(body.color) ? body.color : 0xc9a55a;
    // target : sélectionne le webhook -- absent/inconnu retombe sur 'general' (anti-casse client).
    const targetKey = typeof body.target === "string" && body.target in WEBHOOKS ? body.target : "general";
    const isPatch = targetKey === "patch_fr" || targetKey === "patch_en";

    // Verrou des annonces publiques : refuse patch_* si un secret d'annonce est configuré et absent/faux.
    if (isPatch && ANNOUNCE_SECRET) {
      const provided = req.headers.get("x-announce-secret") || "";
      if (provided !== ANNOUNCE_SECRET) return json({ error: "forbidden_target" }, 403);
    }

    // Rate-limit par IP : plus strict pour les annonces publiques (rares) que pour le log général.
    const ip = clientIp(req);
    const ok = isPatch
      ? await rateOk(`discordlog:patch:${ip}`, 12, 3600)   // 12 / h par IP (annonces)
      : await rateOk(`discordlog:general:${ip}`, 40, 300); // 40 / 5 min par IP (log client)
    if (!ok) return json({ error: "rate_limited" }, 429);

    const webhookUrl = WEBHOOKS[targetKey];
    if (!webhookUrl) return json({ error: "webhook_not_configured", target: targetKey }, 500);

    const embed = { title, description, color, timestamp: new Date().toISOString(), footer: { text: "Velia Idle" } };
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return json({ error: "discord_failed", detail: txt }, 502);
    }
    return json({ ok: true, target: targetKey });
  } catch (e) {
    return json({ error: String(e) }, 400);
  }
});
