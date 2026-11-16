import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { peakerr } from "@/lib/peakerr/client";

/**
 * TEMPORAIRE — récupération de la liste complète des services Peakerr pour
 * élargir le catalogue Boost avec de VRAIS identifiants et coûts.
 *
 * Réservé à l'admin. Utilise la clé Peakerr déjà configurée sur le serveur :
 * la clé ne quitte jamais l'environnement. À SUPPRIMER une fois le catalogue
 * construit.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const services = await peakerr.services();
    return NextResponse.json({ count: services.length, services });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "peakerr error" },
      { status: 502 },
    );
  }
}
