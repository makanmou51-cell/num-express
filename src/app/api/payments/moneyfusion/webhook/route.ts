import { NextResponse } from "next/server";
import { moneyfusionProvider } from "@/lib/payments/moneyfusion";
import { confirmTopup } from "@/lib/payments";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Webhook MoneyFusion : confirme les recharges (statut=paid, re-vérifié via API). */
export async function POST(req: Request) {
  const rawBody = await req.text();

  let event;
  try {
    event = await moneyfusionProvider.parseWebhook(rawBody, req.headers);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  if (!event) return NextResponse.json({ ignored: true });
  if (!event.approved) {
    return NextResponse.json({ ok: true, ignored: "not_approved" });
  }

  const result = await confirmTopup(event.providerRef, true, {
    paidXof: event.amountXof,
  });
  return NextResponse.json({ ok: true, result: result.status });
}
