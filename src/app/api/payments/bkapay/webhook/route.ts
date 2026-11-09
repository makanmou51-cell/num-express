import { NextResponse } from "next/server";
import {
  bkapayProvider,
  BkapayUnavailableError,
} from "@/lib/payments/bkapay";
import { confirmTopup } from "@/lib/payments";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Webhook BKApay : confirme les recharges (payment.completed / status=completed). */
export async function POST(req: Request) {
  const rawBody = await req.text();

  let event;
  try {
    event = await bkapayProvider.parseWebhook(rawBody, req.headers);
  } catch (e) {
    // Panne TRANSITOIRE de BKApay (500/429/timeout) -> 503 : BKApay REJOUERA le
    // webhook (toutes les 30 min pendant 24 h). Un 400 ici lui ferait abandonner
    // définitivement la livraison et le paiement ne serait jamais crédité.
    if (e instanceof BkapayUnavailableError) {
      console.error("[bkapay webhook] prestataire indisponible:", e.message);
      return NextResponse.json(
        { error: "Prestataire indisponible, à rejouer." },
        { status: 503 },
      );
    }
    // Signature invalide / payload illisible -> 400 (définitif, ne pas rejouer).
    console.error("[bkapay webhook] rejeté:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  if (!event) return NextResponse.json({ ignored: true });

  // On ne crédite que sur paiement confirmé. Les échecs/expirations sont laissés
  // à la réconciliation (retour sur /wallet + cron), qui les clôt proprement.
  if (!event.approved) {
    return NextResponse.json({ ok: true, ignored: "not_approved" });
  }

  // Idempotent : BKApay peut livrer le même évènement plusieurs fois.
  const result = await confirmTopup(event.providerRef, true, {
    paidXof: event.amountXof,
  });
  return NextResponse.json({ ok: true, result: result.status });
}
