import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Enregistre un abonnement aux notifications navigateur.
 *
 * Accessible SANS être connecté : un visiteur qui n'a pas encore de compte
 * peut accepter les notifications, et on pourra lui annoncer les nouveaux
 * stocks pour le faire revenir. S'il est connecté, on rattache l'abonnement à
 * son compte — ce qui permet en plus les messages personnels (« ton code est
 * arrivé »).
 *
 * `endpoint` est unique : un même navigateur qui se réabonne met à jour sa
 * ligne au lieu d'en créer une seconde.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const s = body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  const endpoint = s?.endpoint;
  const p256dh = s?.keys?.p256dh;
  const auth = s?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Abonnement incomplet." },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  const userAgent = req.headers.get("user-agent")?.slice(0, 250) ?? null;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    // Réabonnement : les clés peuvent avoir tourné, et l'utilisateur peut
    // s'être connecté depuis. On réactive aussi une ligne désactivée.
    update: {
      p256dh,
      auth,
      userAgent,
      active: true,
      ...(user ? { userId: user.id } : {}),
    },
    create: {
      endpoint,
      p256dh,
      auth,
      userAgent,
      userId: user?.id ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

/** Désabonnement : le client a retiré l'autorisation. */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint manquant" }, { status: 400 });
  }
  await prisma.pushSubscription.updateMany({
    where: { endpoint },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}
