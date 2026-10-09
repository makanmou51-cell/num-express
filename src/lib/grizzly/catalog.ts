import { unstable_cache } from "next/cache";
import {
  grizzly,
  type CountryInfo,
  type PriceEntry,
  type PriceV3Entry,
} from "@/lib/grizzly/client";
import { computePublicPriceXof } from "@/lib/pricing";
import { getSettings, type AppSettings } from "@/lib/settings";
import { mesuresParPays } from "@/lib/grizzly/deliverability";
import { mesuresMaison, MIN_VENTES } from "@/lib/grizzly/mesures-maison";
import { isoFromName } from "@/lib/grizzly/flags";
import { env } from "@/lib/env";
import { ONLINESIM_SERVICE_SLUG } from "@/lib/onlinesim/client";
import { getOnlineSimOffers, getOnlineSimOffer } from "@/lib/onlinesim/catalog";

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

/** Services mis en avant dans l'UI, dans l'ordre. WhatsApp d'abord : avec
 *  HeroSMS (numéros non-VoIP frais) il délivre enfin de façon fiable, c'est le
 *  service le plus demandé. Suivent Telegram, Google, Instagram… */
export const FEATURED_SERVICES = [
  "wa",
  "tg",
  "go",
  "ig",
  "ds",
  "fb",
  "tw",
  "wb",
  "ot",
];

/** Services réputés fiables (badge « Fiable » sur la vitrine). */
export const RELIABLE_SERVICES = ["wa", "tg", "go", "ig", "ds"];

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
  // (HeroSMS) Pays « fiable » : beaucoup de numéros PHYSIQUES en ligne → le
  // code arrive quasi à coup sûr. Badge affiché côté client.
  reliable?: boolean;
  /**
   * Taux de réussite mesuré par le fournisseur (%), si disponible.
   *
   * Le badge « Fiable » reposait sur le stock de numéros PHYSIQUES — un
   * mauvais indicateur : les Pays-Bas ont 693 000 numéros, décrochaient le
   * badge, et ne délivrent que 3 % des codes. Ce champ le remplace.
   */
  successRate?: number;
}

// Cache mémoire simple pour la liste des pays (change rarement).
let countriesCache: { at: number; data: Record<string, CountryInfo> } | null =
  null;
const COUNTRIES_TTL = 6 * 60 * 60 * 1000; // 6 h

/** Tag de révalidation à la demande pour la liste des pays. */
export const COUNTRIES_TAG = "herosms-countries";

/**
 * Lève si la liste revient vide : `unstable_cache` ne mémorise pas les rejets,
 * donc un incident fournisseur n'est pas figé 6 h.
 */
async function fetchCountries(): Promise<Record<string, CountryInfo>> {
  const data = await grizzly.getCountries();
  if (!data || !Object.keys(data).length) {
    throw new Error("HeroSMS: liste de pays vide");
  }
  return data;
}

// Data Cache de Next : survit aux cold starts serverless, contrairement à la
// variable de module seule (qui refaisait l'appel réseau à chaque nouvelle
// lambda, soit juste après le clic sur un service).
const cachedCountries = unstable_cache(fetchCountries, ["herosms:countries"], {
  tags: [COUNTRIES_TAG],
  revalidate: 21600,
});

async function getCountriesCached(): Promise<Record<string, CountryInfo>> {
  if (countriesCache && Date.now() - countriesCache.at < COUNTRIES_TTL) {
    return countriesCache.data;
  }
  const data = await cachedCountries();
  countriesCache = { at: Date.now(), data };
  return data;
}

/**
 * Catalogue des pays disponibles pour un service donné, prix public calculé,
 * trié par prix croissant. Seules les offres avec au moins 1 numéro sont gardées.
 */
export const usingOnlineSim = env.smsProvider === "onlinesim";

/** Vrai quand HeroSMS est le fournisseur actif (protocole sms-activate). */
export const usingHeroSms = env.smsProvider === "herosms";

/** Catalogue via OnlineSim (pas de paliers fournisseur chez eux). */
async function onlineSimCatalog(serviceCode: string): Promise<CatalogOffer[]> {
  const slug = ONLINESIM_SERVICE_SLUG[serviceCode] ?? serviceCode;
  const [offers, settings] = await Promise.all([
    getOnlineSimOffers(slug),
    getSettings(),
  ]);

  const out: CatalogOffer[] = [];
  for (const o of offers) {
    if (o.cost <= 0) continue;
    // OnlineSim rapporte de PETITS stocks réels : on n'applique donc PAS le
    // seuil Grizzly (500), sinon l'Espagne & co disparaissent. On masque
    // seulement les pays sans numéro (count = 0), avec un plancher dédié bas.
    if (o.count <= 0 || o.count < env.pricing.onlineSimMinStock) continue;
    out.push({
      countryCode: o.countryCode,
      countryName: COUNTRY_FR[o.countryEng] ?? o.countryEng,
      iso: isoFromName(o.countryEng),
      providerId: null,
      serviceCode,
      serviceName: serviceLabel(serviceCode),
      rawCost: o.cost,
      count: o.count,
      priceXof: computePublicPriceXof(
        o.cost,
        settings,
        `${serviceCode}:${o.countryCode}`,
      ),
    });
  }
  out.sort((a, b) => a.priceXof - b.priceXof);
  return out;
}

/**
 * Stock retenu pour HeroSMS : le PLUS GRAND entre le stock affiché (`count`)
 * et le physique (`physicalCount`). On NE cache PAS un pays qui a de la dispo :
 * HeroSMS propose ~180 pays, il faut les proposer tous. Le physique reste un
 * bonus de fiabilité mais ne sert pas à filtrer.
 */
/**
 * Stock PHYSIQUE (numéros non-VoIP réellement en ligne) = LE signal de
 * fiabilité HeroSMS : c'est lui qui détermine si le code arrive (testé :
 * Portugal 1022 physiques → code reçu ; Pologne 215 → pas de code). On l'affiche
 * et on trie dessus.
 */
function heroPhysical(entry: PriceEntry): number {
  const p = Number(entry.physicalCount);
  return Number.isFinite(p) && p > 0 ? p : 0;
}

/** Disponibilité brute (physique OU virtuel) — sert juste à ne pas lister un
 *  pays totalement vide. */
function heroAvailable(entry: PriceEntry): number {
  const c = Number(entry.count);
  return Math.max(heroPhysical(entry), Number.isFinite(c) ? Math.max(0, c) : 0);
}

/**
 * Prix public HeroSMS = coût RÉEL converti + bénéfice des RÉGLAGES (admin/DB,
 * modifiable en direct depuis la page Réglages) + micro-variation par pays.
 * Inutile de gonfler le prix : l'API vend toujours le numéro le moins cher
 * (fixedPrice et maxPrice donnent le même), la fiabilité vient du stock
 * PHYSIQUE, pas du prix.
 */
function heroPriceXof(
  rawCost: number,
  settings: AppSettings,
  seed: string,
): number {
  return computePublicPriceXof(rawCost, settings, seed);
}

/**
 * Catalogue via HeroSMS. Même protocole que Grizzly, mais HeroSMS n'expose PAS
 * getPricesV3 (paliers par fournisseur) : on utilise getPrices standard
 * ({ pays: { service: { cost, count, physicalCount } } }). Un seul prix par
 * pays/service — la fiabilité vient des numéros physiques non-VoIP.
 */
async function heroSmsCatalog(serviceCode: string): Promise<CatalogOffer[]> {
  const [prices, countries, settings, mesures, maison] = await Promise.all([
    grizzly.getPrices({ service: serviceCode }),
    getCountriesCached(),
    getSettings(),
    /* Le taux de réussite publié par HeroSMS, par pays. En cache 6 h et
       tolérant à la panne : si la statistique manque, on retombe sur le
       stock physique, exactement comme avant. */
    mesuresParPays(serviceCode),
    mesuresMaison(serviceCode),
  ]);

  const RELIABLE = env.pricing.heroSmsReliablePhysical;
  /* Seuil de fiabilité sur le TAUX. Leur meilleur pays WhatsApp au monde
     plafonne à 33 % : 15 % est donc déjà un très bon pays, et au-dessus de
     ce seuil le client a une chance réelle de recevoir son code. */
  const TAUX_FIABLE = 15;
  const out: CatalogOffer[] = [];
  for (const [countryCode, services] of Object.entries(prices)) {
    const entry = (services as Record<string, PriceEntry>)[serviceCode];
    if (!entry) continue;
    const cost = Number(entry.cost);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    // On garde tout pays disponible ; l'ORDRE et le badge viennent désormais
    // du taux de réussite mesuré, plus du stock. Prix basé sur le coût RÉEL.
    if (heroAvailable(entry) < env.pricing.heroSmsMinStock) continue;
    const physical = heroPhysical(entry);
    /* NOS ventes priment sur les statistiques du fournisseur des qu'on a
       assez de volume. HeroSMS publie un agregat mondial, tous revendeurs
       confondus ; nous avons 1 176 ventes WhatsApp a nous. Elles disent que
       le Portugal delivre a 29,5 % et le Royaume-Uni a 4,2 % — et que les
       clients achetaient surtout le second. En dessous de MIN_VENTES, notre
       chiffre n'est pas significatif et on retombe sur le fournisseur. */
    const chezNous = maison.get(countryCode);
    const taux =
      chezNous && chezNous.ventes >= MIN_VENTES
        ? chezNous.taux
        : mesures.get(countryCode)?.successRate;
    out.push({
      countryCode,
      countryName: countryLabel(countries[countryCode], countryCode),
      iso: isoFromName(countries[countryCode]?.eng),
      providerId: null,
      serviceCode,
      serviceName: serviceLabel(serviceCode),
      rawCost: cost,
      count: physical,
      successRate: taux,
      // Le taux mesuré prime ; le stock physique ne sert plus que de repli.
      reliable: taux !== undefined ? taux >= TAUX_FIABLE : physical >= RELIABLE,
      priceXof: heroPriceXof(cost, settings, `${serviceCode}:${countryCode}`),
    });
  }
  /* TRI : le taux de réussite d'abord, le stock ensuite.
     L'ancien tri par stock mettait les Pays-Bas (693 000 numéros, 3 % de
     réussite réelle) en tête AVEC un badge « Fiable », et enterrait le
     Canada (60 % mesuré chez nous, vendu 5 fois). Les clients suivent ce que
     le site leur présente : 508 de nos 864 ventes sont parties vers nos
     trois PIRES pays. Les pays sans mesure gardent l'ancien comportement et
     se classent après ceux dont on sait qu'ils délivrent. */
  out.sort(
    (a, b) =>
      (b.successRate ?? -1) - (a.successRate ?? -1) ||
      b.count - a.count ||
      a.priceXof - b.priceXof,
  );
  return out;
}

/** Offre exacte (service, pays) via HeroSMS — reconfirmée à l'achat. */
async function heroSmsOffer(
  serviceCode: string,
  countryCode: string,
): Promise<CatalogOffer | null> {
  const [prices, countries, settings] = await Promise.all([
    grizzly.getPrices({ service: serviceCode, country: countryCode }),
    getCountriesCached(),
    getSettings(),
  ]);
  const entry = prices[countryCode]?.[serviceCode];
  if (!entry) return null;
  const cost = Number(entry.cost);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  const physical = heroPhysical(entry);
  return {
    countryCode,
    countryName: countryLabel(countries[countryCode], countryCode),
    iso: isoFromName(countries[countryCode]?.eng),
    providerId: null,
    serviceCode,
    serviceName: serviceLabel(serviceCode),
    rawCost: cost,
    count: physical,
    reliable: physical >= env.pricing.heroSmsReliablePhysical,
    priceXof: heroPriceXof(cost, settings, `${serviceCode}:${countryCode}`),
  };
}

export async function getCatalogForService(
  serviceCode: string,
): Promise<CatalogOffer[]> {
  if (usingHeroSms) return heroSmsCatalog(serviceCode);
  if (usingOnlineSim) return onlineSimCatalog(serviceCode);
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
  if (usingHeroSms) return heroSmsOffer(serviceCode, countryCode);
  if (usingOnlineSim) {
    const slug = ONLINESIM_SERVICE_SLUG[serviceCode] ?? serviceCode;
    const [o, settings] = await Promise.all([
      getOnlineSimOffer(slug, countryCode),
      getSettings(),
    ]);
    if (!o || o.cost <= 0) return null;
    return {
      countryCode,
      countryName: COUNTRY_FR[o.countryEng] ?? o.countryEng,
      iso: isoFromName(o.countryEng),
      providerId: null,
      serviceCode,
      serviceName: serviceLabel(serviceCode),
      rawCost: o.cost,
      count: o.count,
      priceXof: computePublicPriceXof(
        o.cost,
        settings,
        `${serviceCode}:${countryCode}`,
      ),
    };
  }
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
