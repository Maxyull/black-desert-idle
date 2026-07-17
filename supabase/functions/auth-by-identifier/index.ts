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

  if (action === "login") {
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
