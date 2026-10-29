import "server-only";
import { env } from "@/lib/env";
import { AccKitError } from "./client";

/**
 * Client AccKit — API OTP (location de numéros pour recevoir UN code SMS) :
 *   base `${env.acckit.baseUrl}/otp`, clé `api_key` sur CHAQUE appel,
 *   en-tête `Accept: application/json` OBLIGATOIRE — sans lui, les erreurs
 *   arrivent en redirection HTML 302 au lieu d'un JSON.
 *   Devise : VND. Échec métier = HTTP 200 {"status": false, "msg": "..."}.
 *
 * Règle d'or (identique à l'API comptes, §7 de la doc) : /buy n'a PAS de clé
 * d'idempotence et aucun endpoint ne liste les commandes OTP. En cas de
 * timeout ou d'erreur réseau sur /buy, on NE RENVOIE JAMAIS la requête — la
 * commande a pu être créée et débitée. On préfère perdre une vente que
 * débiter deux fois le compte fournisseur.
 *
 * Un /buy peut mettre jusqu'à ~90 s : timeout 50 s pour rester sous la coupe
 * Vercel (60 s). /check et /cancel peuvent dépasser 30 s : timeout 30 s.
 */

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

function base(): string {
  return `${env.acckit.baseUrl}/otp`;
}

async function parseJson(text: string): Promise<unknown> {
  try {
    return JSON.parse(text);
  } catch {
    throw new AccKitError(
      "PARSE",
      `Réponse AccKit OTP illisible : ${text.slice(0, 120)}`,
    );
  }
}

/** Vérifie le statut HTTP AVANT de parser : une page d'erreur HTML (proxy,
 *  hébergeur) doit donner une erreur parlante, pas un PARSE trompeur. */
function checkHttp(res: Response): void {
  if (!res.ok) {
    throw new AccKitError("API", `AccKit OTP HTTP ${res.status}`);
  }
}

async function get(path: string, timeoutMs = 30_000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    const sep = path.includes("?") ? "&" : "?";
    res = await fetch(
      `${base()}${path}${sep}api_key=${encodeURIComponent(apiKey())}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: ctrl.signal,
      },
    );
  } catch (e) {
    throw new AccKitError(
      (e as Error).name === "AbortError" ? "TIMEOUT" : "NETWORK",
      (e as Error).name === "AbortError"
        ? "AccKit OTP n'a pas répondu à temps."
        : `Erreur réseau vers AccKit : ${(e as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }
  checkHttp(res);
  return parseJson((await res.text()).trim());
}

async function post(
  path: string,
  fields: Record<string, string | number>,
  timeoutMs = 30_000,
): Promise<unknown> {
  const body = new URLSearchParams({ api_key: apiKey() });
  for (const [k, v] of Object.entries(fields)) body.set(k, String(v));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, {
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
        ? "AccKit OTP n'a pas répondu à temps."
        : `Erreur réseau vers AccKit : ${(e as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }
  checkHttp(res);
  return parseJson((await res.text()).trim());
}

/** Échec métier standard (HTTP 200, status:false) → AccKitError("API", msg).
 *  Le message d'origine est PRÉSERVÉ : l'appelant en a besoin (ex. /check
 *  "Order not found", /cancel "already received a code"). */
function checkBusinessError(json: unknown): void {
  const j = json as { status?: boolean; msg?: string };
  if (j && j.status === false) {
    throw new AccKitError("API", j.msg || "AccKit a refusé la requête.");
  }
}

// ── Types ──

export interface OtpCountry {
  country: string; // slug, ex "benin"
  name: string; // ex "Benin"
  prefix: string; // ex "+229"
  iso: string; // ex "bj"
}

/** Vue d'ensemble d'un service dans un pays (GET /services). */
export interface OtpServiceRow {
  service: string; // slug, ex "whatsapp"
  price_from: number; // prix plancher VND (tous serveurs confondus)
  qty: number; // numéros disponibles
  vip?: boolean;
}

/** Ligne RÉELLEMENT achetable (GET /servers) : c'est `operator` qu'on impose au /buy. */
export interface OtpServerRow {
  server: string;
  server_name: string;
  operator: string; // valeur à passer au /buy
  price: number; // VND
  qty: number;
  rate: number | null;
  tier: string;
  hold: number; // minutes de rétention du numéro
  ve_rate: number | null; // taux de réussite mesuré 0-100 (null = jamais mesuré)
  ve_mau?: number | null;
  /** true = serveur nouveau, jamais prouvé : on ne le propose pas au client. */
  ghim: boolean;
}

export type OtpOrderStatus = "WAITING" | "RECEIVED" | "REFUNDED" | string;

export interface OtpOrder {
  id: number;
  phone: string | null;
  status: OtpOrderStatus;
  code: string | null; // rempli quand status = RECEIVED (un seul code par commande)
  text: string | null; // SMS brut
  product?: string;
  country?: string;
  operator?: string;
  price?: number; // VND réellement facturé
  /** Horodatage d'expiration (s) : passé ce délai sans code, AccKit rembourse
   *  automatiquement à 100 % — le /check confirme alors status REFUNDED. */
  expires_ts: number;
  expires_at_iso?: string;
  vip?: boolean;
  hold?: number;
}

// ── Endpoints ──

/** Liste des pays desservis (~194). On n'en utilise qu'une sélection curatée. */
export async function otpCountries(): Promise<OtpCountry[]> {
  const j = (await get("/countries")) as { status?: boolean; data?: OtpCountry[] };
  checkBusinessError(j);
  return j.data ?? [];
}

/** Vue d'ensemble des services d'un pays : prix plancher + stock par service. */
export async function otpServices(country: string): Promise<OtpServiceRow[]> {
  const j = (await get(
    `/services?country=${encodeURIComponent(country)}`,
  )) as { status?: boolean; data?: OtpServiceRow[] };
  checkBusinessError(j);
  return j.data ?? [];
}

/** Lignes serveur réellement achetables pour un couple (pays, service). */
export async function otpServers(
  country: string,
  service: string,
): Promise<OtpServerRow[]> {
  const j = (await get(
    `/servers?country=${encodeURIComponent(country)}&service=${encodeURIComponent(service)}`,
  )) as { status?: boolean; data?: OtpServerRow[] };
  checkBusinessError(j);
  return j.data ?? [];
}

/**
 * Achète un numéro sur une ligne serveur précise (`operator`). Peut prendre
 * jusqu'à ~90 s : timeout 50 s (la fonction Vercel coupe à 60 s).
 *
 * Échecs métier mappés (le corps JSON porte des drapeaux dédiés) :
 *   {"sold_out": true}    → SOLD_OUT   (ligne épuisée : en choisir une autre)
 *   {"need_deposit": true}→ NEED_DEPOSIT (notre solde AccKit est vide : à recharger)
 *   autre status:false    → API
 * TIMEOUT/NETWORK = état INCONNU (la commande existe peut-être) : JAMAIS de
 * retry automatique, et aucun endpoint ne permet de la retrouver.
 */
export async function otpBuy(
  country: string,
  service: string,
  operator: string,
): Promise<OtpOrder> {
  const j = (await post(
    "/buy",
    { country, service, operator },
    50_000,
  )) as {
    status?: boolean;
    msg?: string;
    sold_out?: boolean;
    need_deposit?: boolean;
    order?: OtpOrder;
  };
  if (j.status === false) {
    const msg = j.msg || "AccKit a refusé l'achat.";
    if (j.sold_out) throw new AccKitError("SOLD_OUT", msg);
    if (j.need_deposit) throw new AccKitError("NEED_DEPOSIT", msg);
    throw new AccKitError("API", msg);
  }
  if (!j.order || typeof j.order.id !== "number") {
    throw new AccKitError("PARSE", "AccKit n'a pas renvoyé de commande OTP.");
  }
  return j.order;
}

/** Statut d'une commande. Id inconnu → AccKitError("API", "Order not found"). */
export async function otpCheck(id: number): Promise<OtpOrder> {
  const j = (await get(`/check?id=${id}`, 30_000)) as {
    status?: boolean;
    msg?: string;
    order?: OtpOrder;
  };
  checkBusinessError(j);
  if (!j.order) {
    throw new AccKitError("PARSE", "AccKit n'a pas renvoyé la commande OTP.");
  }
  return j.order;
}

/**
 * Annule une commande encore WAITING : remboursement immédiat côté AccKit.
 * Si le code est déjà arrivé : AccKitError("API", "This order already received
 * a code.") — le client DOIT garder son numéro (il a reçu ce qu'il a payé).
 */
export async function otpCancel(id: number): Promise<OtpOrder> {
  const j = (await post("/cancel", { id }, 30_000)) as {
    status?: boolean;
    msg?: string;
    order?: OtpOrder;
  };
  checkBusinessError(j);
  return j.order ?? { id, phone: null, status: "REFUNDED", code: null, text: null, expires_ts: 0 };
}
