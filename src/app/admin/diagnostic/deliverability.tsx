import { Card } from "@/components/ui";
import { prisma } from "@/lib/db";
import { grizzly } from "@/lib/grizzly/client";
import {
  preferredOperators,
  operatorSelectionActive,
} from "@/lib/grizzly/operators";
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
/* NOS pays, ceux que les clients achètent réellement. Le classement mondial
   renvoyé sans filtre ne contient ni l'Allemagne, ni les Pays-Bas, ni la
   France, ni le Royaume-Uni — il est donc inutilisable pour décider quoi
   mettre en avant. On demande explicitement les nôtres. */
const NOS_PAYS = [
  "43",
  "48",
  "78",
  "16",
  "117",
  "36",
  "86",
  "56",
  "129",
  "15",
  "187",
  "32",
  "45",
  "175",
  "82",
  "172",
  "163",
  "174",
  "59",
  "128",
] as const;

const lireDelivrabilite = unstable_cache(
  async (service: string) =>
    grizzly.getDeliverability({
      service,
      withOperators: true,
      size: 25,
      countries: NOS_PAYS,
    }),
  ["herosms:deliverability:nos-pays"],
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

  /* Ce qui sera REELLEMENT impose a l'achat. On le calcule ici pour que
     Michael le voie AVANT la premiere vente, au lieu de le decouvrir dans
     les resultats une semaine plus tard - c'est ce qui s'est passe en
     septembre avec la carte ecrite a la main. */
  const imposes = new Map<string, readonly string[]>();
  for (const p of liste) {
    const id = String(p.country);
    imposes.set(id, await preferredOperators(service, id));
  }

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
      imposes: imposes.get(code) ?? [],
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
        Sur <strong>nos</strong> pays, pas leur classement mondial. Leur taux
        sur 24 h, à côté du nôtre mesuré sur nos ventes. La colonne de droite
        est la plus utile : dans un même pays, l&apos;opérateur fait varier la
        réussite du simple au quintuple.
      </p>

      <p
        className={`mt-3 rounded-lg px-3 py-2 text-sm ${
          operatorSelectionActive
            ? "bg-green-50 text-green-900"
            : "bg-gray-100 text-muted"
        }`}
      >
        {operatorSelectionActive ? (
          <>
            <strong>Sélection d&apos;opérateur ACTIVE.</strong> La colonne
            «&nbsp;Imposé&nbsp;» indique ce qui sera réellement demandé à
            l&apos;achat. Un pays sans opérateur imposé est acheté librement.
          </>
        ) : (
          <>
            <strong>Sélection d&apos;opérateur désactivée.</strong> Tous les
            achats se font sans contrainte. Poser{" "}
            <code>OPERATOR_SELECTION=on</code> pour l&apos;activer.
          </>
        )}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-1 font-medium">Pays</th>
              <th className="pb-1 text-right font-medium">Eux</th>
              <th className="pb-1 text-right font-medium">Nous</th>
              <th className="pb-1 text-right font-medium">Nos ventes</th>
              <th className="pb-1 pl-4 font-medium">Imposé à l&apos;achat</th>
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
                <td className="py-1.5 pl-4 text-xs font-semibold">
                  {l.imposes.length ? (
                    <span className="text-green-700">
                      {l.imposes.join(" → ")}
                    </span>
                  ) : (
                    <span className="text-muted">libre</span>
                  )}
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
        La <strong>part</strong> entre parenthèses compte autant que le taux :
        un opérateur à 40 % qui ne pèse que 11 % du stock ne sera jamais servi
        par hasard — il faut le demander explicitement à l&apos;achat.
      </p>
    </Card>
  );
}
