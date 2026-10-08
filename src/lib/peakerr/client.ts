import "server-only";
import { env } from "@/lib/env";

/**
 * Client Peakerr — API standard « Perfect Panel » :
 *   POST https://peakerr.com/api/v2  (x-www-form-urlencoded)
 *   params: key, action, ...
 */

export class PeakerrError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PeakerrError";
    this.code = code;
  }
}

async function call<T>(
  params: Record<string, string | number>,
): Promise<T> {
  const key = env.peakerr.apiKey;
  if (!key) {
    throw new PeakerrError(
      "NO_KEY",
      "PEAKERR_API_KEY manquante. Renseigne ta clé Peakerr dans les variables d'environnement.",
    );
  }
  const body = new URLSearchParams({ key });
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  let text: string;
  try {
    const res = await fetch(env.peakerr.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: ctrl.signal,
    });
    text = (await res.text()).trim();
  } catch (e) {
    throw new PeakerrError(
      "NETWORK",
      (e as Error).name === "AbortError"
        ? "Peakerr n'a pas répondu à temps."
        : `Erreur réseau vers Peakerr : ${(e as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PeakerrError("PARSE", `Réponse Peakerr illisible : ${text.slice(0, 120)}`);
  }
  const err = (json as { error?: string })?.error;
  if (err) throw new PeakerrError("API", String(err));
  return json as T;
}

export interface PeakerrService {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: string; // prix par 1000 (USD)
  min: string;
  max: string;
  refill?: boolean;
  cancel?: boolean;
}

export interface PeakerrStatus {
  status: string; // Pending | In progress | Processing | Completed | Partial | Canceled
  startCount: number;
  remains: number;
  charge: number;
}

export const peakerr = {
  /** Solde du compte Peakerr (USD). */
  async balance(): Promise<{ balance: number; currency: string }> {
    const j = await call<{ balance: string; currency: string }>({
      action: "balance",
    });
    return { balance: Number(j.balance), currency: j.currency };
  },

  /** Liste complète des services (id, prix/1000, min, max…). */
  async services(): Promise<PeakerrService[]> {
    return call<PeakerrService[]>({ action: "services" });
  },

  /** Passe une commande. Retourne l'identifiant Peakerr. */
  async addOrder(
    service: number,
    link: string,
    quantity: number,
  ): Promise<{ orderId: string }> {
    const j = await call<{ order?: number }>({
      action: "add",
      service,
      link,
      quantity,
    });
    if (!j.order) {
      throw new PeakerrError("NO_ORDER", "Peakerr n'a pas créé la commande.");
    }
    return { orderId: String(j.order) };
  },

  /** Demande un refill (recharge des abonnés perdus) — services refill=true. */
  async refill(orderId: string): Promise<{ refillId: string }> {
    const j = await call<{ refill?: string | number }>({
      action: "refill",
      order: orderId,
    });
    if (j.refill === undefined || j.refill === null || j.refill === 0) {
      throw new PeakerrError(
        "NO_REFILL",
        "Refill indisponible pour cette commande.",
      );
    }
    return { refillId: String(j.refill) };
  },

  /** État d'une commande. */
  async status(orderId: string): Promise<PeakerrStatus> {
    const j = await call<{
      status?: string;
      start_count?: string | number;
      remains?: string | number;
      charge?: string | number;
    }>({ action: "status", order: orderId });
    return {
      status: j.status ?? "Unknown",
      startCount: Number(j.start_count) || 0,
      remains: Number(j.remains) || 0,
      charge: Number(j.charge) || 0,
    };
  },
};

/** Normalise le statut Peakerr vers nos états internes. */
export function normalizeStatus(s: string): string {
  const t = s.trim().toLowerCase();
  if (t === "completed") return "COMPLETED";
  if (t === "partial") return "PARTIAL";
  if (t === "canceled" || t === "cancelled") return "CANCELED";
  if (t === "in progress") return "IN_PROGRESS";
  if (t === "processing") return "PROCESSING";
  if (t === "pending") return "PENDING";
  if (t === "fail" || t === "failed" || t === "error") return "FAILED";
  return "PROCESSING";
}
