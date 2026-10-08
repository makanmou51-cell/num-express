import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import type {
  ChargeStatus,
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
  WebhookResult,
} from "@/lib/payments/types";

/**
 * LeekPay — agrégateur Mobile Money (Orange/Free/Expresso Money) + cartes.
 * API sur leekpay.fr, page de paiement sur leekpay.me.
 * Flux : POST /api/v1/checkout -> URL de paiement ; confirmation via webhook
 * `payment.completed`, MAIS le crédit ne se fait qu'après re-vérification
 * autoritative du statut/montant via GET /api/v1/checkout/{id} (clé secrète).
 * Doc : https://www.leekpay.me/docs
 */

// LeekPay peut renvoyer plusieurs libellés/casse selon l'endpoint → on accepte
// toutes les variantes courantes d'un paiement réussi (sinon jamais crédité).
const APPROVED_STATUSES = new Set([
  "paid", "success", "successful", "completed", "complete", "approved",
  "confirmed", "done", "accepted", "valid", "validated",
]);
const FAILED_STATUSES = new Set([
  "failed", "fail", "cancelled", "canceled", "expired", "declined",
  "refused", "rejected", "error",
]);

/**
 * Panne TRANSITOIRE du prestataire (500/429/timeout/réseau), par opposition à
 * une erreur définitive comme une signature invalide. Le webhook doit répondre
 * 5xx dans ce cas pour que LeekPay REJOUE l'appel ; un 400 lui ferait abandonner
 * définitivement la livraison et le paiement ne serait jamais crédité.
 */
export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

/**
 * Checkout inconnu de LeekPay (404). Ce n'est PAS une panne : rejouer le
 * webhook redonnera éternellement le même 404.
 *
 * Elle hérite volontairement de ProviderUnavailableError pour que tout le code
 * existant qui teste `instanceof ProviderUnavailableError` (réconciliation,
 * route du webhook) garde exactement le même comportement. Seul l'analyseur de
 * webhook la distingue, afin d'essayer un autre identifiant.
 */
export class CheckoutNotFoundError extends ProviderUnavailableError {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutNotFoundError";
  }
}

/**
 * Identifiants possibles dans un webhook LeekPay, triés du plus probable au
 * moins probable.
 *
 * Constaté sur l'API réelle : un checkout s'appelle `checkout_16425`, tandis
 * que son `transaction_id` s'appelle `LEEKPAY_V1DUOLP6IBLA_1789945202`. Seul le
 * premier est adressable sur /api/v1/checkout/{id} — d'où le tri par forme.
 */
function webhookRefCandidates(event: unknown): string[] {
  const ev = (event ?? {}) as Record<string, unknown>;
  const data = (ev.data ?? {}) as Record<string, unknown>;
  const nested = (data.checkout ?? {}) as Record<string, unknown>;

  const raw = [
    data.checkout_id,
    nested.id,
    ev.checkout_id,
    data.id,
    ev.id,
    data.transaction_id,
    ev.transaction_id,
    data.reference,
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  // Ceux qui ont la forme d'un id de checkout passent devant.
  return out.sort(
    (a, b) =>
      Number(b.startsWith("checkout_")) - Number(a.startsWith("checkout_")),
  );
}

function apiBase(): string {
  return env.payment.leekpay.baseUrl.replace(/\/+$/, "");
}

/**
 * fetch vers LeekPay avec un délai d'attente généreux (leur API de checkout
 * peut être lente). Une seule tentative — l'utilisateur peut relancer.
 */
async function leekpayFetch(
  url: string,
  opts: RequestInit,
  timeoutMs = 25000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, cache: "no-store" });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      throw new ProviderUnavailableError(
        "LeekPay met trop de temps à répondre. Réessayez.",
      );
    }
    // Panne réseau / DNS : transitoire elle aussi.
    throw new ProviderUnavailableError(
      `LeekPay injoignable: ${(e as Error)?.message ?? "erreur réseau"}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Statut autoritatif d'un checkout (source de vérité : l'API authentifiée). */
async function fetchStatus(providerRef: string): Promise<ChargeStatus> {
  const key = env.payment.leekpay.secretKey;
  if (!key) throw new Error("LEEKPAY_SECRET_KEY manquant.");
  const res = await leekpayFetch(
    `${apiBase()}/api/v1/checkout/${encodeURIComponent(providerRef)}`,
    { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } },
  );
  // 404 = cet identifiant n'est pas un checkout (souvent un id de transaction
  // au format LEEKPAY_xxx_timestamp). Distingué des vraies pannes : rejouer
  // n'y changerait rien, il faut essayer un autre identifiant.
  if (res.status === 404) {
    throw new CheckoutNotFoundError(
      `LeekPay: checkout introuvable (${providerRef})`,
    );
  }
  // 500/429/503… = panne transitoire : on la marque comme telle pour que le
  // webhook réponde 5xx et que LeekPay rejoue (au lieu d'abandonner sur un 400).
  if (!res.ok) {
    throw new ProviderUnavailableError(
      `LeekPay get checkout a échoué: ${res.status}`,
    );
  }
  const json = await res.json();
  const data = json?.data ?? json;
  // Le champ statut peut s'appeler status / state / payment_status… casse variable.
  const status = String(
    data?.status ??
      data?.state ??
      data?.payment_status ??
      data?.transaction_status ??
      "",
  )
    .trim()
    .toLowerCase();
  // Le montant peut être un nombre OU une chaîne, sous plusieurs clés.
  const amountRaw =
    data?.amount ?? data?.amount_paid ?? data?.paid_amount ?? data?.total;
  const amountNum = Number(amountRaw);
  return {
    approved: APPROVED_STATUSES.has(status),
    failed: FAILED_STATUSES.has(status),
    amountXof: Number.isFinite(amountNum) && amountNum > 0 ? amountNum : undefined,
  };
}

export const leekpayProvider: PaymentProvider = {
  name: "leekpay",

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const key = env.payment.leekpay.secretKey;
    if (!key) throw new Error("LEEKPAY_SECRET_KEY manquant.");

    const res = await leekpayFetch(`${apiBase()}/api/v1/checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: input.amountXof,
        currency: env.payment.leekpay.currency,
        description: input.description,
        return_url: input.callbackUrl,
        cancel_url: input.callbackUrl,
        webhook_url: `${env.appUrl}/api/payments/leekpay/webhook`,
        customer_email: input.customer.email,
        customer_name: input.customer.name ?? undefined,
        metadata: { reference: input.reference },
      }),
    });

    if (!res.ok) {
      // Message propre : ne pas renvoyer le HTML brut d'une erreur serveur.
      if (res.status >= 500) {
        throw new Error(
          "LeekPay est momentanément indisponible. Réessayez dans un instant.",
        );
      }
      const body = await res.text();
      throw new Error(`LeekPay checkout a échoué: ${res.status} ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const data = json?.data ?? json;
    const providerRef = String(data?.id ?? "");
    const paymentUrl: string | undefined = data?.payment_url;
    if (!providerRef || !paymentUrl) {
      throw new Error("LeekPay: réponse inattendue (id / payment_url manquant).");
    }
    return { providerRef, paymentUrl };
  },

  async parseWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<WebhookResult | null> {
    // 1) Signature avec le secret webhook DÉDIÉ (jamais la clé publique).
    const webhookSecret = env.payment.leekpay.webhookSecret;
    const signature = (headers.get("x-leekpay-signature") ?? "").trim();
    if (webhookSecret) {
      const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");
      const ok =
        signature.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      if (!ok) throw new Error("Signature LeekPay invalide.");
    }

    // 2) On NE fait PAS confiance au payload (statut/montant falsifiables) :
    //    on extrait juste l'id, puis on re-vérifie le statut ET le montant via
    //    l'API authentifiée. Si l'API est injoignable -> throw (fail-closed :
    //    LeekPay réémettra le webhook).
    const event = JSON.parse(rawBody);
    const candidates = webhookRefCandidates(event);
    if (!candidates.length) return null;

    /* On essaie chaque identifiant jusqu'à ce que LeekPay en reconnaisse un.
       Auparavant on prenait le PREMIER champ trouvé (`data.id` quand
       `checkout_id` est absent) : or `data.id` est l'id de TRANSACTION
       (LEEKPAY_xxx_timestamp), pas celui du checkout (checkout_16425). Le GET
       partait donc sur une URL inexistante, renvoyait 404, le webhook répondait
       503, LeekPay rejouait, re-404… et AUCUNE recharge n'était créditée par
       cette voie. */
    let outage: ProviderUnavailableError | null = null;
    for (const ref of candidates) {
      try {
        const authoritative = await fetchStatus(ref);
        return {
          providerRef: ref,
          approved: authoritative.approved,
          amountXof: authoritative.amountXof,
        };
      } catch (e) {
        // Mauvais identifiant : on passe au suivant.
        if (e instanceof CheckoutNotFoundError) continue;
        // Vraie panne : on la retient, mais on laisse sa chance aux autres ids.
        if (e instanceof ProviderUnavailableError) {
          outage = e;
          continue;
        }
        throw e;
      }
    }

    // Une panne a empêché de conclure : on la propage pour que LeekPay rejoue.
    if (outage) throw outage;

    /* Aucun identifiant n'existe chez LeekPay. Rejouer est inutile : on
       renvoie null (le webhook répondra 200 « ignoré ») et on journalise les
       NOMS des champs reçus — pas les valeurs — pour pouvoir corriger la liste
       des candidats si LeekPay change son format. */
    console.error(
      "[leekpay webhook] aucun checkout reconnu. champs reçus:",
      Object.keys(event?.data ?? event ?? {}).join(", "),
      "| ids testés:",
      candidates.length,
    );
    return null;
  },

  fetchChargeStatus(providerRef: string): Promise<ChargeStatus> {
    return fetchStatus(providerRef);
  },
};
