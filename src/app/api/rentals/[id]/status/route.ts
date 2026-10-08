import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRentalForUser, getRentalMessages } from "@/lib/rentals";

export const runtime = "nodejs";

/** Polling : lit les SMS reçus par un numéro loué (getStatusV2). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const rental = await getRentalForUser(user.id, id);
  if (!rental) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const sms = await getRentalMessages(rental);
  const expired = rental.endsAt.getTime() < Date.now();

  return NextResponse.json({
    status: expired ? "EXPIRED" : rental.status,
    endsAt: rental.endsAt.toISOString(),
    phoneNumber: rental.phoneNumber,
    sms,
  });
}
