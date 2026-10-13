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

/* ── Les pays MORTS ────────────────────────────────────────────────────
   Classer un mauvais pays en bas de liste ne suffit pas quand il ne delivre
   plus RIEN. Mesure du 10 octobre : l Italie, 49 ventes WhatsApp en 30 jours,
   ZERO code recu, 140 $ engages chez HeroSMS. Le client est rembourse, mais
   HeroSMS ne nous rembourse que partiellement : chaque vente nous coute de
   l argent ET la confiance du client.
   On utilise une fenetre COURTE : un pays peut mourir du jour au lendemain si
   le fournisseur change de pool, et la moyenne sur 120 jours masquerait la
   rupture. Il suffit que le pays redelivre pour qu il revienne tout seul. */
const FENETRE_MORT_JOURS = 30;
const MIN_VENTES_MORT = 40;

async function calculerPaysMorts(serviceCode: string): Promise<string[]> {
  const depuis = new Date(Date.now() - FENETRE_MORT_JOURS * 86_400_000);
  const base = { serviceCode, createdAt: { gte: depuis } };
  const [total, recus] = await Promise.all([
    prisma.activation.groupBy({ by: ["countryCode"], where: base, _count: { _all: true } }),
    prisma.activation.groupBy({
      by: ["countryCode"],
      where: { ...base, smsCode: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const recusPar = new Map(recus.map((r) => [r.countryCode, r._count._all]));
  return total
    .filter((t) => t._count._all >= MIN_VENTES_MORT && (recusPar.get(t.countryCode) ?? 0) === 0)
    .map((t) => t.countryCode);
}

const lireMorts = unstable_cache(calculerPaysMorts, ["pays-morts"], {
  revalidate: 21_600,
  tags: ["mesures-maison"],
});

/** Pays a ne PLUS vendre pour ce service : aucun code livre sur 40 ventes. */
export async function paysMorts(serviceCode: string): Promise<Set<string>> {
  try {
    return new Set(await lireMorts(serviceCode));
  } catch {
    /* Base indisponible : on ne retire rien plutot que de vider le catalogue. */
    return new Set();
  }
}

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

/* ── Opérateurs écartés ───────────────────────────────────────────────────
   HeroSMS publie un taux de réussite par opérateur, et c'est lui qui guide
   notre sélection. Mais ce chiffre est un agrégat mondial : il peut recommander
   un opérateur qui ne délivre rien chez NOS clients.

   Deux niveaux, dans cet ordre :

   1. LA MESURE. Dès qu'un opérateur atteint le seuil de ventes sans livrer un
      seul code, on cesse de l'imposer. C'est le mécanisme durable — il se
      déclenche tout seul et se corrige tout seul.

   2. LA DÉCISION MANUELLE, pour les cas où l'on sait avant d'avoir le volume.
      Chaque entrée porte sa raison et sa date, et doit disparaître dès que la
      mesure prend le relais. Sans cette discipline on retombe sur la carte
      écrite à la main de septembre, qui avait fait chuter les résultats.

   Écarter un opérateur ne retire aucun pays de la vente : on repasse à l'achat
   libre, c'est-à-dire exactement le comportement par défaut. */

const MIN_VENTES_OPERATEUR = 15;

/** Décisions manuelles : code pays HeroSMS -> opérateurs à ne pas imposer. */
const ECARTES_A_LA_MAIN: Record<string, string[]> = {
  /* Italie, 14 octobre 2026. Michael constate que les codes ne sortent pas sur
     vodafone. Nos mesures ne portent que sur 2 ventes — trop peu pour trancher
     statistiquement, mais l'Italie entière plafonne à 4 codes sur 108 et rien
     n'indique que vodafone fasse mieux que l'achat libre. On repasse donc en
     achat libre pour ce pays. À retirer dès que la mesure aura 15 ventes. */
  "86": ["vodafone"],
};

/** `${countryCode}:${operator}` à ne jamais imposer pour ce service. */
export async function operateursEcartes(
  serviceCode: string,
): Promise<Set<string>> {
  const out = new Set<string>();
  for (const [pays, ops] of Object.entries(ECARTES_A_LA_MAIN)) {
    for (const o of ops) out.add(`${pays}:${o}`);
  }
  try {
    for (const k of await lireEcartes(serviceCode)) out.add(k);
  } catch {
    /* Base indisponible : les décisions manuelles s'appliquent quand même. */
  }
  return out;
}

async function calculerEcartes(serviceCode: string): Promise<string[]> {
  const depuis = new Date(Date.now() - FENETRE_JOURS * 86_400_000);
  const base = {
    serviceCode,
    createdAt: { gte: depuis },
    operator: { not: null },
    NOT: { operator: "any" },
  };
  const [total, recus] = await Promise.all([
    prisma.activation.groupBy({
      by: ["countryCode", "operator"],
      where: base,
      _count: { _all: true },
    }),
    prisma.activation.groupBy({
      by: ["countryCode", "operator"],
      where: { ...base, smsCode: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const recusPar = new Map(
    recus.map((r) => [`${r.countryCode}:${r.operator}`, r._count._all]),
  );
  return total
    .filter(
      (t) =>
        t._count._all >= MIN_VENTES_OPERATEUR &&
        (recusPar.get(`${t.countryCode}:${t.operator}`) ?? 0) === 0,
    )
    .map((t) => `${t.countryCode}:${t.operator}`);
}

const lireEcartes = unstable_cache(calculerEcartes, ["operateurs-ecartes"], {
  revalidate: 21_600,
  tags: ["mesures-maison"],
});
