import type { AppSettings } from "@/lib/settings";

type PricingParams = Pick<
  AppSettings,
  | "fxToXof"
  | "tier1MaxXof"
  | "tier1ProfitXof"
  | "tier2MaxXof"
  | "tier2ProfitXof"
  | "tier3ProfitXof"
  | "roundToXof"
  | "minPriceXof"
>;

/** Bénéfice fixe appliqué selon la tranche de coût (F CFA). */
export function profitForCostXof(costXof: number, p: PricingParams): number {
  if (costXof < p.tier1MaxXof) return p.tier1ProfitXof;
  if (costXof <= p.tier2MaxXof) return p.tier2ProfitXof;
  return p.tier3ProfitXof;
}

/**
 * Prix public F CFA = coût converti + bénéfice fixe de la tranche,
 * arrondi au multiple supérieur et borné par un minimum.
 */
export function computePublicPriceXof(
  rawCost: number,
  p: PricingParams,
): number {
  const costXof = rawCost * p.fxToXof;
  const price = costXof + profitForCostXof(costXof, p);
  const rounded =
    p.roundToXof > 0 ? Math.ceil(price / p.roundToXof) * p.roundToXof : Math.ceil(price);
  return Math.max(rounded, p.minPriceXof);
}

/** Formate un montant en F CFA pour l'affichage. */
export function formatXof(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(amount))} F CFA`;
}
