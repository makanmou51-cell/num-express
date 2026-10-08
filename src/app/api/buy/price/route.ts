import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOffer } from "@/lib/grizzly/catalog";
import { getRentOfferFor } from "@/lib/rentals";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Services qui EXIGENT un numéro physique (non-VoIP) : WhatsApp refuse les
 * numéros virtuels. Si le pays n'a AUCUN numéro physique, le code unique
 * (activation) échouera à coup sûr -> on le signale et on propose la location.
 */
const PHYSICAL_REQUIRED = new Set(["wa"]);

/**
 * Prix pour un couple service/pays/durée.
 * duration = 0  -> ACTIVATION (code unique, ~20 min)
 * duration > 0  -> LOCATION (heures : 24, 72, 168, 720…)
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const service = sp.get("service")?.trim() || "";
  const country = sp.get("country")?.trim() || "";
  const duration = Number(sp.get("duration") ?? 0);
  if (!service || !country) {
    return NextResponse.json({ error: "Paramètres requis" }, { status: 400 });
  }

  try {
    if (!duration || duration <= 0) {
      const offer = await getOffer(service, country);
      if (!offer) {
        return NextResponse.json({ available: false });
      }
      // WhatsApp (ou service physique) sans AUCUN numéro physique : le code
      // unique échouerait. On bloque proprement et on propose la location si
      // un numéro dédié existe pour ce pays.
      if (PHYSICAL_REQUIRED.has(service) && offer.count <= 0) {
        let rentalAvailable = false;
        try {
          rentalAvailable = Boolean(await getRentOfferFor(service, country, 24));
        } catch {
          /* la vérif location a échoué : on reste sur "indisponible" simple */
        }
        return NextResponse.json({
          available: false,
          reason: "no_physical",
          rentalAvailable,
          suggestDuration: 24,
        });
      }
      return NextResponse.json({
        available: true,
        kind: "activation",
        priceXof: offer.priceXof,
        count: offer.count,
      });
    }

    const rent = await getRentOfferFor(service, country, duration);
    if (!rent) return NextResponse.json({ available: false });
    return NextResponse.json({
      available: true,
      kind: "rental",
      priceXof: rent.priceXof,
      count: rent.quantity,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Erreur" },
      { status: 500 },
    );
  }
}
