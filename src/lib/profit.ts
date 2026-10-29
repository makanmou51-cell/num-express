import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";

/**
 * Bénéfice réel de num express.
 *
 * ── Pourquoi ce n'est PAS le chiffre d'affaires ─────────────────────────
 * L'argent encaissé n'est pas gagné : une partie dort encore sur les soldes
 * des clients (c'est une dette, pas un bénéfice), et sur chaque vente il faut
 * retrancher ce qu'on a payé au fournisseur. Un client qui recharge 10 000 F
 * et n'achète rien n'a rien rapporté — il a seulement prêté.
 *
 * On calcule donc la marge sur ce qui a été RÉELLEMENT LIVRÉ :
 *
 *     bénéfice = Σ (prix client − coût fournisseur) sur les ventes non
 *                remboursées, moins les commissions de parrainage versées
 *
 * ── Ce que ce chiffre ne contient PAS, et il faut le savoir ─────────────
 *
 * 1. LA MARGE BOOST. Les prix Boost sont fixés à la main dans le catalogue
 *    (`pricePer1000Xof`), ils ne dérivent pas d'un coût Peakerr enregistré.
 *    Impossible de retrouver ce qu'une commande a coûté. Son chiffre
 *    d'affaires est donc affiché à part, sans marge.
 *
 * 2. LE COÛT DES VENTES REMBOURSÉES. Quand un numéro ne reçoit pas son code,
 *    le client est remboursé — mais HeroSMS, lui, ne remboursait que
 *    PARTIELLEMENT (mesuré : 4 achats à 1,665 $, 0,765 $ rendus). Chaque
 *    échec coûtait donc quelque chose, et ce quelque chose n'est écrit nulle
 *    part. Le bénéfice affiché est donc légèrement OPTIMISTE sur cette
 *    période. (1001SMS, lui, rembourse intégralement — vérifié.)
 *
 * Mieux vaut un chiffre dont on connaît les limites qu'un chiffre rond et
 * faux.
 */

/**
 * Coût d'une vente, converti en F CFA.
 *
 * ── Le bug que ça corrige ───────────────────────────────────────────────
 * `costRaw` est le coût BRUT du fournisseur, dans SA devise. Grizzly, HeroSMS
 * et 1001SMS facturent en dollars ; AccKit facturait en DONGS vietnamiens.
 * La version précédente appliquait le taux du dollar (620 F) à tout le monde.
 *
 * Résultat le 29 octobre : une seule vente AccKit — Roumanie, 44 184 dongs,
 * soit 1 052 F — était comptée 44 184 × 620 = 27 394 080 F de coût. Le tableau
 * de bord affichait un bénéfice de MOINS 68 millions de francs sur un chiffre
 * d'affaires de 618 100 F. Trois ventes suffisaient à rendre la page absurde.
 *
 * ── Pourquoi un seuil, et pas une colonne « fournisseur » ───────────────
 * Aucune colonne n'enregistre qui a vendu le numéro, et les ventes passées ne
 * peuvent plus le dire. Mais les deux devises ne se chevauchent pas, de très
 * loin : un coût fournisseur en dollars va de 0,22 à 30 ; en dongs il part de
 * 5 000. Mille est donc un seuil large, au milieu d'un vide complet.
 *
 * AccKit étant retiré de la vente de numéros, aucune nouvelle ligne en dongs
 * ne sera écrite : ce code ne sert plus qu'à lire correctement les trois
 * ventes des 28 et 29 octobre.
 */
const SEUIL_DONGS = 1000;

export function coutEnXof(costRaw: number | null, fxUsd: number, vndParXof: number): number {
  const brut = costRaw ?? 0;
  if (brut <= 0) return 0;
  return Math.round(brut >= SEUIL_DONGS ? brut / vndParXof : brut * fxUsd);
}

export interface Profit {
  /** Marge sur les numéros livrés (prix client − coût fournisseur). */
  margeNumeros: number;
  /** Marge sur les locations livrées. */
  margeLocations: number;
  /** Commissions de parrainage versées (à retrancher). */
  commissions: number;
  /** Bénéfice net : marges − commissions. */
  net: number;
  /** Chiffre d'affaires Boost, dont la marge n'est pas calculable. */
  caBoost: number;
  /** Ventes remboursées — leur coût réel est inconnu (voir ci-dessus). */
  ventesRemboursees: number;
}

export async function getProfit(): Promise<Profit> {
  const settings = await getSettings();
  const fx = settings.fxToXof;

  const [numeros, locations, commissionAgg, boostAgg, remboursees] =
    await Promise.all([
      /* Seules les activations NON remboursées ont rapporté quelque chose :
         une vente remboursée rend l'intégralité au client, sa recette est
         nulle. */
      prisma.activation.findMany({
        where: { refunded: false, costRaw: { not: null } },
        select: { priceXof: true, costRaw: true },
      }),
      prisma.rental.findMany({
        where: { status: { not: "CANCELLED" }, costRaw: { not: null } },
        select: { priceXof: true, costRaw: true },
      }),
      prisma.transaction.aggregate({
        where: { type: "REFERRAL" },
        _sum: { amount: true },
      }),
      prisma.boostOrder.aggregate({
        where: { refunded: false },
        _sum: { priceXof: true },
      }),
      prisma.activation.count({ where: { refunded: true } }),
    ]);

  const marge = (
    lignes: Array<{ priceXof: number; costRaw: number | null }>,
  ): number =>
    lignes.reduce(
      (total, l) =>
        total + l.priceXof - coutEnXof(l.costRaw, fx, env.acckit.vndPerXof),
      0,
    );

  const margeNumeros = marge(numeros);
  const margeLocations = marge(locations);
  const commissions = commissionAgg._sum.amount ?? 0;

  return {
    margeNumeros,
    margeLocations,
    commissions,
    net: margeNumeros + margeLocations - commissions,
    caBoost: boostAgg._sum.priceXof ?? 0,
    ventesRemboursees: remboursees,
  };
}
