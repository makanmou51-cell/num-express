import "server-only";
import { onlinesim, type OsOffer } from "@/lib/onlinesim/client";

/**
 * OnlineSim ne sait donner les prix que pour UN pays à la fois
 * (getTariffs?country=XX). Pour bâtir le catalogue d'un service il faut donc
 * interroger chaque pays : on parallélise avec une concurrence bornée et on
 * met le résultat en cache, sinon la page /buy serait inutilisable.
 */
const CONCURRENCY = 12;
const TTL_MS = 15 * 60 * 1000; // 15 min

const cache = new Map<string, { at: number; offers: OsOffer[] }>();
// Évite que 10 visiteurs simultanés déclenchent 10 reconstructions.
const inflight = new Map<string, Promise<OsOffer[]>>();

/** Exécute les tâches par lots de `limit`. */
async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

async function build(serviceSlug: string): Promise<OsOffer[]> {
  const countries = await onlinesim.getCountries();

  const rows = await pool(countries, CONCURRENCY, async (c) => {
    try {
      const p = await onlinesim.getServicePrice(serviceSlug, c.code);
      if (!p) return null;
      return {
        countryCode: c.code,
        countryEng: c.eng,
        cost: p.cost,
        count: p.count,
      } satisfies OsOffer;
    } catch {
      // Un pays qui échoue ne doit pas casser tout le catalogue.
      return null;
    }
  });

  return rows.filter((r): r is OsOffer => r !== null);
}

/** Catalogue d'un service, mis en cache 15 min. */
export async function getOnlineSimOffers(
  serviceSlug: string,
): Promise<OsOffer[]> {
  const hit = cache.get(serviceSlug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.offers;

  const running = inflight.get(serviceSlug);
  if (running) return running;

  const p = build(serviceSlug)
    .then((offers) => {
      cache.set(serviceSlug, { at: Date.now(), offers });
      return offers;
    })
    .finally(() => inflight.delete(serviceSlug));

  inflight.set(serviceSlug, p);
  return p;
}

/** Offre d'un pays précis — appel direct (pas de cache) pour l'achat. */
export async function getOnlineSimOffer(
  serviceSlug: string,
  countryCode: string,
): Promise<OsOffer | null> {
  const p = await onlinesim.getServicePrice(serviceSlug, countryCode);
  if (!p) return null;
  const countries = await onlinesim.getCountries();
  const c = countries.find((x) => x.code === countryCode);
  return {
    countryCode,
    countryEng: c?.eng ?? `Pays ${countryCode}`,
    cost: p.cost,
    count: p.count,
  };
}
