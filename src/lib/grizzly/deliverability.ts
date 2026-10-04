import "server-only";
import { unstable_cache } from "next/cache";
import { grizzly } from "@/lib/grizzly/client";

/**
 * La délivrabilité mesurée par HeroSMS — source unique pour tout le site.
 *
 * `GET /stats/deliverability` publie, par pays et par opérateur :
 *   · `successRate` — le pourcentage d'achats qui reçoivent leur code ;
 *   · `share` — la part de cet opérateur dans les achats réussis du pays.
 *
 * Ce que leurs chiffres ont appris (relevé du 2026-10-04, WhatsApp) :
 *
 *     Tchéquie   vodafone 40 % (11 %)  ·  tmobile 7 % (22 %)
 *     Croatie    bonbon   20 % (25 %)  ·  telemach 3 % (75 %)
 *     Irlande    48mobile 33 % (5 %)   ·  lycamobile 14 % (95 %)
 *
 * Deux enseignements qui commandent tout le reste :
 *   1. DANS UN MÊME PAYS, l'opérateur fait varier la réussite du simple au
 *      quintuple. Le pays n'est donc pas la bonne maille de décision.
 *   2. Le meilleur opérateur ne pèse souvent que 5 à 25 % du stock : sans le
 *      demander explicitement, on ne tombe jamais dessus.
 *
 * Ce module remplace une carte d'opérateurs que j'avais écrite au jugé en
 * septembre. Elle avait DÉGRADÉ les résultats et dû être désactivée — parce
 * qu'elle ajoutait des opérateurs virtuels (lebara, lycamobile…) en croyant
 * bien faire. Ici plus rien n'est deviné : tout vient de leurs mesures.
 */

/** Pays que num express vend réellement (ids HeroSMS). */
export const PAYS_VENDUS = [
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

export interface OperateurMesure {
  code: string;
  successRate: number;
  share: number;
}
export interface PaysMesure {
  country: string;
  successRate: number;
  operators: OperateurMesure[];
}

type Reponse = {
  data?: Record<
    string,
    Array<{
      country: number;
      successRate: number;
      operators?: Array<{
        code: string;
        successRate: number;
        share: number;
      }> | null;
    }>
  >;
};

/**
 * Lecture brute, mise en cache 6 h.
 *
 * HeroSMS limite le débit (429 RATE_LIMIT) et cette donnée alimente le
 * catalogue ET chaque achat : sans cache, une page d'achat un peu fréquentée
 * ferait tomber l'API. Leur statistique porte sur 24 h glissantes, 6 h de
 * fraîcheur sont largement suffisantes.
 */
const lire = unstable_cache(
  async (service: string): Promise<PaysMesure[]> => {
    const r = (await grizzly.getDeliverability({
      service,
      withOperators: true,
      size: 25,
      countries: PAYS_VENDUS,
    })) as Reponse;
    const liste = r.data?.[service] ?? [];
    return liste.map((p) => ({
      country: String(p.country),
      successRate: Number(p.successRate) || 0,
      operators: (p.operators ?? [])
        .map((o) => ({
          code: String(o.code),
          successRate: Number(o.successRate) || 0,
          share: Number(o.share) || 0,
        }))
        .sort((a, b) => b.successRate - a.successRate),
    }));
  },
  ["herosms:deliverability:v1"],
  { revalidate: 21_600, tags: ["deliverability"] },
);

/**
 * Mesures par pays pour un service. Renvoie une Map vide si l'API refuse —
 * aucun appelant ne doit casser parce qu'une statistique manque.
 */
export async function mesuresParPays(
  service: string,
): Promise<Map<string, PaysMesure>> {
  try {
    const liste = await lire(service);
    return new Map(liste.map((p) => [p.country, p]));
  } catch (e) {
    console.error("[délivrabilité] lecture échouée :", (e as Error).message);
    return new Map();
  }
}

/** Opérateurs à ne jamais demander : revente/VoIP, et le « any » générique. */
const EXCLUS = new Set([
  "any",
  "generic_mobile",
  "ezmobile",
  "talk_telecom",
  "teleena",
  "plintron",
  "tata_communications",
  "textnow",
]);

/** Taux minimal pour qu'un opérateur mérite d'être imposé. */
const TAUX_MIN = 8;
/** Nombre d'opérateurs réellement tentés avant le repli « au hasard ». */
const MAX_OPERATEURS = 2;

/**
 * Opérateurs à privilégier pour ce pays, d'après les mesures du fournisseur.
 *
 * Renvoie un tableau VIDE dès qu'on n'a pas de mesure fiable : l'achat se
 * fait alors sans contrainte, exactement comme aujourd'hui. On n'impose un
 * opérateur que lorsqu'un chiffre le justifie.
 */
export async function operateursMesures(
  service: string,
  countryCode: string,
): Promise<readonly string[]> {
  const mesures = await mesuresParPays(service);
  const pays = mesures.get(countryCode);
  if (!pays) return [];

  const retenus = pays.operators.filter(
    (o) => !EXCLUS.has(o.code) && o.successRate >= TAUX_MIN,
  );
  /* Un seul opérateur mesuré qui ne fait pas mieux que la moyenne du pays
     n'apporte rien : l'imposer, c'est réduire le stock disponible sans
     gagner en réussite. */
  const utiles = retenus.filter((o) => o.successRate > pays.successRate);
  return (utiles.length ? utiles : retenus)
    .slice(0, MAX_OPERATEURS)
    .map((o) => o.code);
}
