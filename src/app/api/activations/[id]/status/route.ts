import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { refreshActivation } from "@/lib/activations";

export const runtime = "nodejs";

/**
 * Endpoint de polling : interroge Grizzly, met à jour l'activation et renvoie
 * son état courant. Appelé périodiquement par la page de détail.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const activation = await refreshActivation(user.id, id);
  if (!activation) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    id: activation.id,
    status: activation.status,
    smsCode: activation.smsCode,
    phoneNumber: activation.phoneNumber,
    expiresAt: activation.expiresAt,
  });
}
