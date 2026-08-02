// Connexion / réinitialisation par PSEUDO ou EMAIL, SANS jamais exposer l'email au client
// (2026-07-16, demande explicite : version "zéro fuite" remplaçant le RPC email_for_login exposé
// à anon). Toute la résolution pseudo -> email se fait ICI, côté serveur, avec la clé service_role.
// Le RPC public.email_for_login n'est plus exécutable par anon/authenticated (voir migration
// ..._lock_email_for_login.sql) — seul service_role l'appelle, depuis cette fonction.
//
// Actions (POST JSON) :
//   { action:'login', identifier, password }        -> { access_token, refresh_token } ou { error }
//   { action:'reset', identifier, redirect_to }     -> { ok:true } (toujours, ne révèle pas l'existence)
//   { action:'magic', identifier, redirect_to }     -> { ok:true } (idem : lien de connexion sans
//                                                       mot de passe, 2026-07-22)
//
// verify_jwt = false : l'écran de connexion n'est pas authentifié. La fonction n'expose aucune
// donnée sensible : login renvoie uniquement les tokens de session de l'utilisateur qui s'authentifie
// (son propre email est déjà dans son JWT, normal), reset ne renvoie rien.
//
// 2026-08-02, bascule vers le VPS. Cette fonction fait DEUX choses qui ne vivent plus au même
// endroit :
//   * de l'AUTH (/auth/v1/token, /otp, /recover) -> reste sur Supabase, l'arbitrage est de garder
//     GoTrue dans le cloud ;
//   * de la DONNÉE (email_for_login, rate_limit_hit, rate_limit_gc) -> passe sur le VPS, où vivent
//     désormais `profiles` et `auth_rate_limit`. Continuer à les lire dans le cloud servirait une
//     copie figée à la date de la bascule, et un joueur inscrit depuis ne pourrait plus se
//     connecter par son pseudo.
// Voir le bloc AUTH_INTERNE_* plus bas pour le pourquoi du transport choisi.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

// --------------------------------------------------------------------------
// Les trois RPC dont cette fonction dépend (email_for_login, rate_limit_hit,
// rate_limit_gc) vivent sur le VPS depuis la bascule. On ne peut PAS les y
// appeler en PostgREST : la clé service_role est un JWT signé en HS256, alors
// que le PostgREST du VPS ne vérifie que de l'ES256 (JWKS public). Il répond
// 401 « No suitable key was found to decode the JWT ». Constaté le 2026-08-02
// en cassant la connexion par pseudo en production pendant deux minutes.
//
// On passe donc par trois routes dédiées de l'API des dashboards, protégées
// par un secret partagé et sans JWT du tout : bdi-infra/api/app/routes_interne.py.
//
// Tant que les deux variables ne sont pas posées, on continue d'appeler le
// cloud exactement comme avant. C'est volontaire : le code peut être déployé
// AVANT les secrets sans rien changer au comportement, et la bascule se fait
// ensuite en posant les secrets, dans un geste isolé et réversible.
// --------------------------------------------------------------------------
const INTERNE_URL = (Deno.env.get("AUTH_INTERNE_URL") || "").replace(/\/+$/, "");
const INTERNE_SECRET = Deno.env.get("AUTH_INTERNE_SECRET") || "";
const VERS_VPS = Boolean(INTERNE_URL && INTERNE_SECRET);

function interne(chemin: string, corps: unknown): Promise<Response> {
  return fetch(`${INTERNE_URL}/${chemin}`, {
    method: "POST",
    headers: { "x-auth-interne": INTERNE_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
}

function cloudRpc(nom: string, corps: unknown): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corps),
  });
}

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
    if (VERS_VPS) {
      const r = await interne("limite-debit", { cle: key, max, fenetre_secondes: windowSeconds });
      if (!r.ok) return true;
      const data = await r.json();
      return data?.autorise !== false;
    }
    const r = await cloudRpc("rate_limit_hit", {
      p_key: key, p_max: max, p_window_seconds: windowSeconds,
    });
    if (!r.ok) return true;
    const allowed = await r.json();
    return allowed !== false;
  } catch { return true; }
}

// pseudo|email -> email. Sur le VPS via /interne, sinon via le RPC email_for_login
// du cloud (grant service_role uniquement).
//
// ÉCHEC FERMÉ, contrairement au limiteur : si la source ne répond pas, on renvoie
// null, donc « invalid ». Pas de repli silencieux vers le cloud, qui servirait un
// `profiles` figé à la date de la bascule et laisserait un joueur inscrit depuis
// se voir refuser son pseudo sans que rien ne le signale. Après la bascule, un VPS
// injoignable veut de toute façon dire que le jeu entier est hors service.
async function resolveEmail(identifier: string): Promise<string | null> {
  const id = (identifier || "").trim();
  if (!id) return null;
  if (id.includes("@")) return id;
  // Aucun pseudo ne fait cette taille, et l'endpoint interne refuserait en 422 :
  // on coupe court plutôt que de journaliser une erreur pour une saisie absurde.
  if (id.length > 120) return null;
  try {
    if (VERS_VPS) {
      const r = await interne("email-pour-connexion", { identifiant: id });
      if (!r.ok) {
        // Tracé côté serveur : sans ça, un secret périmé ou une API arrêtée
        // se manifesterait uniquement par des « identifiants invalides » en
        // masse, sans le moindre indice sur la cause.
        console.error("interne_email_http", r.status, await r.text().catch(() => ""));
        return null;
      }
      const data = await r.json();
      return typeof data?.email === "string" && data.email ? data.email : null;
    }
    const r = await cloudRpc("email_for_login", { p_identifier: id });
    if (!r.ok) return null;
    const email = await r.json();
    return typeof email === "string" && email ? email : null;
  } catch (erreur) {
    console.error("interne_email_reseau", String(erreur));
    return null;
  }
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

  // Lien magique (2026-07-22) : connexion sans mot de passe par pseudo OU email. Mêmes garanties
  // que 'reset' -- résolution pseudo->email ici (l'email ne sort jamais), réponse toujours { ok }
  // pour ne pas faire de ce flux un oracle d'existence de compte, et rate-limit identique (un lien
  // magique EST un email envoyé : même surface d'abus que reset).
  // create_user:false (nom REST de shouldCreateUser côté SDK) : un lien magique sur un identifiant
  // inconnu ne doit JAMAIS inscrire quelqu'un (sinon n'importe qui crée des comptes en boucle avec
  // des emails arbitraires).
  if (action === "magic") {
    const ipOk = await rateOk(`magic:ip:${ip}`, 5, 900);       // 5 / 15 min par IP
    const idOk = await rateOk(`magic:id:${idKey}`, 3, 3600);   // 3 / heure par compte
    if (!ipOk || !idOk) return json({ ok: true });
    const email = await resolveEmail(String(body.identifier || ""));
    if (email) {
      const redirect = typeof body.redirect_to === "string" ? body.redirect_to : SUPABASE_URL;
      const r = await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`, {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ email, create_user: false }),
      }).catch(() => null);
      // La réponse au client reste volontairement générique (anti-énumération), donc un magic link
      // DÉSACTIVÉ côté Supabase échouerait en silence total. On trace donc l'échec côté serveur :
      // sans ça, un flux cassé serait indétectable. Le détail ne sort jamais vers le client.
      if (!r || !r.ok) console.error("magic_otp_failed", r ? r.status : "network", r ? await r.text().catch(() => "") : "");
    }
    return json({ ok: true }); // toujours ok, ne révèle pas l'existence du compte
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
      const purge = VERS_VPS ? interne("purge-limites", {}) : cloudRpc("rate_limit_gc", {});
      purge.catch(() => {});
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
