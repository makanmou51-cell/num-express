import "server-only";
import { env } from "@/lib/env";
import { acckit, type AccProduct } from "./client";

/**
 * Catalogue AccKit mis en cache (5 min — la doc recommande une synchro toutes
 * les 5-10 min). Le stock tombe à 0 = le produit disparaît du catalogue : on
 * filtre, on n'affiche jamais un produit invendable.
 *
 * En cas de panne AccKit, on sert la DERNIÈRE version connue plutôt qu'une
 * page vide : les prix peuvent être légèrement périmés, le /buy final reste
 * l'arbitre (il refuse ce qui n'est plus en vente).
 */

export interface CatalogProduct extends AccProduct {
  priceXof: number; // prix public, F CFA
}

export interface CatalogCategory {
  id: number;
  name: string;
  products: CatalogProduct[];
}

/** Prix public F CFA d'un produit : coût VND converti + marge, arrondi, plancher. */
export function accountPriceXof(priceVnd: number): number {
  const costXof = priceVnd / env.acckit.vndPerXof;
  const price =
    costXof * (1 + env.acckit.marginRate) + env.acckit.marginFixedXof;
  const round = env.pricing.roundToXof;
  const rounded = round > 0 ? Math.ceil(price / round) * round : Math.ceil(price);
  return Math.max(rounded, env.pricing.minPriceXof);
}

let cache: { at: number; data: CatalogCategory[] } | null = null;
const TTL = 5 * 60_000;

export async function getCatalog(force = false): Promise<CatalogCategory[]> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data;
  try {
    const cats = await acckit.categories();
    const data = cats
      .map((c) => ({
        id: c.id,
        name: c.name,
        products: (c.list_product ?? [])
          .filter((p) => p.quantity > 0)
          .map((p) => ({
            ...p,
            price: Number(p.price) || 0,
            priceXof: accountPriceXof(Number(p.price) || 0),
          })),
      }))
      .filter((c) => c.products.length > 0);
    // Un catalogue vide est suspect (panne partielle) : on garde l'ancien.
    if (data.length > 0) cache = { at: Date.now(), data };
    return cache?.data ?? data;
  } catch (e) {
    if (cache) return cache.data;
    throw e;
  }
}

/**
 * Retrouve un produit dans le catalogue FRAIS (appelé à l'achat : le prix et
 * le stock affichés il y a 5 min peuvent avoir changé).
 */
export async function findCatalogProduct(
  idProduct: number,
): Promise<{ category: string; product: CatalogProduct } | null> {
  const cats = await getCatalog(true);
  for (const c of cats) {
    const p = c.products.find((x) => x.id_product === idProduct);
    if (p) return { category: c.name, product: p };
  }
  return null;
}
