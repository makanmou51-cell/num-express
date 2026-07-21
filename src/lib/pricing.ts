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
  | "jitterMaxXof"
>;

/** Bénéfice fixe appliqué selon la tranche de coût (F CFA). */
export function profitForCostXof(costXof: number, p: PricingParams): number {
  if (costXof < p.tier1MaxXof) return p.tier1ProfitXof;
  if (costXof <= p.tier2MaxXof) return p.tier2ProfitXof;
  return p.tier3ProfitXof;
}

/**
 * Micro-variation déterministe (0..maxXof) dérivée d'une graine stable
 * (ex. "service:pays"), via un hash FNV-1a 32 bits. Toujours >= 0 : le bénéfice
 * plancher est préservé, on ne fait qu'ajouter quelques francs pour éviter que
 * des pays au coût de gros identique affichent exactement le même prix public.
 */
function seededJitterXof(seed: string, maxXof: number): number {
  if (maxXof <= 0) return 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % (maxXof + 1);
}

/**
 * Prix public F CFA = coût converti + bénéfice fixe de la tranche
 * (+ micro-variation par pays si une graine est fournie),
 * arrondi au multiple supérieur et borné par un minimum.
 *
 * La graine doit être STABLE et identique à l'affichage et à l'achat
 * (même couple service/pays) pour que le prix montré == prix débité.
 */
export function computePublicPriceXof(
  rawCost: number,
  p: PricingParams,
  seed?: string,
): number {
  const costXof = rawCost * p.fxToXof;
  const jitter = seed ? seededJitterXof(seed, p.jitterMaxXof) : 0;
  const price = costXof + profitForCostXof(costXof, p) + jitter;
  const rounded =
    p.roundToXof > 0
      ? Math.ceil(price / p.roundToXof) * p.roundToXof
      : Math.ceil(price);
  return Math.max(rounded, p.minPriceXof);
}

/** Formate un montant en F CFA pour l'affichage. */
export function formatXof(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(amount))} F CFA`;
}
