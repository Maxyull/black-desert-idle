import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Webhook Discord "cheat" (alertes anti-triche) -- stocke comme secret Supabase
// (DISCORD_CHEAT_WEBHOOK), jamais en dur dans le code ni cote client. Regenere le 2026-07-05
// suite a une fuite : l'ancien etait en clair dans une migration SQL publique (issue GitHub #2).
const WEBHOOK_CHEAT = Deno.env.get("DISCORD_CHEAT_WEBHOOK") ?? "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }
  if (!WEBHOOK_CHEAT) {
    return new Response(JSON.stringify({ error: "webhook_not_configured" }), { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }
  try {
    const body = await req.json();
    const title = String(body.title || "⚠️ Alerte anti-triche").slice(0, 256);
    const description = String(body.description || "").slice(0, 2000);
    const color = Number.isInteger(body.color) ? body.color : 15158332;

    const embed = {
      title,
      description,
      color,
      timestamp: new Date().toISOString(),
      footer: { text: "Velia Idle — anti-triche" },
    };

    const res = await fetch(WEBHOOK_CHEAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: "discord_failed", detail: txt }), { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }
});
