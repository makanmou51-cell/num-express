import "server-only";
import { env } from "@/lib/env";

/**
 * Client OnlineSim (API v1, https://onlinesim.io/api/<action>.php?apikey=...).
 *
 * Formats relevés EN PRODUCTION (2026-07-23) :
 *   getBalance  -> {"response":"1","balance":"1.798","zbalance":0}
 *   getTariffs  -> {"response":"1",
 *                   "countries":{"_49":{"name":"Германия","original":"germany",
 *                                       "code":49,"enable":true,...}},
 *                   "services":{"_whatsapp":{"id":7,"count":9999,
 *                                            "price":"5.23","slug":"whatsapp"}}}
 *   NB : `services` ne concerne QU'UN pays (celui du paramètre `country`).
 *        Les prix sont des CHAÎNES.
 */
const BASE = "https://onlinesim.io/api";
const TIMEOUT_MS = 20_000;

export class OnlineSimError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OnlineSimError";
    this.code = code;
  }
}

/** Messages FR pour les jetons d'erreur connus. */
const ERRORS: Record<string, string> = {
  ERROR_WRONG_KEY: "Clé API OnlineSim invalide.",
  NO_COUNTRY: "Pays non reconnu par OnlineSim.",
  NO_SERVICE: "Service non reconnu par OnlineSim.",
  NO_NUMBER: "Aucun numéro disponible pour ce pays/service.",
  NO_NUMBERS: "Aucun numéro disponible pour ce pays/service.",
  NO_BALANCE: "Solde OnlineSim insuffisant.",
  ACCOUNT_BLOCKED: "Compte OnlineSim bloqué.",
  ERROR_NO_OPERATIONS: "Aucune opération en cours.",
};

// Erreurs TRANSITOIRES qui méritent un nouvel essai (timeout, réseau, HTTP,
// serveur surchargé) — surtout PAS les erreurs métier (BAD_KEY, NO_NUMBER…).
const RETRYABLE_CODES = new Set(["NETWORK", "HTTP", "TRY_AGAIN_LATER"]);

async function callOnce<T>(
  action: string,
  params: Record<string, string | number | undefined>,
  timeoutMs: number,
): Promise<T> {
  const key = env.onlinesim.apiKey;
  if (!key) {
    throw new OnlineSimError(
      "NO_KEY",
      "ONLINESIM_API_KEY manquante. Renseigne-la dans les variables d'environnement.",
    );
  }

  const url = new URL(`${BASE}/${action}.php`);
  url.searchParams.set("apikey", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let text: string;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        // OnlineSim filtre les requêtes sans User-Agent crédible.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
    });
    text = (await res.text()).trim();
    if (!res.ok && !text) {
      throw new OnlineSimError("HTTP", `OnlineSim a répondu HTTP ${res.status}.`);
    }
  } catch (e) {
    if (e instanceof OnlineSimError) throw e;
    const msg = (e as Error).name === "AbortError"
      ? "OnlineSim n'a pas répondu à temps."
      : `Erreur réseau vers OnlineSim : ${(e as Error).message}`;
    throw new OnlineSimError("NETWORK", msg);
  } finally {
    clearTimeout(timer);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new OnlineSimError("PARSE", `Réponse OnlineSim illisible : ${text.slice(0, 120)}`);
  }

  // `response` vaut "1"/1 en succès, sinon un jeton d'erreur en MAJUSCULES.
  const resp = (parsed as { response?: unknown })?.response;
  if (typeof resp === "string" && resp !== "1" && /^[A-Z_]+$/.test(resp)) {
    throw new OnlineSimError(resp, ERRORS[resp] ?? `OnlineSim : ${resp}`);
  }
  return parsed as T;
}

/**
 * Appelle l'API OnlineSim avec RETRIES automatiques sur erreurs transitoires.
 * C'est ce qui évite les « OnlineSim n'a pas répondu à temps » à l'achat :
 * un pic de lenteur ponctuel est réessayé au lieu de faire échouer l'opération.
 */
async function call<T>(
  action: string,
  params: Record<string, string | number | undefined> = {},
  opts: { retries?: number; timeoutMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await callOnce<T>(action, params, timeoutMs);
    } catch (e) {
      lastErr = e;
      const code = e instanceof OnlineSimError ? e.code : "NETWORK";
      if (attempt === retries || !RETRYABLE_CODES.has(code)) throw e;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/* ─────────────────────────── Types de réponse ─────────────────────────── */

interface TariffCountry {
  name?: string;
  original?: string;
  code?: number;
  enable?: boolean;
}
interface TariffService {
  id?: number;
  count?: number | string;
  price?: number | string;
  service?: string;
  slug?: string;
}
interface TariffsResponse {
  // OnlineSim répartit pays et services entre une liste normale ET une liste
  // « favoris » (marqués sur le compte). Un groupe vide revient parfois en
  // TABLEAU `[]` plutôt qu'en objet -> on tolère les deux formes.
  countries?: Record<string, TariffCountry> | TariffCountry[];
  services?: Record<string, TariffService> | TariffService[];
  favorite_countries?: Record<string, TariffCountry> | TariffCountry[];
  favorite_services?: Record<string, TariffService> | TariffService[];
}

/** Normalise un groupe OnlineSim (objet OU tableau vide) en objet exploitable. */
function asRecord<T>(v: Record<string, T> | T[] | undefined): Record<string, T> {
  if (!v || Array.isArray(v)) return {};
  return v;
}

export interface OsCountry {
  code: string; // indicatif téléphonique, ex. "49"
  eng: string; // "Germany"
}

export interface OsOffer {
  countryCode: string;
  countryEng: string;
  cost: number; // USD
  count: number;
}

/* ───────────────────────────── Méthodes ──────────────────────────────── */

export const onlinesim = {
  /** Solde du compte OnlineSim (USD). */
  async getBalance(): Promise<number> {
    const j = await call<{ balance?: string | number }>("getBalance");
    const n = Number(j.balance);
    if (!Number.isFinite(n)) {
      throw new OnlineSimError("PARSE", "Solde OnlineSim illisible.");
    }
    return n;
  },

  /** Liste des pays (indicatif + nom anglais). */
  async getCountries(): Promise<OsCountry[]> {
    const j = await call<TariffsResponse>("getTariffs");
    const out: OsCountry[] = [];
    const seen = new Set<string>();
    // FUSION `countries` + `favorite_countries` : sinon les pays favoris du
    // compte (ex. Espagne) sont absents du catalogue.
    for (const group of [asRecord(j.countries), asRecord(j.favorite_countries)]) {
      for (const c of Object.values(group)) {
        if (c?.enable === false) continue;
        const code = c?.code;
        if (code === undefined || code === null) continue;
        const codeStr = String(code);
        if (seen.has(codeStr)) continue; // dédoublonnage
        seen.add(codeStr);
        out.push({
          code: codeStr,
          eng: titleCase(c.original ?? c.name ?? codeStr),
        });
      }
    }
    return out;
  },

  /**
   * Prix + stock d'un service pour UN pays. `services` est indexé par
   * `_<slug>` ; on retombe sur le champ `slug` par sécurité.
   */
  async getServicePrice(
    serviceSlug: string,
    countryCode: string,
  ): Promise<{ cost: number; count: number } | null> {
    // Appel du catalogue (80 pays) : pas de retry (sinon on multiplie la charge)
    // et timeout court -> un pays lent échoue vite sans bloquer les autres.
    const j = await call<TariffsResponse>(
      "getTariffs",
      { country: countryCode },
      { retries: 0, timeoutMs: 12_000 },
    );
    // FUSION `services` + `favorite_services` : un service favori (ex. WhatsApp)
    // n'apparaît que dans `favorite_services` et serait sinon introuvable.
    const services = {
      ...asRecord(j.services),
      ...asRecord(j.favorite_services),
    };
    const entry =
      services[`_${serviceSlug}`] ??
      Object.values(services).find((s) => s?.slug === serviceSlug);
    if (!entry) return null;

    const cost = Number(entry.price);
    const count = Number(entry.count);
    if (!Number.isFinite(cost) || cost <= 0) return null;
    return { cost, count: Number.isFinite(count) ? count : 0 };
  },

  /**
   * Achète un numéro. Retourne le `tzid` (identifiant d'opération OnlineSim).
   * Le numéro lui-même n'arrive qu'via getState.
   */
  async getNum(
    serviceSlug: string,
    countryCode: string,
  ): Promise<{ tzid: string }> {
    const j = await call<{ tzid?: number | string }>(
      "getNum",
      {
        service: serviceSlug,
        country: countryCode,
        // Demande le numéro au format international sans préfixe superflu.
        number: 1,
      },
      // Achat = opération critique : on retente 2× sur lenteur ponctuelle.
      { retries: 2, timeoutMs: 12_000 },
    );
    const tzid = j.tzid;
    if (tzid === undefined || tzid === null || tzid === "") {
      throw new OnlineSimError("NO_TZID", "OnlineSim n'a pas renvoyé d'identifiant d'opération.");
    }
    return { tzid: String(tzid) };
  },

  /**
   * État d'une opération : numéro attribué et/ou code reçu.
   * getState renvoie un TABLEAU d'opérations (filtré par tzid si fourni).
   */
  async getState(tzid: string): Promise<{
    phoneNumber: string | null;
    code: string | null;
    raw: string;
  }> {
    // getState est SONDÉ en boucle (achat + page de suivi) : il doit échouer
    // VITE et sans retry, le sondage relance de toute façon.
    const j = await call<unknown>(
      "getState",
      { tzid, message_to_code: 1 },
      { retries: 0, timeoutMs: 8_000 },
    );
    const list = Array.isArray(j) ? j : j ? [j] : [];
    const op = (list as Record<string, unknown>[]).find(
      (o) => String(o?.tzid ?? "") === String(tzid),
    ) ?? (list[0] as Record<string, unknown> | undefined);

    if (!op) return { phoneNumber: null, code: null, raw: JSON.stringify(j).slice(0, 300) };

    const number = op.number ?? op.num;
    const msg = op.msg ?? op.code ?? op.message;
    // `msg` peut être une chaîne, un tableau de SMS, ou vide tant qu'on attend.
    let code: string | null = null;
    if (typeof msg === "string" && msg.trim() !== "") code = msg.trim();
    else if (Array.isArray(msg) && msg.length) {
      const last = msg[msg.length - 1];
      const v = typeof last === "string" ? last : (last as { msg?: string })?.msg;
      if (v) code = String(v).trim();
    }

    return {
      phoneNumber: number ? String(number) : null,
      code,
      raw: JSON.stringify(op).slice(0, 300),
    };
  },

  /** Clôture l'opération (succès). */
  async finish(tzid: string): Promise<void> {
    await call("setOperationOk", { tzid });
  },

  /** Redemande un SMS sur le même numéro. */
  async requestNewCode(tzid: string): Promise<void> {
    await call("setOperationRevise", { tzid });
  },

  /**
   * Annule l'opération. OnlineSim n'expose pas d'action d'annulation dédiée
   * dans l'API v1 : on clôture l'opération, ce qui libère le numéro. Le
   * fournisseur ne facture pas une activation sans SMS reçu.
   */
  async cancel(tzid: string): Promise<void> {
    await call("setOperationOk", { tzid });
  },
};

function titleCase(s: string): string {
  return s
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Correspondance code service interne -> slug OnlineSim. */
export const ONLINESIM_SERVICE_SLUG: Record<string, string> = {
  wa: "whatsapp",
  tg: "telegram",
  ig: "instagram",
  fb: "facebook",
  go: "google",
  vi: "viber",
  tw: "twitter",
  ds: "discord",
  mm: "microsoft",
  am: "amazon",
  nf: "netflix",
  ub: "uber",
  ya: "yandex",
  lf: "tiktok",
  wb: "wechat",
  vk: "vkcom",
  ot: "other",
};
