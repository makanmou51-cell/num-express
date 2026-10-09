import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

/**
 * Taux de réception mesurés sur NOS PROPRES VENTES.
 *
 * ── Pourquoi ne pas se contenter des chiffres de HeroSMS ────────────────
 * Le catalogue classait les pays selon la « deliverability » publiée par
 * HeroSMS. Mais ces chiffres sont un agrégat mondial, tous revendeurs
 * confondus, sur des clients qui n'ont ni notre audience ni nos usages. Nos
 * propres ventes disent autre chose, et elles sont nombreuses :
 *
 *     Portugal        17 / 62   = 27 %   ← vendu 1 fois cette semaine
 *     Espagne          6 / 50   = 12 %
 *     France          19 / 173  = 11 %
 *     Royaume-Uni      7 / 153  =  5 %   ← vendu 21 fois cette semaine
 *     Italie           1 / 68   =  1 %   ← vendu 11 fois cette semaine
 *
 * Autrement dit, les clients achetaient massivement les deux pires pays
 * pendant que le meilleur restait invisible. Le Royaume-Uni n'a jamais
 * marché : 5 % sur 153 ventes, ce n'est pas une mauvaise passe, c'est son
 * niveau. Aucune statistique de fournisseur ne nous l'aurait appris.
 *
 * ── Les deux précautions ────────────────────────────────────────────────
 * 1. FENÊTRE GLISSANTE. Un taux vieux d'un an ne dit rien de ce mois-ci, et
 *    nos données contiennent une période antérieure à HeroSMS où les codes
 *    pays suivaient une autre numérotation — les mélanger fausserait tout.
 * 2. ÉCHANTILLON MINIMUM. En dessous, un pays vendu trois fois avec un
 *    succès afficherait 33 % et passerait devant le Portugal. On retombe
 *    alors sur la mesure du fournisseur, qui porte sur beaucoup plus de
 *    volume.
 */

/** On ne regarde que les ventes récentes (voir précaution 1). */
const FENETRE_JOURS = 120;

/** En dessous de ce nombre de ventes, notre taux n'est pas significatif. */
export const MIN_VENTES = 20;

export interface MesureMaison {
  ventes: number;
  recus: number;
  /** Pourcentage, 0–100. */
  taux: number;
}

/** Calcul brut, sans cache — utilisable hors contexte Next.js (diagnostics). */
export async function calculerMesuresMaison(
  serviceCode: string,
): Promise<Map<string, MesureMaison>> {
  const depuis = new Date(Date.now() - FENETRE_JOURS * 86_400_000);
  const base = { serviceCode, createdAt: { gte: depuis } };

  const [total, recus] = await Promise.all([
    prisma.activation.groupBy({
      by: ["countryCode"],
      where: base,
      _count: { _all: true },
    }),
    prisma.activation.groupBy({
      by: ["countryCode"],
      where: { ...base, smsCode: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const recusPar = new Map(recus.map((r) => [r.countryCode, r._count._all]));
  const out = new Map<string, MesureMaison>();
  for (const t of total) {
    const ventes = t._count._all;
    const r = recusPar.get(t.countryCode) ?? 0;
    out.set(t.countryCode, { ventes, recus: r, taux: (r / ventes) * 100 });
  }
  return out;
}

/**
 * Version mise en cache 6 h. Le classement du catalogue n'a aucune raison
 * d'être recalculé à chaque affichage : il bouge au rythme des ventes, pas
 * des visites.
 */
const lire = unstable_cache(
  async (serviceCode: string) => {
    const m = await calculerMesuresMaison(serviceCode);
    /* unstable_cache sérialise en JSON : une Map ne survit pas au passage. */
    return Object.fromEntries(m);
  },
  ["mesures-maison"],
  { revalidate: 21_600, tags: ["mesures-maison"] },
);

/** Taux mesurés chez nous, par code pays HeroSMS. */
export async function mesuresMaison(
  serviceCode: string,
): Promise<Map<string, MesureMaison>> {
  try {
    const obj = await lire(serviceCode);
    return new Map(Object.entries(obj));
  } catch {
    /* Base indisponible : on rend une carte vide et le catalogue retombe sur
       les mesures du fournisseur. Jamais de page en erreur pour ça. */
    return new Map();
  }
}
