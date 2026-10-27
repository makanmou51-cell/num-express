import "server-only";
import { env } from "@/lib/env";

/**
 * Client AccKit — API revendeur (comptes & biens numériques) :
 *   base https://acckit.com/api/v1, clé `api_key` sur CHAQUE appel,
 *   en-tête `Accept: application/json` OBLIGATOIRE — sans lui, les erreurs de
 *   validation arrivent en redirection HTML 302 au lieu d'un JSON 422.
 *   Devise : VND. Échec métier = HTTP 200 {"status": false, "msg": "..."}.
 *
 * Règle d'or de la doc (§7) : /buy n'a PAS de clé d'idempotence. En cas de
 * timeout, d'erreur réseau ou de 5xx sur /buy, on NE RENVOIE JAMAIS la
 * requête — la commande a pu être créée. On réconcilie via /orders.
 */

export class AccKitError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AccKitError";
    this.code = code;
  }
}

function apiKey(): string {
  const key = env.acckit.apiKey;
  if (!key) {
    throw new AccKitError(
      "NO_KEY",
      "ACCKIT_API_KEY manquante. Renseigne ta clé AccKit dans les variables d'environnement.",
    );
  }
  return key;
}

async function parseJson(text: string): Promise<unknown> {
  try {
    return JSON.parse(text);
  } catch {
    throw new AccKitError(
      "PARSE",
      `Réponse AccKit illisible : ${text.slice(0, 120)}`,
    );
  }
}

/** Les échecs métier arrivent en HTTP 200 avec status:false — on les détecte. */
function checkBusinessError(json: unknown): void {
  const j = json as { status?: boolean; msg?: string };
  if (j && j.status === false) {
    throw new AccKitError("API", j.msg || "AccKit a refusé la requête.");
  }
}

async function post<T>(
  path: string,
  fields: Record<string, string | number>,
  timeoutMs = 30_000,
): Promise<T> {
  const body = new URLSearchParams({ api_key: apiKey() });
  for (const [k, v] of Object.entries(fields)) body.set(k, String(v));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${env.acckit.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new AccKitError(
      (e as Error).name === "AbortError" ? "TIMEOUT" : "NETWORK",
      (e as Error).name === "AbortError"
        ? "AccKit n'a pas répondu à temps."
        : `Erreur réseau vers AccKit : ${(e as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }

  const json = await parseJson((await res.text()).trim());
  // 5xx = état inconnu côté fournisseur (comme un timeout) : jamais de retry.
  if (res.status >= 500) throw new AccKitError("HTTP_5XX", `AccKit HTTP ${res.status}`);
  if (res.status === 422) {
    throw new AccKitError("INVALID", "Paramètres refusés par AccKit (422).");
  }
  checkBusinessError(json);
  return json as T;
}

async function get<T>(path: string, timeoutMs = 30_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    const sep = path.includes("?") ? "&" : "?";
    res = await fetch(
      `${env.acckit.baseUrl}${path}${sep}api_key=${encodeURIComponent(apiKey())}`,
      { headers: { Accept: "application/json" }, cache: "no-store", signal: ctrl.signal },
    );
  } catch (e) {
    throw new AccKitError(
      (e as Error).name === "AbortError" ? "TIMEOUT" : "NETWORK",
      (e as Error).name === "AbortError"
        ? "AccKit n'a pas répondu à temps."
        : `Erreur réseau vers AccKit : ${(e as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }
  const json = await parseJson((await res.text()).trim());
  checkBusinessError(json);
  return json as T;
}

export interface AccProduct {
  id_product: number;
  name: string;
  desc: string | null;
  price: number; // prix catalogue, VND (peut être "10000.0")
  quantity: number; // stock
}

export interface AccCategory {
  id: number;
  name: string;
  icon: string | null;
  list_product: AccProduct[];
}

export interface AccOrderLine {
  uid: string;
  full_info: string;
  link_backup?: string;
}

export interface AccOrder {
  id: number;
  quantity: number;
  price: number;
  total_price: number;
  type: string; // nom du produit
  created_at: string;
  data: AccOrderLine[];
  id_product: number;
}

export interface AccOrderSummary {
  id: number;
  quantity: number;
  price: number;
  total_price: number;
  type: string;
  created_at: string;
  id_product: number;
}

export const acckit = {
  /** Catalogue complet : catégories visibles avec leurs produits en vente. */
  async categories(): Promise<AccCategory[]> {
    const j = await get<{ data?: AccCategory[] }>("/categories");
    return j.data ?? [];
  },

  /** Solde du compte AccKit (VND). */
  async balance(): Promise<number> {
    const j = await post<{ balance?: number }>("/balance", {});
    return Number(j.balance) || 0;
  },

  /**
   * Achète `quantity` unités d'un produit. Peut répondre « pending » (débité,
   * livraison plus tard). TIMEOUT/NETWORK/HTTP_5XX = état INCONNU : ne jamais
   * renvoyer, réconcilier via findRecentOrder.
   *
   * Timeout 50 s : au-delà, la fonction Vercel (60 s) mourrait avant qu'on ait
   * enregistré la trace CHECK — c'est elle qui rend la réconciliation possible.
   */
  async buy(
    idProduct: number,
    quantity: number,
  ): Promise<{ orderId: number; pending: boolean; accounts: string[] }> {
    const j = await post<{
      order_id?: number;
      pending?: boolean;
      data?: { full_info?: string }[];
    }>("/buy", { id_product: idProduct, quantity }, 50_000);
    if (!j.order_id) {
      throw new AccKitError("NO_ORDER", "AccKit n'a pas créé la commande.");
    }
    return {
      orderId: j.order_id,
      pending: j.pending === true,
      accounts: (j.data ?? [])
        .map((l) => l.full_info ?? "")
        .filter((s) => s.length > 0),
    };
  },

  /** Une commande avec ses comptes livrés (et le prix réellement facturé). */
  async order(orderId: number): Promise<AccOrder> {
    const j = await post<AccOrder & { status?: boolean }>("/order", {
      order_id: orderId,
    });
    return j;
  },

  /** Historique des commandes, 10 par page, plus récentes d'abord. */
  async orders(page = 1): Promise<AccOrderSummary[]> {
    const j = await post<{ data?: AccOrderSummary[] }>("/orders", { page });
    return j.data ?? [];
  },

  /**
   * Réconciliation après un /buy incertain : retrouve une commande créée vers
   * `since` pour ce produit (marge de 2 min avant, horloges jamais synchros).
   */
  async findRecentOrder(
    idProduct: number,
    since: Date,
  ): Promise<AccOrderSummary | null> {
    const floor = since.getTime() - 2 * 60_000;
    for (const page of [1, 2]) {
      const list = await this.orders(page);
      for (const o of list) {
        if (
          o.id_product === idProduct &&
          new Date(o.created_at).getTime() >= floor
        ) {
          return o;
        }
      }
      if (list.length < 10) break; // plus de page suivante
    }
    return null;
  },
};
