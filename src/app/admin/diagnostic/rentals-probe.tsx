import { Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { getRentCatalog, RENT_DURATIONS, RENTALS_ENABLED } from "@/lib/rentals";

/**
 * Ce que num express peut RÉELLEMENT louer, durée par durée.
 *
 * Pourquoi cette sonde : la page d'achat répond « Indisponible pour cette
 * durée » sans dire pour quels pays elle l'est, ni pourquoi. Or c'est
 * exactement l'information commerciale qui manque — le concurrent Whanum
 * vend un « numéro à vie » britannique à 28 600 F, et il faut savoir si
 * cette offre est à notre portée ou si HeroSMS ne la sert simplement pas.
 *
 * HeroSMS réduit sa couverture quand la durée augmente : ~35 pays à 1 jour,
 * beaucoup moins à 30. Cette sonde le montre en clair, avec les prix, pour
 * qu'on décide sur des faits.
 */
export async function RentalsProbe({ service }: { service: string }) {
  if (!RENTALS_ENABLED) {
    return (
      <Card className="p-5">
        <h2 className="font-bold">Location — indisponible</h2>
        <p className="mt-1 text-sm text-muted">
          La location n&apos;est active que sur HeroSMS.
        </p>
      </Card>
    );
  }

  const lignes = await Promise.all(
    RENT_DURATIONS.map(async (d) => {
      try {
        const offres = await getRentCatalog(service, d.hours);
        return { label: d.label, offres, erreur: null as string | null };
      } catch (e) {
        return { label: d.label, offres: [], erreur: (e as Error).message };
      }
    }),
  );

  return (
    <Card className="p-5">
      <h2 className="font-bold">
        Location — ce qu&apos;on peut vendre ({service})
      </h2>
      <p className="mt-1 text-sm text-muted">
        Interrogé en direct chez HeroSMS. Un pays absent d&apos;une durée = «
        Indisponible » sur la page d&apos;achat.
      </p>

      <div className="mt-4 space-y-4">
        {lignes.map((l) => (
          <div key={l.label}>
            <p className="text-sm font-semibold">
              {l.label}{" "}
              <span className="font-normal text-muted">
                — {l.offres.length} pays
              </span>
            </p>
            {l.erreur && (
              <p className="mt-1 text-sm text-red-600">Erreur : {l.erreur}</p>
            )}
            {!l.erreur && !l.offres.length && (
              <p className="mt-1 text-sm text-amber-700">
                Aucun pays louable à cette durée — c&apos;est ce qui produit «
                Indisponible ».
              </p>
            )}
            {l.offres.length > 0 && (
              <div className="mt-1.5 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="pb-1 font-medium">Pays</th>
                      <th className="pb-1 text-right font-medium">Stock</th>
                      <th className="pb-1 text-right font-medium">Coût</th>
                      <th className="pb-1 text-right font-medium">
                        Prix client
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.offres.slice(0, 12).map((o) => (
                      <tr
                        key={o.countryCode}
                        className="border-t border-border"
                      >
                        <td className="py-1">{o.countryName}</td>
                        <td className="py-1 text-right tabular-nums text-muted">
                          {o.quantity}
                        </td>
                        <td className="py-1 text-right tabular-nums text-muted">
                          {o.rawCost.toFixed(2)} $
                        </td>
                        <td className="py-1 text-right font-semibold tabular-nums">
                          {formatXof(o.priceXof)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {l.offres.length > 12 && (
                  <p className="mt-1 text-xs text-muted">
                    … et {l.offres.length - 12} autres pays.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
