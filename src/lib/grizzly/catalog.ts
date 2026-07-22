import {
  grizzly,
  type CountryInfo,
  type PriceV3Entry,
} from "@/lib/grizzly/client";
import { computePublicPriceXof } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { isoFromName } from "@/lib/grizzly/flags";

/** Codes de services populaires -> libellé affiché. */
export const SERVICE_LABELS: Record<string, string> = {
  wa: "WhatsApp",
  tg: "Telegram",
  ig: "Instagram",
  fb: "Facebook",
  go: "Google / Gmail",
  vi: "Viber",
  tw: "Twitter / X",
  ds: "Discord",
  mm: "Microsoft",
  am: "Amazon",
  nf: "Netflix",
  ub: "Uber",
  ya: "Yandex",
  lf: "TikTok",
  wb: "WeChat",
  vk: "VKontakte",
  ot: "Autre service",
};

/** Services mis en avant dans l'UI, dans l'ordre. */
export const FEATURED_SERVICES = [
  "wa",
  "tg",
  "ig",
  "fb",
  "go",
  "tw",
  "ds",
  "ot",
];

/** Quelques noms de pays en français (sinon on retombe sur le libellé anglais). */
const COUNTRY_FR: Record<string, string> = {
  Russia: "Russie",
  Ukraine: "Ukraine",
  Kazakhstan: "Kazakhstan",
  "United States": "États-Unis",
  "United Kingdom": "Royaume-Uni",
  Germany: "Allemagne",
  France: "France",
  Spain: "Espagne",
  Italy: "Italie",
  Canada: "Canada",
  Brazil: "Brésil",
  India: "Inde",
  Indonesia: "Indonésie",
  Nigeria: "Nigéria",
  "South Africa": "Afrique du Sud",
  Morocco: "Maroc",
  Senegal: "Sénégal",
  "Ivory Coast": "Côte d'Ivoire",
  Benin: "Bénin",
  Togo: "Togo",
  Turkey: "Turquie",
  Poland: "Pologne",
  Netherlands: "Pays-Bas",
  Belgium: "Belgique",
  Portugal: "Portugal",
  Philippines: "Philippines",
  Malaysia: "Malaisie",
  Kenya: "Kenya",
  Vietnam: "Viêt Nam",
  Egypt: "Égypte",
  Mexico: "Mexique",
  Argentina: "Argentine",
  Colombia: "Colombie",
};

export function serviceLabel(code: string): string {
  return SERVICE_LABELS[code] ?? code.toUpperCase();
}

function countryLabel(info?: CountryInfo, code?: string): string {
  const eng = info?.eng;
  if (eng && COUNTRY_FR[eng]) return COUNTRY_FR[eng];
  return eng ?? info?.rus ?? `Pays ${code ?? "?"}`;
}

interface Tier {
  id: string | null; // provider_id (null = pas de détail fournisseur)
  price: number;
  count: number;
}

/** Paliers (fournisseurs) d'une entrée V3, triés du moins cher au plus cher. */
function tiersFromEntry(entry: PriceV3Entry): Tier[] {
  const providers = entry.providers;
  if (providers) {
    const tiers: Tier[] = [];
    for (const [key, p] of Object.entries(providers)) {
      const prices = (Array.isArray(p.price) ? p.price : [p.price])
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0);
      const count = Number(p.count);
      if (!prices.length || !Number.isFinite(count) || count <= 0) continue;
      tiers.push({
        id: String(p.provider_id ?? key),
        price: Math.max(...prices),
        count,
      });
    }
    if (tiers.length) return tiers.sort((a, b) => a.price - b.price);
  }
  // Pas de détail fournisseur : palier unique, aucun ciblage possible.
  const price = Number(entry.price);
  const count = Number(entry.count);
  if (!Number.isFinite(price) || price <= 0) return [];
  if (!Number.isFinite(count) || count <= 0) return [];
  return [{ id: null, price, count }];
}

/**
 * Choisit le FOURNISSEUR visé (imposé ensuite via `providerIds`).
 *
 * `maxPrice` seul ne sert à rien : c'est un simple plafond, Grizzly choisit
 * quand même le fournisseur qu'il veut. Il faut donc cibler explicitement.
 *
 * On ne retient que les fournisseurs ayant un stock réel (`minProviderStock`) :
 * viser aveuglément le plus cher tomberait souvent sur un lot de 20 numéros
 * épuisé aussitôt. Parmi ceux-là, `tierLevel` choisit (1 = le plus cher).
 */
function chooseTier(
  tiers: Tier[],
  tierLevel: number,
  minProviderStock: number,
): { cost: number; count: number; providerId: string | null } | null {
  if (!tiers.length) return null;
  const solid = tiers.filter((t) => t.count >= minProviderStock);
  // Aucun fournisseur solide : on prend celui qui a le plus gros stock.
  const pool = solid.length
    ? solid
    : [tiers.reduce((a, b) => (b.count > a.count ? b : a))];
  const lvl = Math.min(1, Math.max(0, tierLevel));
  const pick = pool[Math.round((pool.length - 1) * lvl)];
  return { cost: pick.price, count: pick.count, providerId: pick.id };
}

export interface CatalogOffer {
  countryCode: string;
  countryName: string;
  iso: string | null; // code ISO alpha-2 pour le drapeau (peut être null)
  providerId: string | null; // fournisseur imposé à l'achat (null = au choix)
  serviceCode: string;
  serviceName: string;
  rawCost: number; // coût brut fournisseur
  count: number; // numéros disponibles
  priceXof: number; // prix public marge incluse
}

// Cache mémoire simple pour la liste des pays (change rarement).
let countriesCache: { at: number; data: Record<string, CountryInfo> } | null =
  null;
const COUNTRIES_TTL = 6 * 60 * 60 * 1000; // 6 h

async function getCountriesCached(): Promise<Record<string, CountryInfo>> {
  if (countriesCache && Date.now() - countriesCache.at < COUNTRIES_TTL) {
    return countriesCache.data;
  }
  const data = await grizzly.getCountries();
  countriesCache = { at: Date.now(), data };
  return data;
}

/**
 * Catalogue des pays disponibles pour un service donné, prix public calculé,
 * trié par prix croissant. Seules les offres avec au moins 1 numéro sont gardées.
 */
export async function getCatalogForService(
  serviceCode: string,
): Promise<CatalogOffer[]> {
  const [prices, countries, settings] = await Promise.all([
    grizzly.getPricesV3({ service: serviceCode }),
    getCountriesCached(),
    getSettings(),
  ]);

  const offers: CatalogOffer[] = [];
  for (const [countryCode, services] of Object.entries(prices)) {
    const entry = services[serviceCode];
    if (!entry) continue;
    const tiers = tiersFromEntry(entry);
    // Fiabilité : on n'expose pas les pays au stock trop faible — ce sont ceux
    // dont le code SMS n'arrive pas (numéros en fin de vie côté fournisseur).
    const total = tiers.reduce((sum, t) => sum + t.count, 0);
    if (total < settings.minStockCount) continue;
    const chosen = chooseTier(
      tiers,
      settings.tierLevel,
      settings.minProviderStock,
    );
    if (!chosen) continue;
    offers.push({
      countryCode,
      countryName: countryLabel(countries[countryCode], countryCode),
      iso: isoFromName(countries[countryCode]?.eng),
      providerId: chosen.providerId,
      serviceCode,
      serviceName: serviceLabel(serviceCode),
      rawCost: chosen.cost,
      count: chosen.count,
      priceXof: computePublicPriceXof(
        chosen.cost,
        settings,
        `${serviceCode}:${countryCode}`,
      ),
    });
  }

  offers.sort((a, b) => a.priceXof - b.priceXof);
  return offers;
}

/**
 * Récupère l'offre exacte pour un couple (service, pays) — utilisé au moment
 * de l'achat pour reconfirmer prix et disponibilité côté serveur.
 */
export async function getOffer(
  serviceCode: string,
  countryCode: string,
): Promise<CatalogOffer | null> {
  const [prices, countries, settings] = await Promise.all([
    grizzly.getPricesV3({ service: serviceCode, country: countryCode }),
    getCountriesCached(),
    getSettings(),
  ]);
  const entry = prices[countryCode]?.[serviceCode];
  if (!entry) return null;
  const chosen = chooseTier(
    tiersFromEntry(entry),
    settings.tierLevel,
    settings.minProviderStock,
  );
  if (!chosen) return null;

  return {
    countryCode,
    countryName: countryLabel(countries[countryCode], countryCode),
    iso: isoFromName(countries[countryCode]?.eng),
    providerId: chosen.providerId,
    serviceCode,
    serviceName: serviceLabel(serviceCode),
    rawCost: chosen.cost,
    count: chosen.count,
    priceXof: computePublicPriceXof(
      chosen.cost,
      settings,
      `${serviceCode}:${countryCode}`,
    ),
  };
}
