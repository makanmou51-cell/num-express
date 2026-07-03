import { NextResponse } from "next/server";
import { leekpayProvider } from "@/lib/payments/leekpay";
import { confirmTopup } from "@/lib/payments";

export const runtime = "nodejs";

/** Webhook LeekPay : confirme les recharges (payment.completed / status=paid). */
export async function POST(req: Request) {
  const rawBody = await req.text();

  let event;
  try {
    event = await leekpayProvider.parseWebhook(rawBody, req.headers);
  } catch (e) {
    // Signature invalide -> 400.
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
