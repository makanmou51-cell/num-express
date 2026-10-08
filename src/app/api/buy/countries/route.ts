import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCatalogForService } from "@/lib/grizzly/catalog";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Catalogue pays (activation) pour un service — pour l'assistant d'achat. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const service = new URL(req.url).searchParams.get("service")?.trim() || "";
  if (!service) {
    return NextResponse.json({ error: "Service requis" }, { status: 400 });
  }

  try {
    const offers = await getCatalogForService(service);
    return NextResponse.json({
      countries: offers.map((o) => ({
        code: o.countryCode,
        name: o.countryName,
        iso: o.iso,
        count: o.count,
        priceXof: o.priceXof,
        reliable: o.reliable ?? false,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Erreur de chargement" },
      { status: 500 },
    );
  }
}
