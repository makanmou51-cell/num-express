import "server-only";
import { env } from "@/lib/env";
import type {
  ChargeStatus,
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
  WebhookResult,
} from "@/lib/payments/types";

/**
 * MoneyFusion (FusionPay) — agrégateur Mobile Money pour l'Afrique de l'Ouest.
 * Pay-in : POST des données sur l'URL API du marchand (tableau de bord) ->
 * { statut, token, url } ; redirection vers `url`. Confirmation via webhook,
 * mais le crédit ne se fait qu'après re-vérification autoritative du statut
 * (GET /paiementNotif/{token}) — le payload n'est pas cru sur parole.
 * Doc : https://docs.moneyfusion.net
 */

const APPROVED = new Set(["paid"]);
const FAILED = new Set(["failed", "no paid", "cancelled"]);

async function mfFetch(
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
      throw new Error("MoneyFusion met trop de temps à répondre. Réessayez.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Statut autoritatif d'un paiement (source de vérité : l'API MoneyFusion). */
async function fetchStatus(token: string): Promise<ChargeStatus> {
  const base = env.payment.moneyfusion.statusUrl.replace(/\/+$/, "");
  const res = await mfFetch(`${base}/${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`MoneyFusion statut a échoué: ${res.status}`);
  const json = await res.json();
  const data = json?.data ?? json;
  const statut = String(data?.statut ?? "").toLowerCase();
  const amount =
    typeof data?.Montant === "number"
      ? data.Montant
      : typeof data?.montant === "number"
        ? data.montant
        : undefined;
  return {
    approved: APPROVED.has(statut),
    failed: FAILED.has(statut),
    amountXof: amount,
  };
}

export const moneyfusionProvider: PaymentProvider = {
  name: "moneyfusion",

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const apiUrl = env.payment.moneyfusion.apiUrl;
    if (!apiUrl) throw new Error("MONEYFUSION_API_URL manquant.");

    const res = await mfFetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        totalPrice: input.amountXof,
        article: [{ [input.description]: input.amountXof }],
        nomclient: input.customer.name || input.customer.email,
        numeroSend: input.customer.phone ?? undefined,
        return_url: input.callbackUrl,
        webhook_url: `${env.appUrl}/api/payments/moneyfusion/webhook`,
        // Renvoyé tel quel -> lien vers notre transaction locale.
        personal_Info: [{ reference: input.reference }],
      }),
    });

    if (!res.ok) {
      if (res.status >= 500) {
        throw new Error(
          "MoneyFusion est momentanément indisponible. Réessayez dans un instant.",
        );
      }
      const body = await res.text();
      throw new Error(`MoneyFusion a échoué: ${res.status} ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const token = json?.token;
    const url = json?.url;
    if (json?.statut === false || !token || !url) {
      throw new Error(
        `MoneyFusion: réponse inattendue (${json?.message ?? "token/url manquant"}).`,
      );
    }
    return { providerRef: String(token), paymentUrl: String(url) };
  },

  async parseWebhook(rawBody: string): Promise<WebhookResult | null> {
    let event: Record<string, unknown> = {};
    try {
      event = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const data = (event?.data ?? event) as Record<string, unknown>;
    const token = String(
      data?.tokenPay ?? data?.token ?? event?.tokenPay ?? event?.token ?? "",
    );
    if (!token) return null;

    // On ne fait PAS confiance au payload : re-vérification autoritative.
    const authoritative = await fetchStatus(token);
    return {
      providerRef: token,
      approved: authoritative.approved,
      amountXof: authoritative.amountXof,
    };
  },

  fetchChargeStatus(providerRef: string): Promise<ChargeStatus> {
    return fetchStatus(providerRef);
  },
};
