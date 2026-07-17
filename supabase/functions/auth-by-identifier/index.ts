// Connexion / réinitialisation par PSEUDO ou EMAIL, SANS jamais exposer l'email au client
// (2026-07-16, demande explicite : version "zéro fuite" remplaçant le RPC email_for_login exposé
// à anon). Toute la résolution pseudo -> email se fait ICI, côté serveur, avec la clé service_role.
// Le RPC public.email_for_login n'est plus exécutable par anon/authenticated (voir migration
// ..._lock_email_for_login.sql) — seul service_role l'appelle, depuis cette fonction.
//
// Actions (POST JSON) :
//   { action:'login', identifier, password }        -> { access_token, refresh_token } ou { error }
//   { action:'reset', identifier, redirect_to }     -> { ok:true } (toujours, ne révèle pas l'existence)
//
// verify_jwt = false : l'écran de connexion n'est pas authentifié. La fonction n'expose aucune
// donnée sensible : login renvoie uniquement les tokens de session de l'utilisateur qui s'authentifie
// (son propre email est déjà dans son JWT, normal), reset ne renvoie rien.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// IP client (Edge Runtime derrière proxy) : x-forwarded-for = "client, proxy1, ...".
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

// Appelle le RPC rate_limit_hit (service_role only). Renvoie true si AUTORISÉ, false si quota
// dépassé. En cas d'erreur réseau/DB on "fail-open" (true) : la sécurité du login ne dépend pas
// du limiteur, qui n'est qu'une protection anti-bruteforce best-effort.
async function rateOk(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_limit_hit`, {
      method: "POST",
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_key: key, p_max: max, p_window_seconds: windowSeconds }),
    });
    if (!r.ok) return true;
    const allowed = await r.json();
    return allowed !== false;
  } catch { return true; }
}

// pseudo|email -> email, via le RPC email_for_login (grant service_role uniquement).
async function resolveEmail(identifier: string): Promise<string | null> {
  const id = (identifier || "").trim();
  if (!id) return null;
  if (id.includes("@")) return id;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/email_for_login`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_identifier: id }),
  });
  if (!r.ok) return null;
  const email = await r.json();
  return typeof email === "string" && email ? email : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const action = body.action;
  const ip = clientIp(req);
  const idKey = String(body.identifier || "").trim().toLowerCase().slice(0, 120);

  if (action === "login") {
    // Anti-bruteforce : par IP (rafale) ET par identifiant ciblé. Message générique.
    const ipOk = await rateOk(`login:ip:${ip}`, 10, 300);        // 10 tentatives / 5 min par IP
    const idOk = await rateOk(`login:id:${idKey}`, 5, 900);      // 5 tentatives / 15 min par compte
    // 200 (pas 429) : le SDK supabase range les corps non-2xx dans `error` et non `data`,
    // or le client lit data.error — on reste donc en 200 comme la réponse "invalid".
    if (!ipOk || !idOk) return json({ error: "rate_limited" });
    const email = await resolveEmail(String(body.identifier || ""));
    // message générique : ne révèle pas si c'est le pseudo/email OU le mot de passe qui est faux
    if (!email) return json({ error: "invalid" });
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: String(body.password || "") }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) return json({ error: "invalid" });
    return json({ access_token: data.access_token, refresh_token: data.refresh_token });
  }

  if (action === "reset") {
    // Anti-abus d'envoi d'emails : par IP ET par identifiant. On reste "ok" côté réponse pour
    // ne pas révéler l'existence du compte, mais on n'envoie plus rien au-delà du quota.
    const ipOk = await rateOk(`reset:ip:${ip}`, 5, 900);         // 5 / 15 min par IP
    const idOk = await rateOk(`reset:id:${idKey}`, 3, 3600);     // 3 / heure par compte
    if (!ipOk || !idOk) return json({ ok: true });
    // purge best-effort ~1x/h : le seau horaire "gc:<h>" n'autorise qu'un seul passage par heure.
    rateOk("gc:" + Math.floor(Date.now() / 3.6e6), 1, 3600).then((first) => {
      if (!first) return;
      fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_limit_gc`, {
        method: "POST",
        headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});
    });
    const email = await resolveEmail(String(body.identifier || ""));
    if (email) {
      const redirect = typeof body.redirect_to === "string" ? body.redirect_to : SUPABASE_URL;
      // /recover envoie l'email de réinitialisation ; on ignore le résultat pour toujours répondre ok
      await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`, {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).catch(() => {});
    }
    return json({ ok: true }); // toujours ok, ne révèle pas l'existence du compte
  }

  return json({ error: "unknown_action" }, 400);
});
