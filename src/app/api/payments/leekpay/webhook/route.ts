import { NextResponse } from "next/server";
import {
  leekpayProvider,
  ProviderUnavailableError,
} from "@/lib/payments/leekpay";
import { confirmTopup } from "@/lib/payments";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Webhook LeekPay : confirme les recharges (payment.completed / status=paid). */
export async function POST(req: Request) {
  const rawBody = await req.text();

  let event;
  try {
    event = await leekpayProvider.parseWebhook(rawBody, req.headers);
  } catch (e) {
    // Panne TRANSITOIRE de LeekPay (500/429/timeout) -> 503 : le prestataire
    // REJOUERA le webhook. Un 400 ici lui ferait abandonner définitivement la
    // livraison et le paiement ne serait jamais crédité.
    if (e instanceof ProviderUnavailableError) {
      console.error("[leekpay webhook] prestataire indisponible:", e.message);
      return NextResponse.json(
        { error: "Prestataire indisponible, à rejouer." },
        { status: 503 },
      );
    }
    // Signature invalide / payload illisible -> 400 (définitif, ne pas rejouer).
    console.error("[leekpay webhook] rejeté:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  if (!event) return NextResponse.json({ ignored: true });

  // On ne crédite que sur paiement confirmé (les autres statuts sont ignorés).
  if (!event.approved) {
    return NextResponse.json({ ok: true, ignored: "not_approved" });
  }

  const result = await confirmTopup(event.providerRef, true, {
    paidXof: event.amountXof,
  });
  return NextResponse.json({ ok: true, result: result.status });
}
