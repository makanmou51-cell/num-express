import "server-only";
import { unstable_cache } from "next/cache";
import { env } from "@/lib/env";
import { computePublicPriceXof } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { otpServices, otpServers, otpCountries } from "./otp";
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
 * Noms francais pour les pays les plus vendus. Tout le reste prend le nom
 * anglais renvoye par AccKit — mieux vaut un nom anglais qu un pays absent.
 *
 * La liste des pays n est PLUS figee ici. Elle l etait, limitee a 28 entrees,
 * au motif qu AccKit « n a de toute facon ni France ni USA ». C etait vrai
 * pour la France, et faux pour le reste : mesure du 29 octobre, 184 pays ont
 * du stock WhatsApp, dont le Portugal, l Espagne, l Allemagne, la Grece, les
 * Pays-Bas, l Angleterre et la Pologne — precisement ce que nos clients
 * achetent. Les clients ne voyaient que 27 pays sur 184.
 */
const NOMS_FR: Record<string, string> = {
  benin: "Bénin",
  togo: "Togo",
  ivorycoast: "Côte d'Ivoire",
  senegal: "Sénégal",
  cameroon: "Cameroun",
  ghana: "Ghana",
  nigeria: "Nigéria",
  kenya: "Kenya",
  tanzania: "Tanzanie",
  uganda: "Ouganda",
  southafrica: "Afrique du Sud",
  morocco: "Maroc",
  egypt: "Égypte",
  philippines: "Philippines",
  vietnam: "Viêt Nam",
  indonesia: "Indonésie",
  india: "Inde",
  thailand: "Thaïlande",
  malaysia: "Malaisie",
  bangladesh: "Bangladesh",
  turkey: "Turquie",
  brazil: "Brésil",
  mexico: "Mexique",
  colombia: "Colombie",
  argentina: "Argentine",
  peru: "Pérou",
  chile: "Chili",
  portugal: "Portugal",
  spain: "Espagne",
  germany: "Allemagne",
  greece: "Grèce",
  netherlands: "Pays-Bas",
  england: "Royaume-Uni",
  poland: "Pologne",
  austria: "Autriche",
  belgium: "Belgique",
  ireland: "Irlande",
  sweden: "Suède",
  finland: "Finlande",
  denmark: "Danemark",
  croatia: "Croatie",
  italy: "Italie",
  usa: "USA",
  canada: "Canada",
  switzerland: "Suisse",
  norway: "Norvège",
};

/* La liste des pays bouge rarement : on la garde une journee. */
const listePays = unstable_cache(otpCountries, ["acckit:countries"], {
  revalidate: 86_400,
});

function countryName(slug: string, nomApi?: string): string {
  return NOMS_FR[slug] ?? nomApi ?? `Pays ${slug}`;
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

  /* Un appel /services par pays. L API n a pas de vue « tous pays », il faut
     donc 194 appels — d ou la concurrence bornee et le cache d une heure.
     TRENTE en parallele, pas plus : mesure du 29 octobre, 30 donne 23 s et
     des resultats complets, 60 descend a 7 s mais l API limite le debit et ne
     renvoie plus que 54 pays sur 184. Vite et faux est pire que lent.
     Un pays en echec est IGNORE : il ne doit pas faire tomber le catalogue. */
  const pays = await listePays();
  const rows: (CatalogOffer | null)[] = [];
  const LOT = 30;
  for (let i = 0; i < pays.length; i += LOT) {
    const bloc = await Promise.all(
      pays.slice(i, i + LOT).map(async (c): Promise<CatalogOffer | null> => {
      try {
        const services = await otpServices(c.country);
        const s = services.find((x) => x.service === serviceSlug);
        if (!s || !(s.price_from > 0) || !(s.qty > 0)) return null;
        return {
          countryCode: c.country,
          countryName: countryName(c.country, c.name),
          iso: c.iso || null,
          providerId: null,
          serviceCode,
          serviceName: serviceLabel(serviceCode),
          rawCost: s.price_from,
          count: s.qty,
          priceXof: computePublicPriceXof(
            s.price_from,
            pricing,
            `${serviceCode}:${c.country}`,
          ),
        } satisfies CatalogOffer;
      } catch {
        return null;
      }
      }),
    );
    rows.push(...bloc);
  }

  const out = rows.filter((r): r is CatalogOffer => r !== null);
  out.sort((a, b) => a.priceXof - b.priceXof);
  return out;
}

// Data Cache de Next (5 min) : 28 appels fournisseur par rebuild, on ne peut
// pas se permettre de refaire ça à chaque visite de /buy. La clé de cache
// inclut automatiquement l'argument serviceCode — un catalogue par service.
/* Une heure, et non cinq minutes : un rebuild coute desormais 194 appels et
   une vingtaine de secondes. Next sert la version precedente pendant qu il
   reconstruit, donc un seul visiteur par heure peut attendre — et seulement
   apres un deploiement. */
const cachedCatalog = unstable_cache(buildCatalog, ["acckit:catalog"], {
  revalidate: 3600,
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
    iso: null,
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
