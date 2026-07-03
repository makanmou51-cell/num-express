import { NextResponse } from "next/server";
import { fedapayProvider } from "@/lib/payments/fedapay";
import { confirmTopup } from "@/lib/payments";

export const runtime = "nodejs";

/** Webhook FedaPay : confirme les recharges (transaction.approved). */
export async function POST(req: Request) {
  const rawBody = await req.text();

  let event;
  try {
    event = await fedapayProvider.parseWebhook(rawBody, req.headers);
  } catch (e) {
    // Signature invalide -> 400.
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 },
    );
  }

  if (!event) return NextResponse.json({ ignored: true });

  // On ne crédite que sur paiement confirmé. Les autres évènements (encore en
  // attente) sont ignorés pour ne pas marquer à tort une recharge en échec.
  if (!event.approved) {
    return NextResponse.json({ ok: true, ignored: "not_approved" });
  }

  const result = await confirmTopup(event.providerRef, true, {
    paidXof: event.amountXof,
  });
  return NextResponse.json({ ok: true, result: result.status });
}
