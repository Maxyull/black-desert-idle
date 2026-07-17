// Webhook PayPal -> table donations (2026-07-22).
//
// POURQUOI LA VÉRIFICATION DE SIGNATURE EST TOUT LE SUJET : cet endpoint est public (verify_jwt
// false, PayPal ne peut pas s'authentifier chez nous). Sans vérification, N'IMPORTE QUI sur
// Internet peut POSTer {"amount": 5000} et gonfler le compteur public de dons -- exactement le
// chiffre fabriqué qu'on vient de retirer de la page, mais automatisé et crédible. On délègue donc
// la vérification à PayPal lui-même (/v1/notifications/verify-webhook-signature), qui recalcule la
// signature à partir du corps BRUT reçu. Tout événement non vérifié est jeté.
//
// IDEMPOTENCE : PayPal RETENTE (timeout, 5xx). On utilise l'id de l'événement comme external_id ;
// l'index unique (source, external_id) rejette les doublons -> un don ne peut jamais être compté
// deux fois. Le rejet est un SUCCÈS fonctionnel, on répond 200 pour que PayPal arrête de retenter.
//
// MONTANT RETENU : seller_receivable_breakdown.net_amount quand il existe = ce qui ARRIVE
// réellement sur le compte, frais PayPal déduits (~3,4 % + 0,35 €). C'est ce qui finance le projet,
// donc c'est ce qu'on affiche. À défaut, on retombe sur le montant brut.
//
// Secrets attendus (Dashboard Supabase > Edge Functions > Secrets) :
//   PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_ENV ('live' ou 'sandbox')
//   DONATION_FX_TO_USD (optionnel : taux devise->USD si le compte n'est pas en USD, ex '1.08')
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
const SECRET = Deno.env.get("PAYPAL_SECRET") ?? "";
const WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID") ?? "";
const PP_BASE = (Deno.env.get("PAYPAL_ENV") ?? "live") === "sandbox"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

/** Jeton OAuth PayPal (client_credentials) -- nécessaire pour appeler l'API de vérification. */
async function paypalToken(): Promise<string | null> {
  try {
    const r = await fetch(`${PP_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${CLIENT_ID}:${SECRET}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!r.ok) { console.error("paypal_token_failed", r.status, await r.text().catch(() => "")); return null; }
    return (await r.json()).access_token ?? null;
  } catch (e) { console.error("paypal_token_error", String(e)); return null; }
}

/** Demande à PayPal de valider la signature. Le corps doit être le JSON BRUT reçu, non re-sérialisé. */
async function verifySignature(req: Request, rawBody: string, token: string): Promise<boolean> {
  const h = (n: string) => req.headers.get(n) ?? "";
  try {
    const r = await fetch(`${PP_BASE}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // webhook_event doit être l'OBJET, mais reconstruit depuis le texte brut exact reçu
      body: `{"auth_algo":"${h("paypal-auth-algo")}","cert_url":"${h("paypal-cert-url")}",` +
            `"transmission_id":"${h("paypal-transmission-id")}","transmission_sig":"${h("paypal-transmission-sig")}",` +
            `"transmission_time":"${h("paypal-transmission-time")}","webhook_id":"${WEBHOOK_ID}",` +
            `"webhook_event":${rawBody}}`,
    });
    if (!r.ok) { console.error("paypal_verify_http", r.status, await r.text().catch(() => "")); return false; }
    const v = await r.json();
    if (v.verification_status !== "SUCCESS") { console.error("paypal_verify_rejected", v.verification_status); return false; }
    return true;
  } catch (e) { console.error("paypal_verify_error", String(e)); return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!CLIENT_ID || !SECRET || !WEBHOOK_ID) {
    console.error("paypal_not_configured"); // secrets absents : on refuse plutôt que d'accepter à l'aveugle
    return json({ error: "not_configured" }, 500);
  }

  const rawBody = await req.text(); // BRUT : re-sérialiser invaliderait la signature
  const token = await paypalToken();
  if (!token) return json({ error: "auth_failed" }, 502);
  if (!await verifySignature(req, rawBody, token)) return json({ error: "invalid_signature" }, 401);

  let ev: any;
  try { ev = JSON.parse(rawBody); } catch { return json({ error: "bad_json" }, 400); }

  // On ne retient que les paiements réellement encaissés. Les autres événements (remboursements,
  // litiges, etc.) sont acquittés sans rien enregistrer -- sinon PayPal retenterait indéfiniment.
  if (ev.event_type !== "PAYMENT.CAPTURE.COMPLETED") return json({ ok: true, ignored: ev.event_type });

  const res = ev.resource ?? {};
  const net = res.seller_receivable_breakdown?.net_amount; // net = ce qui arrive vraiment (frais déduits)
  const amount = net ?? res.amount ?? {};
  const value = Number(amount.value);
  const currency = String(amount.currency_code ?? "USD").toUpperCase();
  if (!isFinite(value) || value <= 0) return json({ ok: true, ignored: "no_amount" });

  // Conversion en USD (tous les coûts du projet sont en USD). Si la devise n'est pas l'USD, il faut
  // un taux : DONATION_FX_TO_USD. Absent -> on refuse d'inventer un chiffre et on trace l'incident
  // plutôt que d'enregistrer un montant faux.
  let fx = 1;
  if (currency !== "USD") {
    fx = Number(Deno.env.get("DONATION_FX_TO_USD") ?? "");
    if (!isFinite(fx) || fx <= 0) {
      console.error("paypal_missing_fx", currency, "-> don NON enregistré, pose DONATION_FX_TO_USD");
      return json({ error: "missing_fx" }, 500); // 500 => PayPal retentera une fois le taux posé
    }
  }
  const amountUsd = Math.round(value * fx * 100) / 100;

  const donor = res.payer?.name?.given_name ?? ev.summary ?? null;
  const row = {
    source: "paypal",
    external_id: String(ev.id), // id de l'ÉVÉNEMENT : c'est lui qui est rejoué lors d'un retry
    amount_usd: amountUsd,
    amount_original: value,
    currency,
    fx_to_usd: fx,
    // is_public reste FALSE : un donateur n'a pas consenti à être affiché juste en payant.
    // Le pseudo est stocké en note, à toi de basculer is_public si la personne le demande.
    is_public: false,
    donor_label: null,
    note: donor ? `PayPal (${donor})` : "PayPal",
    received_at: res.create_time ?? ev.create_time ?? new Date().toISOString(),
  };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/donations`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    // 23505 = violation d'unicité = PayPal a rejoué un événement déjà enregistré. C'est le
    // comportement ATTENDU : on répond 200 pour qu'il cesse de retenter.
    if (txt.includes("23505") || r.status === 409) return json({ ok: true, duplicate: true });
    console.error("donation_insert_failed", r.status, txt);
    return json({ error: "insert_failed" }, 500);
  }
  return json({ ok: true });
});
