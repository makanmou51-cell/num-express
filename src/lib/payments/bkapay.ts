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
 * BKApay — agrégateur Mobile Money ouest-africain (MTN, Moov…), basé au Bénin.
 * Doc : https://bkapay.com/documentation/sessions/v1.6
 *
 * On utilise les « Sessions de paiement sécurisées » (v1.6) : le serveur crée
 * une session avec le montant VERROUILLÉ côté BKApay (le client ne peut pas le
 * modifier dans l'URL), puis on redirige le client vers `payment_url`.
 *
 * Flux :
 *   POST /api/v1/payment-sessions            -> { session_id, payment_url }
 *   GET  /api/v1/payment-sessions/:id/status -> { status, transactionId }
 *   Webhook POST signé HMAC-SHA256 (en-tête X-BKApay-Signature) sur l'URL
 *   `callback_url`, événements payment.completed / failed / expired.
 *
 * Authentification : en-tête `Authorization: Bearer sk_payin_live_…` (clé
 * privée payin, jamais exposée au frontend).
 */

// Valeurs de statut d'une session (endpoint de statut ET webhook). On accepte
// quelques synonymes par prudence, mais BKApay documente : completed | pending
// | failed | expired.
const APPROVED = new Set(["completed", "paid", "success", "successful"]);
const FAILED = new Set([
  "failed",
  "expired",
  "cancelled",
  "canceled",
  "declined",
  "rejected",
]);

/**
 * Panne TRANSITOIRE de BKApay (500/429/timeout/réseau), par opposition à une
 * erreur DÉFINITIVE (signature invalide). Le webhook doit répondre 5xx dans ce
 * cas pour que BKApay REJOUE l'appel — leur doc : il relance toutes les 30 min
 * pendant 24 h tant que le serveur n'a pas répondu 2xx. Un 400 ici lui ferait
 * abandonner la livraison et le paiement ne serait jamais crédité.
 */
export class BkapayUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BkapayUnavailableError";
  }
}

function apiBase(): string {
  return env.payment.bkapay.baseUrl.replace(/\/+$/, "");
}

/** Rend absolue une `payment_url` que BKApay peut renvoyer relative (/checkout/…). */
function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase()}/${url.replace(/^\/+/, "")}`;
}

function authHeader(): string {
  const key = env.payment.bkapay.secretKey;
  if (!key) throw new Error("BKAPAY_SECRET_KEY manquant.");
  return `Bearer ${key}`;
}

/**
 * fetch vers BKApay avec un délai d'attente généreux (Mobile Money peut être
 * lent). Une panne réseau/timeout est marquée TRANSITOIRE pour que le webhook
 * réponde 5xx (rejeu) au lieu d'un 400 définitif.
 */
async function bkapayFetch(
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
      throw new BkapayUnavailableError(
        "BKApay met trop de temps à répondre. Réessayez.",
      );
    }
    throw new BkapayUnavailableError(
      `BKApay injoignable: ${(e as Error)?.message ?? "erreur réseau"}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Statut autoritatif d'une session (source de vérité : l'API authentifiée). */
async function fetchStatus(providerRef: string): Promise<ChargeStatus> {
  const res = await bkapayFetch(
    `${apiBase()}/api/v1/payment-sessions/${encodeURIComponent(providerRef)}/status`,
    { headers: { Authorization: authHeader(), Accept: "application/json" } },
  );
  if (!res.ok) {
    // 5xx/429/timeout… = panne transitoire : marquée comme telle pour que le
    // webhook réponde 5xx et que BKApay rejoue (au lieu d'abandonner sur un 400).
    throw new BkapayUnavailableError(`BKApay statut a échoué: ${res.status}`);
  }
  const json = await res.json();
  const data = json?.data ?? json;
  const status = String(data?.status ?? "").trim().toLowerCase();
  // Le montant n'est pas garanti dans la réponse de statut : on le prend s'il y
  // est, sinon `confirmTopup` se rabat sur le montant demandé (déjà verrouillé).
  const amountRaw = data?.amount ?? data?.amount_paid ?? data?.paidAmount;
  const amountNum = Number(amountRaw);
  return {
    approved: APPROVED.has(status),
    failed: FAILED.has(status),
    amountXof:
      Number.isFinite(amountNum) && amountNum > 0 ? amountNum : undefined,
  };
}

export const bkapayProvider: PaymentProvider = {
  name: "bkapay",

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const res = await bkapayFetch(`${apiBase()}/api/v1/payment-sessions`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: input.amountXof, // verrouillé côté BKApay
        currency: env.payment.bkapay.currency,
        description: input.description,
        success_url: input.callbackUrl, // retour après paiement
        cancel_url: input.callbackUrl, // retour si abandon
        callback_url: `${env.appUrl}/api/payments/bkapay/webhook`,
        order_id: input.reference, // notre id de transaction, renvoyé au webhook
      }),
    });

    if (!res.ok) {
      if (res.status >= 500) {
        throw new Error(
          "BKApay est momentanément indisponible. Réessayez dans un instant.",
        );
      }
      const body = await res.text();
      throw new Error(
        `BKApay session a échoué: ${res.status} ${body.slice(0, 200)}`,
      );
    }

    const json = await res.json();
    const data = json?.data ?? json;
    const providerRef = String(data?.session_id ?? data?.sessionId ?? "");
    const payUrl = data?.payment_url ?? data?.paymentUrl;
    if (!providerRef || !payUrl) {
      throw new Error(
        "BKApay: réponse inattendue (session_id / payment_url manquant).",
      );
    }
    return { providerRef, paymentUrl: absoluteUrl(String(payUrl)) };
  },

  async parseWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<WebhookResult | null> {
    // 1) Signature HMAC-SHA256 du corps BRUT avec le secret de signature payin.
    const secret = env.payment.bkapay.webhookSecret;
    const signature = (headers.get("x-bkapay-signature") ?? "").trim();
    if (secret) {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");
      const ok =
        signature.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      if (!ok) throw new Error("Signature BKApay invalide.");
    }

    const event = JSON.parse(rawBody) as {
      type?: string;
      data?: {
        sessionId?: string;
        session_id?: string;
        amount?: number | string;
      };
    };
    const data = event?.data ?? {};
    const providerRef = String(data.sessionId ?? data.session_id ?? "");
    if (!providerRef) return null;

    // 2) On ne crédite JAMAIS sur la seule foi du payload : on re-vérifie le
    //    statut via l'API authentifiée (clé secrète payin `sk_`, DISTINCTE du
    //    secret de signature `cs_`). Ainsi, même un webhook signé avec un secret
    //    qui aurait fuité ne peut pas créditer un paiement qui n'a pas eu lieu.
    //    Si l'API est injoignable -> throw (fail-closed : BKApay réémettra).
    const authoritative = await fetchStatus(providerRef);
    return {
      providerRef,
      approved: authoritative.approved,
      amountXof: authoritative.amountXof ?? (Number(data.amount) || undefined),
    };
  },

  fetchChargeStatus(providerRef: string): Promise<ChargeStatus> {
    return fetchStatus(providerRef);
  },
};
