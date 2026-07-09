import { grizzly, type CountryInfo } from "@/lib/grizzly/client";
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

export interface CatalogOffer {
  countryCode: string;
  countryName: string;
  iso: string | null; // code ISO alpha-2 pour le drapeau (peut être null)
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
    grizzly.getPrices({ service: serviceCode }),
    getCountriesCached(),
    getSettings(),
  ]);

  const offers: CatalogOffer[] = [];
  for (const [countryCode, services] of Object.entries(prices)) {
    const entry = services[serviceCode];
    if (!entry || entry.count <= 0 || entry.cost <= 0) continue;
    offers.push({
      countryCode,
      countryName: countryLabel(countries[countryCode], countryCode),
      iso: isoFromName(countries[countryCode]?.eng),
      serviceCode,
      serviceName: serviceLabel(serviceCode),
      rawCost: entry.cost,
      count: entry.count,
      priceXof: computePublicPriceXof(entry.cost, settings),
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
    grizzly.getPrices({ service: serviceCode, country: countryCode }),
    getCountriesCached(),
    getSettings(),
  ]);
  const entry = prices[countryCode]?.[serviceCode];
  if (!entry || entry.count <= 0 || entry.cost <= 0) return null;

  return {
    countryCode,
    countryName: countryLabel(countries[countryCode], countryCode),
    iso: isoFromName(countries[countryCode]?.eng),
    serviceCode,
    serviceName: serviceLabel(serviceCode),
    rawCost: entry.cost,
    count: entry.count,
    priceXof: computePublicPriceXof(entry.cost, settings),
  };
}
