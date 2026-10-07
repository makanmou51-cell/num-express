import "server-only";
import { prisma } from "@/lib/db";
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
 *    le client est remboursé — mais HeroSMS, lui, ne rembourse que
 *    PARTIELLEMENT (mesuré : 4 achats à 1,665 $, 0,765 $ rendus). Chaque
 *    échec coûte donc quelque chose, et ce quelque chose n'est écrit nulle
 *    part. Le bénéfice affiché est donc légèrement OPTIMISTE.
 *
 * Mieux vaut un chiffre dont on connaît les limites qu'un chiffre rond et
 * faux.
 */

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
      (total, l) => total + l.priceXof - Math.round((l.costRaw ?? 0) * fx),
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
