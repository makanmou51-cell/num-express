import { Card } from "@/components/ui";
import { prisma } from "@/lib/db";
import { grizzly } from "@/lib/grizzly/client";
import { unstable_cache } from "next/cache";

/**
 * La délivrabilité mesurée par HeroSMS, confrontée à la nôtre.
 *
 * `GET /stats/deliverability` est la donnée qu'on cherchait depuis une
 * semaine : le fournisseur publie lui-même le taux de réussite par pays, et
 * le détaille par opérateur avec la part de chacun dans les achats réussis.
 *
 * Deux problèmes ouverts qu'elle peut fermer :
 *
 *   1. Le catalogue trie par STOCK. Les Pays-Bas ont 693 000 numéros et
 *      décrochent un badge « Fiable » pour 3 % de réussite réelle, pendant que
 *      le Canada (60 % sur nos ventes) reste invisible. Un tri sur CE chiffre
 *      réglerait la cause plutôt que le symptôme.
 *   2. La carte d'opérateurs de `operators.ts` a été écrite à la main, au
 *      jugé. Elle a dégradé les résultats fin septembre et a dû être
 *      désactivée. HeroSMS donne les taux par opérateur : plus besoin de
 *      deviner.
 *
 * On affiche leur chiffre à côté du nôtre, parce qu'un taux fournisseur ne
 * vaut que s'il prédit ce qui arrive chez nos clients.
 */

type Pays = {
  country: number;
  successRate: number;
  operators?: Array<{
    code: string;
    successRate: number;
    share: number;
  }> | null;
};

/* HeroSMS limite le débit (HTTP 429 RATE_LIMIT) et cette page rechargeait
   l'API à chaque visite. 30 minutes de cache suffisent : leur statistique
   porte sur 24 h glissantes, elle ne bouge pas à la minute. */
const lireDelivrabilite = unstable_cache(
  async (service: string) =>
    grizzly.getDeliverability({ service, withOperators: true, size: 25 }),
  ["herosms:deliverability"],
  { revalidate: 1800 },
);

export async function DeliverabilityPanel({
  service = "wa",
}: {
  service?: string;
}) {
  let brut: { data?: Record<string, Pays[]>; meta?: unknown };
  try {
    brut = (await lireDelivrabilite(service)) as {
      data?: Record<string, Pays[]>;
    };
  } catch (e) {
    return (
      <Card className="p-5">
        <h2 className="font-bold">Délivrabilité HeroSMS — indisponible</h2>
        <p className="mt-1 text-sm text-muted">{(e as Error).message}</p>
        <p className="mt-2 text-xs text-muted">
          L&apos;authentification attendue est{" "}
          <code>Authorization: ApiKey &lt;clé&gt;</code>. Si le message parle de
          401, la clé HeroSMS n&apos;ouvre peut-être pas encore l&apos;API REST.
        </p>
      </Card>
    );
  }

  const liste = brut.data?.[service] ?? [];
  if (!liste.length) {
    return (
      <Card className="p-5">
        <h2 className="font-bold">Délivrabilité HeroSMS ({service})</h2>
        <p className="mt-1 text-sm text-muted">
          Réponse reçue, mais aucun pays retourné pour ce service.
        </p>
      </Card>
    );
  }

  // Nos propres taux, pour confronter.
  const [noms, ventes, recus] = await Promise.all([
    grizzly
      .getCountries()
      .catch(() => ({}) as Record<string, { eng?: string }>),
    prisma.activation.groupBy({
      by: ["countryCode"],
      where: { serviceCode: service },
      _count: { _all: true },
    }),
    prisma.activation.groupBy({
      by: ["countryCode"],
      where: { serviceCode: service, smsCode: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const nbVentes = new Map(ventes.map((v) => [v.countryCode, v._count._all]));
  const nbRecus = new Map(recus.map((v) => [v.countryCode, v._count._all]));

  const lignes = liste.map((p) => {
    const code = String(p.country);
    const v = nbVentes.get(code) ?? 0;
    const r = nbRecus.get(code) ?? 0;
    return {
      code,
      nom: noms[code]?.eng ?? `Pays ${code}`,
      eux: p.successRate,
      ventes: v,
      nous: v >= 5 ? Math.round((r / v) * 100) : null,
      operateurs: (p.operators ?? [])
        .slice()
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 4),
    };
  });

  return (
    <Card className="p-5">
      <h2 className="font-bold">
        Délivrabilité mesurée par HeroSMS ({service})
      </h2>
      <p className="mt-1 text-sm text-muted">
        Leur taux de réussite par pays et par opérateur, sur 24 h. À côté : le
        nôtre, mesuré sur nos ventes.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-1 font-medium">Pays</th>
              <th className="pb-1 text-right font-medium">Eux</th>
              <th className="pb-1 text-right font-medium">Nous</th>
              <th className="pb-1 text-right font-medium">Nos ventes</th>
              <th className="pb-1 pl-4 font-medium">
                Meilleurs opérateurs (taux · part)
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.code} className="border-t border-border align-top">
                <td className="py-1.5">{l.nom}</td>
                <td
                  className={`py-1.5 text-right font-semibold tabular-nums ${
                    l.eux >= 20 ? "text-green-700" : "text-muted"
                  }`}
                >
                  {Math.round(l.eux)} %
                </td>
                <td
                  className={`py-1.5 text-right font-semibold tabular-nums ${
                    l.nous === null
                      ? "text-muted"
                      : l.nous >= 20
                        ? "text-green-700"
                        : "text-red-600"
                  }`}
                >
                  {l.nous === null ? "—" : `${l.nous} %`}
                </td>
                <td className="py-1.5 text-right tabular-nums text-muted">
                  {l.ventes || "—"}
                </td>
                <td className="py-1.5 pl-4 text-xs text-muted">
                  {l.operateurs.length
                    ? l.operateurs
                        .map(
                          (o) =>
                            `${o.code} ${Math.round(o.successRate)} % (${Math.round(o.share)} %)`,
                        )
                        .join(" · ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 border-t border-border pt-3 text-sm">
        Si cette colonne «&nbsp;Eux&nbsp;» suit la colonne «&nbsp;Nous&nbsp;»,
        on tient enfin de quoi{" "}
        <strong>trier le catalogue sur la réussite</strong> au lieu du stock —
        et de quoi <strong>choisir les opérateurs sur des mesures</strong>{" "}
        plutôt qu&apos;au jugé.
      </p>
    </Card>
  );
}
