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

const APPROVED_STATUSES = new Set(["paid"]);
const FAILED_STATUSES = new Set(["failed", "cancelled", "expired"]);

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
      throw new Error("LeekPay met trop de temps à répondre. Réessayez.");
    }
    throw e;
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
  if (!res.ok) throw new Error(`LeekPay get checkout a échoué: ${res.status}`);
  const json = await res.json();
  const data = json?.data ?? json;
  const status = String(data?.status ?? "");
  return {
    approved: APPROVED_STATUSES.has(status),
    failed: FAILED_STATUSES.has(status),
    amountXof: typeof data?.amount === "number" ? data.amount : undefined,
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
    const data = event?.data ?? {};
    const providerRef = String(
      data?.checkout_id ?? data?.id ?? data?.transaction_id ?? "",
    );
    if (!providerRef) return null;

    const authoritative = await fetchStatus(providerRef);
    return {
      providerRef,
      approved: authoritative.approved,
      amountXof: authoritative.amountXof,
    };
  },

  fetchChargeStatus(providerRef: string): Promise<ChargeStatus> {
    return fetchStatus(providerRef);
  },
};
