import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOffer } from "@/lib/grizzly/catalog";
import {
  getRentOfferFor,
  RENT_DURATIONS,
  RENTALS_ENABLED,
} from "@/lib/rentals";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Services qui EXIGENT un numéro physique (non-VoIP) : WhatsApp refuse les
 * numéros virtuels. Même règle que /api/buy/price.
 */
const PHYSICAL_REQUIRED = new Set(["wa"]);

/**
 * Prix de TOUTES les durées pour un couple service/pays, en un seul appel.
 *
 * Le client (sélecteur de durée) a besoin du prix de chaque pastille
 * (20 min + locations 1 à 30 j). Plutôt que 6 requêtes réseau depuis le
 * navigateur, le serveur interroge le fournisseur EN PARALLÈLE et renvoie la
 * liste d'un coup. Chaque prix inclut déjà la marge (activation par palier,
 * location +marge fixe) — jamais de vente à perte.
 *
 * Réponse : { durations: [{ hours, available, priceXof?, count?, kind,
 * reason?, rentalAvailable?, suggestDuration? }, …] }
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const service = sp.get("service")?.trim() || "";
  const country = sp.get("country")?.trim() || "";
  if (!service || !country) {
    return NextResponse.json({ error: "Paramètres requis" }, { status: 400 });
  }

  try {
    // Activation (20 min, duration = 0).
    const activationP = (async () => {
      const offer = await getOffer(service, country);
      if (!offer) {
        return { hours: 0, available: false, kind: "activation" as const };
      }
      // WhatsApp sans AUCUN numéro physique : le code unique échouerait.
      if (PHYSICAL_REQUIRED.has(service) && offer.count <= 0) {
        let rentalAvailable = false;
        try {
          rentalAvailable = Boolean(await getRentOfferFor(service, country, 24));
        } catch {
          /* la vérif location a échoué : on reste sur "indisponible" simple */
        }
        return {
          hours: 0,
          available: false,
          reason: "no_physical" as const,
          rentalAvailable,
          suggestDuration: 24,
          kind: "activation" as const,
        };
      }
      return {
        hours: 0,
        available: true,
        kind: "activation" as const,
        priceXof: offer.priceXof,
        count: offer.count,
      };
    })();

    // Locations (1 à 30 j) — une entrée par durée, seulement si HeroSMS est actif.
    const rentalPs = RENTALS_ENABLED
      ? RENT_DURATIONS.map(async (d) => {
          const rent = await getRentOfferFor(service, country, d.hours);
          return rent
            ? {
                hours: d.hours,
                available: true,
                kind: "rental" as const,
                priceXof: rent.priceXof,
                count: rent.quantity,
              }
            : { hours: d.hours, available: false, kind: "rental" as const };
        })
      : [];

    const durations = await Promise.all([activationP, ...rentalPs]);
    return NextResponse.json({ durations });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Erreur" },
      { status: 500 },
    );
  }
}
