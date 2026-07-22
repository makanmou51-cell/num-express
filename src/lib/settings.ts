import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/** Réglages applicatifs, valeurs .env par défaut, surchargées par la table Setting. */
export interface AppSettings {
  fxToXof: number;
  tier1MaxXof: number;
  tier1ProfitXof: number;
  tier2MaxXof: number;
  tier2ProfitXof: number;
  tier3ProfitXof: number;
  roundToXof: number;
  minPriceXof: number;
  jitterMaxXof: number; // micro-variation par pays (0 = désactivé)
  maxPriceBuffer: number; // marge au-dessus du prix « from » à l'achat (0.5 = +50 %)
  minStockCount: number; // stock minimum pour proposer un pays
  commissionRate: number; // 0..1
}

export const SETTING_KEYS: (keyof AppSettings)[] = [
  "fxToXof",
  "tier1MaxXof",
  "tier1ProfitXof",
  "tier2MaxXof",
  "tier2ProfitXof",
  "tier3ProfitXof",
  "roundToXof",
  "minPriceXof",
  "jitterMaxXof",
  "maxPriceBuffer",
  "minStockCount",
  "commissionRate",
];

function defaults(): AppSettings {
  return {
    fxToXof: env.pricing.fxToXof,
    tier1MaxXof: env.pricing.tier1MaxXof,
    tier1ProfitXof: env.pricing.tier1ProfitXof,
    tier2MaxXof: env.pricing.tier2MaxXof,
    tier2ProfitXof: env.pricing.tier2ProfitXof,
    tier3ProfitXof: env.pricing.tier3ProfitXof,
    roundToXof: env.pricing.roundToXof,
    minPriceXof: env.pricing.minPriceXof,
    jitterMaxXof: env.pricing.jitterMaxXof,
    maxPriceBuffer: env.pricing.maxPriceBuffer,
    minStockCount: env.pricing.minStockCount,
    commissionRate: env.affiliate.commissionRate,
  };
}

let cache: { at: number; data: AppSettings } | null = null;
const TTL = 60_000; // 1 min

export async function getSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;

  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const d = defaults();

  const pick = (k: keyof AppSettings): number => {
    const raw = map.get(k);
    if (raw === undefined) return d[k];
    const n = Number(raw);
    return Number.isFinite(n) ? n : d[k];
  };

  const data: AppSettings = {
    fxToXof: pick("fxToXof"),
    tier1MaxXof: pick("tier1MaxXof"),
    tier1ProfitXof: pick("tier1ProfitXof"),
    tier2MaxXof: pick("tier2MaxXof"),
    tier2ProfitXof: pick("tier2ProfitXof"),
    tier3ProfitXof: pick("tier3ProfitXof"),
    roundToXof: pick("roundToXof"),
    minPriceXof: pick("minPriceXof"),
    jitterMaxXof: pick("jitterMaxXof"),
    maxPriceBuffer: pick("maxPriceBuffer"),
    minStockCount: pick("minStockCount"),
    commissionRate: pick("commissionRate"),
  };
  cache = { at: Date.now(), data };
  return data;
}

export function invalidateSettings() {
  cache = null;
}

export async function updateSettings(patch: Partial<AppSettings>) {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      }),
    ),
  );
  invalidateSettings();
}
