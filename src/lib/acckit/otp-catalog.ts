import "server-only";
import { unstable_cache } from "next/cache";
import { env } from "@/lib/env";
import { computePublicPriceXof } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { otpServices, otpServers } from "./otp";
// Cycle ESM assumé avec grizzly/catalog (qui nous importe pour ses branches
// fournisseur) : sans danger car aucun accès aux bindings au niveau top-level —
// serviceLabel n'est appelé qu'à l'exécution.
import type { CatalogOffer } from "@/lib/grizzly/catalog";
import { serviceLabel } from "@/lib/grizzly/catalog";

/** Vrai quand AccKit est le fournisseur OTP actif (SMS_PROVIDER=acckit). */
export const usingAcckitOtp = env.smsProvider === "acckit";

/** Codes service maison -> slug AccKit. */
export const ACCKIT_SERVICE_SLUG: Record<string, string> = {
  wa: "whatsapp",
  tg: "telegram",
  go: "google",
  ig: "instagram",
  fb: "facebook",
  lf: "tiktok",
  ds: "discord",
  tw: "twitter",
  vi: "viber",
  mm: "microsoft",
  am: "amazon",
  nf: "netflix",
  ub: "uber",
  ya: "yandex",
  wb: "wechat",
  vk: "vkontakte",
  ot: "other",
};

/**
 * Liste CURATÉE de 28 pays (slug AccKit, nom FR, iso).
 *
 * Pourquoi ne pas utiliser GET /countries (194 pays) : l'API n'a pas de vue
 * « tous pays » pour les prix — il faut un appel /services PAR pays, et
 * interroger 194 pays rendrait la page /buy inutilisable (même mise en cache,
 * un rebuild ferait 194 appels). AccKit n'a de toute façon ni France ni USA ;
 * son fort est l'Afrique, l'Asie et l'Amérique latine — exactement la
 * clientèle visée.
 */
const ACCKIT_COUNTRIES: { slug: string; name: string; iso: string }[] = [
  { slug: "benin", name: "Bénin", iso: "bj" },
  { slug: "togo", name: "Togo", iso: "tg" },
  { slug: "ivorycoast", name: "Côte d'Ivoire", iso: "ci" },
  { slug: "senegal", name: "Sénégal", iso: "sn" },
  { slug: "cameroon", name: "Cameroun", iso: "cm" },
  { slug: "ghana", name: "Ghana", iso: "gh" },
  { slug: "nigeria", name: "Nigéria", iso: "ng" },
  { slug: "kenya", name: "Kenya", iso: "ke" },
  { slug: "tanzania", name: "Tanzanie", iso: "tz" },
  { slug: "uganda", name: "Ouganda", iso: "ug" },
  { slug: "southafrica", name: "Afrique du Sud", iso: "za" },
  { slug: "morocco", name: "Maroc", iso: "ma" },
  { slug: "egypt", name: "Égypte", iso: "eg" },
  { slug: "philippines", name: "Philippines", iso: "ph" },
  { slug: "vietnam", name: "Viêt Nam", iso: "vn" },
  { slug: "indonesia", name: "Indonésie", iso: "id" },
  { slug: "india", name: "Inde", iso: "in" },
  { slug: "thailand", name: "Thaïlande", iso: "th" },
  { slug: "malaysia", name: "Malaisie", iso: "my" },
  { slug: "bangladesh", name: "Bangladesh", iso: "bd" },
  { slug: "turkey", name: "Turquie", iso: "tr" },
  { slug: "brazil", name: "Brésil", iso: "br" },
  { slug: "mexico", name: "Mexique", iso: "mx" },
  { slug: "colombia", name: "Colombie", iso: "co" },
  { slug: "argentina", name: "Argentine", iso: "ar" },
  { slug: "peru", name: "Pérou", iso: "pe" },
  { slug: "chile", name: "Chili", iso: "cl" },
];

function countryName(slug: string): string {
  return ACCKIT_COUNTRIES.find((c) => c.slug === slug)?.name ?? `Pays ${slug}`;
}

function countryIso(slug: string): string | null {
  return ACCKIT_COUNTRIES.find((c) => c.slug === slug)?.iso ?? null;
}

/**
 * Réglages de tarification adaptés à AccKit : les coûts sont en VND, on
 * remplace donc le taux USD->XOF des réglages par VND->XOF (1 / vndPerXof).
 * Tranches de bénéfice, arrondi et jitter restent ceux de l'admin.
 */
async function acckitPricing() {
  const settings = await getSettings();
  return { ...settings, fxToXof: 1 / env.acckit.vndPerXof };
}

async function buildCatalog(serviceCode: string): Promise<CatalogOffer[]> {
  const serviceSlug = ACCKIT_SERVICE_SLUG[serviceCode] ?? serviceCode;
  const pricing = await acckitPricing();

  // Un appel /services par pays, en parallèle. Un pays en échec est IGNORÉ :
  // il ne doit pas faire tomber tout le catalogue.
  const rows: (CatalogOffer | null)[] = await Promise.all(
    ACCKIT_COUNTRIES.map(async (c): Promise<CatalogOffer | null> => {
      try {
        const services = await otpServices(c.slug);
        const s = services.find((x) => x.service === serviceSlug);
        if (!s || !(s.price_from > 0) || !(s.qty > 0)) return null;
        return {
          countryCode: c.slug,
          countryName: c.name,
          iso: c.iso,
          providerId: null,
          serviceCode,
          serviceName: serviceLabel(serviceCode),
          rawCost: s.price_from,
          count: s.qty,
          priceXof: computePublicPriceXof(
            s.price_from,
            pricing,
            `${serviceCode}:${c.slug}`,
          ),
        } satisfies CatalogOffer;
      } catch {
        return null;
      }
    }),
  );

  const out = rows.filter((r): r is CatalogOffer => r !== null);
  out.sort((a, b) => a.priceXof - b.priceXof);
  return out;
}

// Data Cache de Next (5 min) : 28 appels fournisseur par rebuild, on ne peut
// pas se permettre de refaire ça à chaque visite de /buy. La clé de cache
// inclut automatiquement l'argument serviceCode — un catalogue par service.
const cachedCatalog = unstable_cache(buildCatalog, ["acckit:catalog"], {
  revalidate: 300,
});

/** Catalogue des pays pour un service, trié par prix croissant (cache 5 min). */
export function getAcckitCatalog(serviceCode: string): Promise<CatalogOffer[]> {
  return cachedCatalog(serviceCode);
}

/**
 * Offre exacte (service, pays) au moment de l'achat — appel FRAIS, jamais de
 * cache : c'est elle qui choisit la ligne serveur à acheter.
 *
 * Choix de la ligne : on écarte les serveurs `ghim` (nouveaux, jamais prouvés)
 * et les lignes sans stock ; on préfère celles dont le taux de réussite mesuré
 * (`ve_rate`) est connu et >= 20 % ; dans le pool retenu on prend la MOINS
 * CHÈRE — la fiabilité est déjà assurée par le filtre, inutile de payer plus.
 */
export async function getAcckitOffer(
  serviceCode: string,
  countrySlug: string,
): Promise<CatalogOffer | null> {
  const serviceSlug = ACCKIT_SERVICE_SLUG[serviceCode] ?? serviceCode;
  const [rows, pricing] = await Promise.all([
    otpServers(countrySlug, serviceSlug),
    acckitPricing(),
  ]);

  const buyables = rows.filter((r) => !r.ghim && r.qty > 0 && r.price > 0);
  const proven = buyables.filter((r) => r.ve_rate != null && r.ve_rate >= 20);
  const pool = proven.length ? proven : buyables;
  if (!pool.length) return null;
  const row = pool.reduce((a, b) => (b.price < a.price ? b : a));

  return {
    countryCode: countrySlug,
    countryName: countryName(countrySlug),
    iso: countryIso(countrySlug),
    // L'opérateur de la ligne choisie, IMPOSÉ au /buy (sinon AccKit sert au
    // hasard parmi tous les serveurs, y compris les moins fiables).
    providerId: row.operator,
    serviceCode,
    serviceName: serviceLabel(serviceCode),
    rawCost: row.price,
    count: row.qty,
    successRate: row.ve_rate ?? undefined,
    // Badge « Fiable » : 45 % mesuré, c'est excellent pour de l'OTP WhatsApp.
    reliable: (row.ve_rate ?? 0) >= 45,
    priceXof: computePublicPriceXof(
      row.price,
      pricing,
      `${serviceCode}:${countrySlug}`,
    ),
  };
}
