import "server-only";
import { env } from "@/lib/env";
import { acckit, type AccProduct } from "./client";

/**
 * Catalogue AccKit, FILTRÉ selon la sélection demandée : TikTok US uniquement
 * (les produits Japon/Vietnam de la catégorie sont exclus), Facebook clones
 * « FB 1000X - 61xx » et « Clone Instagram ». Les ~30 autres catégories
 * AccKit sont masquées.
 *
 * Cache 5 min (la doc recommande une synchro toutes les 5-10 min). Stock à
 * 0 = produit masqué par AccKit, donc par nous. En cas de panne AccKit on
 * sert la dernière version connue plutôt qu'une page vide.
 */

/* Ordre d'affichage = ordre de cette liste. categoryIds = IDs AccKit. */
const SECTIONS: {
  label: string;
  categoryIds: number[];
  filter?: (p: AccProduct) => boolean;
}[] = [
  {
    label: "TikTok US",
    categoryIds: [328],
    filter: (p) => /\bUS\b|USA/i.test(p.name ?? ""),
  },
  { label: "Facebook — Clones 1000X / 61xx", categoryIds: [236] },
  { label: "Instagram — Clones", categoryIds: [327] },
];

export interface CatalogProduct extends AccProduct {
  priceXof: number; // prix public, F CFA
}

export interface CatalogSection {
  label: string;
  products: CatalogProduct[];
}

/** Prix public F CFA : coût VND converti + bénéfice fixe, arrondi, plancher. */
export function accountPriceXof(priceVnd: number): number {
  const costXof = priceVnd / env.acckit.vndPerXof;
  const price = costXof + env.acckit.profitXof;
  const round = env.pricing.roundToXof;
  const rounded =
    round > 0 ? Math.ceil(price / round) * round : Math.ceil(price);
  return Math.max(rounded, env.pricing.minPriceXof);
}

let cache: { at: number; data: CatalogSection[] } | null = null;
const TTL = 5 * 60_000;

export async function getCatalog(force = false): Promise<CatalogSection[]> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data;
  try {
    const cats = await acckit.categories();
    const byId = new Map(cats.map((c) => [c.id, c]));
    const data = SECTIONS.map((s) => ({
      label: s.label,
      products: s.categoryIds
        .flatMap((id) => byId.get(id)?.list_product ?? [])
        .filter((p) => p.quantity > 0)
        .filter((p) => (s.filter ? s.filter(p) : true))
        .map((p) => ({
          ...p,
          price: Number(p.price) || 0,
          priceXof: accountPriceXof(Number(p.price) || 0),
        })),
    })).filter((s) => s.products.length > 0);
    // Un catalogue vide est suspect (panne partielle) : on garde l'ancien.
    if (data.length > 0) cache = { at: Date.now(), data };
    return cache?.data ?? data;
  } catch (e) {
    if (cache) return cache.data;
    throw e;
  }
}

/**
 * Retrouve un produit dans le catalogue FRAIS (appelé à l'achat : prix et
 * stock affichés peuvent être périmés). La recherche est limitée à la
 * sélection : un produit masqué n'est pas vendable, même en devinant son id.
 */
export async function findCatalogProduct(
  idProduct: number,
): Promise<{ category: string; product: CatalogProduct } | null> {
  const sections = await getCatalog(true);
  for (const s of sections) {
    const p = s.products.find((x) => x.id_product === idProduct);
    if (p) return { category: s.label, product: p };
  }
  return null;
}
