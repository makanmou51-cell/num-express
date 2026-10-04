import { Card } from "@/components/ui";
import { prisma } from "@/lib/db";
import { grizzly } from "@/lib/grizzly/client";

/**
 * Le « Top pays » de HeroSMS vaut-il quelque chose ?
 *
 * `getTopCountriesByService` renvoie un classement ordonné, mais ses champs
 * sont `price`, `retail_price` et `count` — AUCUN taux de réussite. Rien ne
 * dit donc si ce « top » classe les pays par performance, par popularité ou
 * simplement par prix croissant.
 *
 * Un classement fournisseur ne vaut que s'il prédit ce qui arrive vraiment
 * chez nous. On le confronte donc à la seule vérité disponible : le taux de
 * code effectivement reçu, mesuré sur nos propres ventes. Si le n°1 de
 * HeroSMS est un pays où nos clients n'obtiennent jamais leur code, le
 * classement ne sert à rien — et il vaut mieux le savoir avant de trier le
 * catalogue dessus.
 */

type Ligne = {
  rang: number;
  code: string;
  nom: string;
  cout: number;
  stock: number;
  ventes: number;
  recus: number;
  taux: number | null;
};

export async function TopCountriesProbe({
  service = "wa",
}: {
  service?: string;
}) {
  let brut: unknown;
  try {
    const r = await grizzly.probeRaw("getTopCountriesByService", { service });
    if (!r.ok) throw new Error(r.body);
    brut = JSON.parse(r.body);
  } catch (e) {
    return (
      <Card className="p-5">
        <h2 className="font-bold">Top pays HeroSMS — indisponible</h2>
        <p className="mt-1 text-sm text-muted">{(e as Error).message}</p>
      </Card>
    );
  }

  /* La reponse est un objet indexe par rang : { "0": {country, price, count}, … }.
     Le spread d'un type large perdait les champs a la compilation : on les
     nomme explicitement. */
  type Entree = { rang: number; country: number; price: number; count: number };
  const entrees: Entree[] = Object.entries(
    brut as Record<
      string,
      { country?: number; price?: number; count?: number }
    >,
  )
    .map(([k, v]) => ({
      rang: Number(k),
      country: Number(v?.country),
      price: Number(v?.price ?? 0),
      count: Number(v?.count ?? 0),
    }))
    .filter((x) => Number.isFinite(x.country))
    .sort((a, b) => a.rang - b.rang)
    .slice(0, 15);

  const [noms, ventes] = await Promise.all([
    grizzly
      .getCountries()
      .catch(() => ({}) as Record<string, { eng?: string }>),
    prisma.activation.groupBy({
      by: ["countryCode"],
      where: { serviceCode: service },
      _count: { _all: true },
    }),
  ]);

  // Codes reçus par pays : la seule mesure qui compte.
  const recus = await prisma.activation.groupBy({
    by: ["countryCode"],
    where: { serviceCode: service, smsCode: { not: null } },
    _count: { _all: true },
  });
  const nbVentes = new Map(ventes.map((v) => [v.countryCode, v._count._all]));
  const nbRecus = new Map(recus.map((v) => [v.countryCode, v._count._all]));

  const lignes: Ligne[] = entrees.map((e) => {
    const code = String(e.country);
    const v = nbVentes.get(code) ?? 0;
    const r = nbRecus.get(code) ?? 0;
    return {
      rang: e.rang + 1,
      code,
      nom: noms[code]?.eng ?? `Pays ${code}`,
      cout: e.price,
      stock: e.count,
      ventes: v,
      recus: r,
      taux: v >= 5 ? Math.round((r / v) * 100) : null,
    };
  });

  const mesures = lignes.filter((l) => l.taux !== null);
  const bons = mesures.filter((l) => (l.taux ?? 0) >= 20).length;

  return (
    <Card className="p-5">
      <h2 className="font-bold">
        Top pays HeroSMS ({service}) — confronté à nos chiffres
      </h2>
      <p className="mt-1 text-sm text-muted">
        Leur classement à gauche, notre taux de code réellement reçu à droite.
        Un classement fournisseur ne vaut que s&apos;il prédit ce qui se passe
        chez nous.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-1 font-medium">#</th>
              <th className="pb-1 font-medium">Pays</th>
              <th className="pb-1 text-right font-medium">Coût</th>
              <th className="pb-1 text-right font-medium">Stock</th>
              <th className="pb-1 text-right font-medium">Nos ventes</th>
              <th className="pb-1 text-right font-medium">Notre taux</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.code} className="border-t border-border">
                <td className="py-1 text-muted">{l.rang}</td>
                <td className="py-1">{l.nom}</td>
                <td className="py-1 text-right tabular-nums text-muted">
                  {l.cout.toFixed(2)} $
                </td>
                <td className="py-1 text-right tabular-nums text-muted">
                  {l.stock.toLocaleString("fr-FR")}
                </td>
                <td className="py-1 text-right tabular-nums text-muted">
                  {l.ventes || "—"}
                </td>
                <td
                  className={`py-1 text-right font-semibold tabular-nums ${
                    l.taux === null
                      ? "text-muted"
                      : l.taux >= 20
                        ? "text-green-700"
                        : "text-red-600"
                  }`}
                >
                  {l.taux === null ? "pas assez de ventes" : `${l.taux} %`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 border-t border-border pt-3 text-sm">
        {mesures.length === 0 ? (
          <>
            Aucun de leurs pays du haut de classement n&apos;a assez de ventes
            chez nous pour être jugé. Le classement ne peut pas être validé.
          </>
        ) : (
          <>
            Sur les <strong>{mesures.length}</strong> pays de leur classement
            que nous avons assez vendus, <strong>{bons}</strong> dépassent 20 %
            de réussite chez nous.{" "}
            {bons === 0 ? (
              <span className="text-red-700">
                Leur « top » ne prédit donc rien de ce qui compte pour nous : à
                ne PAS utiliser pour trier le catalogue.
              </span>
            ) : bons >= mesures.length / 2 ? (
              <span className="text-green-700">
                Leur classement concorde avec nos mesures : il est exploitable.
              </span>
            ) : (
              <span className="text-amber-700">
                Concordance partielle : utilisable comme indice, pas comme
                règle.
              </span>
            )}
          </>
        )}
      </p>
    </Card>
  );
}
