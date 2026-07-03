import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import type {
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
  WebhookResult,
} from "@/lib/payments/types";

function baseUrl(): string {
  return env.payment.fedapay.environment === "live"
    ? "https://api.fedapay.com/v1"
    : "https://sandbox-api.fedapay.com/v1";
}

function authHeaders(): HeadersInit {
  const key = env.payment.fedapay.secretKey;
  if (!key) throw new Error("FEDAPAY_SECRET_KEY manquant.");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** Récupère une transaction depuis l'API FedaPay (source de vérité). */
async function fetchTransaction(
  id: string,
): Promise<{ status?: string; amount?: number }> {
  const res = await fetch(`${baseUrl()}/transactions/${id}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`FedaPay get transaction a échoué: ${res.status}`);
  }
  const data = await res.json();
  const tx = data?.["v1/transaction"] ?? data?.transaction ?? data;
  return { status: tx?.status, amount: tx?.amount };
}

/**
 * FedaPay — agrégateur Mobile Money / cartes pour la zone CFA.
 * Flux : créer une transaction, générer un token de paiement (URL), puis
 * confirmer via webhook `transaction.approved`.
 * Doc : https://docs.fedapay.com
 */
export const fedapayProvider: PaymentProvider = {
  name: "fedapay",

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const [firstname, ...rest] = (input.customer.name ?? "Client").split(" ");

    // 1) Créer la transaction
    const createRes = await fetch(`${baseUrl()}/transactions`, {
      method: "POST",
      headers: authHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        description: input.description,
        amount: input.amountXof,
        currency: { iso: env.payment.fedapay.currency },
        callback_url: input.callbackUrl,
        customer: {
          firstname: firstname || "Client",
          lastname: rest.join(" ") || undefined,
          email: input.customer.email,
        },
        metadata: { reference: input.reference },
      }),
    });

    if (!createRes.ok) {
      const body = await createRes.text();
      throw new Error(`FedaPay create transaction a échoué: ${createRes.status} ${body}`);
    }
    const created = await createRes.json();
    const txId: string | number =
      created?.["v1/transaction"]?.id ?? created?.transaction?.id ?? created?.id;
    if (!txId) throw new Error("FedaPay: id de transaction introuvable.");

    // 2) Générer le token / lien de paiement
    const tokenRes = await fetch(`${baseUrl()}/transactions/${txId}/token`, {
      method: "POST",
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`FedaPay token a échoué: ${tokenRes.status} ${body}`);
    }
    const tokenData = await tokenRes.json();
    const paymentUrl: string | undefined = tokenData?.url;
    if (!paymentUrl) throw new Error("FedaPay: URL de paiement introuvable.");

    return { providerRef: String(txId), paymentUrl };
  },

  async parseWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<WebhookResult | null> {
    const secret = env.payment.fedapay.webhookSecret;
    const signature = headers.get("x-fedapay-signature") ?? "";

    // Vérification de signature (format `t=...,s=...`, HMAC SHA256 sur `t.body`).
    if (secret) {
      const parts = Object.fromEntries(
        signature.split(",").map((kv) => kv.split("=").map((s) => s.trim())),
      ) as { t?: string; s?: string };
      const expected = crypto
        .createHmac("sha256", secret)
        .update(`${parts.t}.${rawBody}`)
        .digest("hex");
      const provided = parts.s ?? "";
      const ok =
        provided.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
      if (!ok) throw new Error("Signature FedaPay invalide.");
    }

    const event = JSON.parse(rawBody);
    const entity =
      event?.entity ?? event?.data ?? event?.["v1/transaction"] ?? {};
    const providerRef = String(entity?.id ?? "");
    if (!providerRef) return null;

    // On NE fait PAS confiance au payload (statut/montant falsifiables) : le
    // statut et le montant sont TOUJOURS re-vérifiés via l'API authentifiée.
    // Clé absente ou API injoignable -> throw (fail-closed : pas de crédit).
    if (!env.payment.fedapay.secretKey) {
      throw new Error(
        "FEDAPAY_SECRET_KEY requise pour vérifier le paiement (fail-closed).",
      );
    }
    const authoritative = await fetchTransaction(providerRef);
    return {
      providerRef,
      approved: authoritative.status === "approved",
      amountXof:
        typeof authoritative.amount === "number"
          ? authoritative.amount
          : undefined,
    };
  },
};
