import { env } from "@/lib/env";

/**
 * Client de l'API Grizzly SMS (protocole `handler_api.php`, type sms-activate).
 * Base : https://api.grizzlysms.com/stubs/handler_api.php
 *
 * Les réponses sont soit du texte (`ACCESS_NUMBER:id:phone`), soit du JSON
 * selon l'action. On parse les jetons d'erreur connus et on lève GrizzlyError.
 */

export type GrizzlyErrorCode =
  | "BAD_KEY"
  | "NO_BALANCE"
  | "NO_NUMBERS"
  | "BAD_SERVICE"
  | "BAD_ACTION"
  | "BAD_STATUS"
  | "WRONG_SERVICE"
  | "WRONG_MAX_PRICE"
  | "SERVICE_UNAVAILABLE_REGION"
  | "EARLY_CANCEL_DENIED"
  | "WRONG_ACTIVATION_ID"
  | "BANNED"
  | "ERROR_SQL"
  | "NETWORK"
  | "UNKNOWN";

export class GrizzlyError extends Error {
  code: GrizzlyErrorCode;
  raw?: string;
  /** Charge utile après le préfixe (ex. date pour BANNED, prix mini pour WRONG_MAX_PRICE). */
  detail?: string;
  constructor(
    code: GrizzlyErrorCode,
    message: string,
    raw?: string,
    detail?: string,
  ) {
    super(message);
    this.name = "GrizzlyError";
    this.code = code;
    this.raw = raw;
    this.detail = detail;
  }
}

const ERROR_MESSAGES: Record<string, { code: GrizzlyErrorCode; fr: string }> = {
  BAD_KEY: { code: "BAD_KEY", fr: "Clé API Grizzly invalide." },
  NO_BALANCE: { code: "NO_BALANCE", fr: "Solde fournisseur insuffisant." },
  NO_NUMBERS: {
    code: "NO_NUMBERS",
    fr: "Aucun numéro disponible pour ce pays/service.",
  },
  BAD_SERVICE: { code: "BAD_SERVICE", fr: "Service inconnu." },
  WRONG_SERVICE: { code: "WRONG_SERVICE", fr: "Service incorrect." },
  BAD_ACTION: { code: "BAD_ACTION", fr: "Action inconnue." },
  NO_ACTION: { code: "BAD_ACTION", fr: "Action manquante." },
  BAD_STATUS: { code: "BAD_STATUS", fr: "Statut d'activation invalide." },
  NO_KEY: { code: "BAD_KEY", fr: "Clé API Grizzly absente ou invalide." },
  USERS_IP_IS_NOT_ALLOWED: {
    code: "BAD_KEY",
    fr: "IP non autorisée pour cette clé API Grizzly.",
  },
  WRONG_MAX_PRICE: {
    code: "WRONG_MAX_PRICE",
    fr: "Le prix a changé : rafraîchissez l'offre et réessayez.",
  },
  BANNED: {
    code: "BANNED",
    fr: "Compte fournisseur momentanément indisponible. Réessayez plus tard.",
  },
  ERROR_SQL: {
    code: "ERROR_SQL",
    fr: "Erreur temporaire du fournisseur. Réessayez.",
  },
  SERVICE_UNAVAILABLE_REGION: {
    code: "SERVICE_UNAVAILABLE_REGION",
    fr: "Service indisponible dans cette région.",
  },
  EARLY_CANCEL_DENIED: {
    code: "EARLY_CANCEL_DENIED",
    fr: "Annulation impossible avant 2 minutes.",
  },
  WRONG_ACTIVATION_ID: {
    code: "WRONG_ACTIVATION_ID",
    fr: "Identifiant d'activation inconnu.",
  },
  NO_ACTIVATION: {
    code: "WRONG_ACTIVATION_ID",
    fr: "Activation introuvable.",
  },
};

/** Statuts retournés par getStatus. */
export type ActivationStatus =
  | { kind: "WAIT_CODE" }
  | { kind: "WAIT_RESEND" }
  | { kind: "WAIT_RETRY"; lastCode: string }
  | { kind: "CANCELLED" }
  | { kind: "OK"; code: string };

/** Codes de setStatus (cycle de vie d'une activation). */
export const SET_STATUS = {
  READY: 1, // numéro prêt à recevoir
  RETRY: 3, // demander un nouveau code
  FINISH: 6, // terminer (succès)
  CANCEL: 8, // annuler (remboursement fournisseur)
} as const;

export interface PriceEntry {
  cost: number; // coût brut (devise fournisseur)
  count: number; // stock « affiché » (souvent gonflé, inclut le virtuel)
  // Numéros PHYSIQUES (non-VoIP) réellement en ligne. Chez HeroSMS c'est LE
  // signal de fiabilité : seuls les numéros physiques délivrent WhatsApp.
  physicalCount?: number;
}
/** getPrices : { [country]: { [service]: PriceEntry } } */
export type PricesResponse = Record<string, Record<string, PriceEntry>>;

/** Un fournisseur (palier de prix) dans getPricesV3. */
export interface ProviderTier {
  count: number | string;
  price: number | number[];
  provider_id?: number;
}
/**
 * getPricesV3 : comme getPrices mais avec le DÉTAIL PAR FOURNISSEUR.
 * `price` est le prix « from » (le moins cher), `providers` liste chaque
 * palier avec son propre stock. Certains pays n'ont pas de `providers`
 * (palier unique). Un seul appel couvre tous les pays d'un service.
 */
export interface PriceV3Entry {
  price: number;
  count: number;
  providers?: Record<string, ProviderTier>;
}
export type PricesV3Response = Record<string, Record<string, PriceV3Entry>>;

export interface CountryInfo {
  id: string;
  rus?: string;
  eng?: string;
  visible?: number;
}

/** Un message (SMS ou appel) renvoyé par getStatusV2. */
export type StatusV2Item = {
  code?: string;
  text?: string;
  date?: string;
  sender?: string;
  from?: string;
};
/** getStatusV2 : état riche. `sms` = objet (activation) OU tableau (location) ;
 *  `call` = code reçu par APPEL (WhatsApp « appelez-moi »). */
export interface StatusV2 {
  verificationType?: number;
  sms?: StatusV2Item | StatusV2Item[] | null;
  call?: StatusV2Item | null;
}

/** (HeroSMS) Prix d'UN service pour une location d'une durée donnée. */
export interface RentServiceInfo {
  quantity: number;
  price: number;
  retail_price?: number;
}
/** getRentServicesAndCountries : services/pays/opérateurs dispo à la location. */
export interface RentPrices {
  countries?: Record<string, unknown>;
  operators?: unknown;
  services?: Record<string, RentServiceInfo>;
}
/** Numéro loué renvoyé par getRentNumber. */
export interface RentedNumber {
  rentId: string;
  phoneNumber: string;
  cost: number;
  endTime?: string;
}

/** Un service HeroSMS (code interne + nom lisible). */
export interface ServiceListItem {
  code: string;
  name: string;
}

/** Une activation en cours renvoyée par getActiveActivations (champs souples). */
export interface ActiveActivation {
  activationId?: string | number;
  serviceCode?: string;
  phoneNumber?: string;
  activationStatus?: string | number;
  smsCode?: string | string[] | null;
  smsText?: string | null;
  activationTime?: string;
  countryCode?: string | number;
  countryName?: string;
  [key: string]: unknown;
}

/**
 * Cible effective de l'API selon le fournisseur actif. HeroSMS parle EXACTEMENT
 * le même protocole `handler_api.php` que Grizzly : on réutilise donc tout ce
 * client en changeant seulement l'URL de base et la clé. Seul le catalogue
 * diffère (HeroSMS n'expose pas getPricesV3), géré à part.
 */
function providerTarget(): { baseUrl: string; apiKey: string } {
  if (env.smsProvider === "herosms") {
    return { baseUrl: env.heroSms.baseUrl, apiKey: env.heroSms.apiKey };
  }
  return { baseUrl: env.grizzly.baseUrl, apiKey: env.grizzly.apiKey };
}

async function rawCall(
  action: string,
  params: Record<string, string | number | undefined>,
): Promise<string> {
  const { baseUrl, apiKey } = providerTarget();
  if (!apiKey) {
    throw new GrizzlyError(
      "BAD_KEY",
      "Clé API fournisseur absente ou invalide.",
    );
  }
  const url = new URL(baseUrl);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json, text/plain, */*" },
    });
  } catch (e) {
    throw new GrizzlyError(
      "NETWORK",
      `Erreur réseau vers Grizzly: ${(e as Error).message}`,
    );
  }

  const text = (await res.text()).trim();

  // Jetons d'erreur connus (le préfixe précède le premier ':').
  // Ces jetons arrivent parfois en HTTP 200 : on les traite AVANT le test res.ok.
  const errKey = text.split(":")[0];
  if (ERROR_MESSAGES[errKey]) {
    const { code, fr } = ERROR_MESSAGES[errKey];
    // Charge utile après le préfixe (slice, pas split : la date de BANNED
    // contient elle-même des ':').
    const detail =
      text.length > errKey.length ? text.slice(errKey.length + 1) : undefined;
    throw new GrizzlyError(code, fr, text, detail);
  }
  if (!res.ok) {
    throw new GrizzlyError("UNKNOWN", `HTTP ${res.status}: ${text}`, text);
  }
  return text;
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GrizzlyError(
      "UNKNOWN",
      "Réponse Grizzly illisible (JSON attendu).",
      text,
    );
  }
}

const liveGrizzly = {
  /** Solde du compte Grizzly (devise fournisseur). */
  async getBalance(): Promise<number> {
    const text = await rawCall("getBalance", {});
    // ACCESS_BALANCE:123.45
    const m = text.match(/ACCESS_BALANCE:([\d.]+)/);
    if (!m) throw new GrizzlyError("UNKNOWN", "Solde illisible.", text);
    return Number(m[1]);
  },

  /** Prix et disponibilités. Filtrable par service et/ou pays. */
  async getPrices(opts: { service?: string; country?: string } = {}) {
    const text = await rawCall("getPrices", {
      service: opts.service,
      country: opts.country,
    });
    return parseJson<PricesResponse>(text);
  },

  /**
   * SONDE FlashCall — appelle une action arbitraire et renvoie la réponse
   * BRUTE, sans l'interpréter.
   *
   * Pourquoi : HeroSMS vend « FlashCall + SMS » sur son site, mais rien ne dit
   * que son API l'expose, ni sous quel nom. Le cas s'est déjà produit avec le
   * premium « Mon prix » : visible sur leur site, inaccessible par l'API. On
   * interroge donc avant d'écrire du code qui engage de l'argent.
   *
   * Lecture seule : aucune de ces actions n'achète quoi que ce soit.
   */
  async probeRaw(
    action: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<{ ok: boolean; body: string }> {
    try {
      const body = await rawCall(action, params);
      return { ok: true, body };
    } catch (e) {
      return { ok: false, body: (e as Error).message };
    }
  },

  /**
   * SONDE de l'API REST moderne de HeroSMS — `https://hero-sms.com/api/v1`.
   *
   * Découverte le 2026-10-04 : HeroSMS expose DEUX API. num express n'utilise
   * que l'ancienne (`stubs/handler_api.php`, protocole sms-activate). La
   * nouvelle, documentée en OpenAPI 3.2, propose notamment « Recevoir des
   * offres d'activation » — potentiellement l'accès au premium « Mon prix »,
   * resté inaccessible par l'ancienne API et soupçonné d'être la cause des
   * 8 % de réussite WhatsApp.
   *
   * Le schéma d'authentification n'est pas documenté publiquement : on essaie
   * les trois conventions usuelles et on retient celle qui répond. Lecture
   * seule — aucun achat.
   */
  async probeRest(
    path: string,
  ): Promise<Array<{ auth: string; status: number; body: string }>> {
    const { apiKey } = providerTarget();
    if (!apiKey) {
      return [{ auth: "—", status: 0, body: "Clé API fournisseur absente." }];
    }
    const url = `https://hero-sms.com/api/v1${path}`;
    const schemas: Array<[string, Record<string, string>]> = [
      ["Bearer", { Authorization: `Bearer ${apiKey}` }],
      ["X-Api-Key", { "X-Api-Key": apiKey }],
      ["api_key (query)", {}],
    ];
    const out: Array<{ auth: string; status: number; body: string }> = [];
    for (const [nom, headers] of schemas) {
      const cible =
        nom === "api_key (query)"
          ? `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(apiKey)}`
          : url;
      try {
        const res = await fetch(cible, {
          headers: { Accept: "application/json", ...headers },
          signal: AbortSignal.timeout(12_000),
        });
        out.push({
          auth: nom,
          status: res.status,
          body: (await res.text()).slice(0, 1500),
        });
      } catch (e) {
        out.push({ auth: nom, status: 0, body: (e as Error).message });
      }
      // Inutile d'insister si une convention a déjà été acceptée.
      if (out[out.length - 1].status === 200) break;
      await new Promise((r) => setTimeout(r, 600));
    }
    return out;
  },

  /**
   * Prix DÉTAILLÉS par fournisseur (paliers). Permet de viser un palier haut
   * — les fournisseurs premium délivrent le code beaucoup plus vite que le
   * palier « from » renvoyé par getPrices.
   */
  async getPricesV3(opts: { service?: string; country?: string } = {}) {
    const text = await rawCall("getPricesV3", {
      service: opts.service,
      country: opts.country,
    });
    return parseJson<PricesV3Response>(text);
  },

  /** Liste des pays (id + libellés). Normalise le cas tableau en map par id. */
  async getCountries(): Promise<Record<string, CountryInfo>> {
    const text = await rawCall("getCountries", {});
    const parsed = parseJson<unknown>(text);
    // Certaines instances renvoient un tableau plutôt qu'une map id -> pays.
    if (Array.isArray(parsed)) {
      const map: Record<string, CountryInfo> = {};
      for (const c of parsed as CountryInfo[]) {
        if (c && c.id !== undefined) map[String(c.id)] = c;
      }
      return map;
    }
    return parsed as Record<string, CountryInfo>;
  },

  /**
   * Liste les activations en cours. Parse défensivement les deux formes
   * documentées : tableau nu OU objet { activeActivations: [...] }.
   */
  async getActiveActivations(): Promise<ActiveActivation[]> {
    const text = await rawCall("getActiveActivations", {});
    // Cas « aucune activation » : jeton texte NO_ACTIVATIONS ou littéral null.
    if (text.startsWith("NO_ACTIVATIONS")) return [];
    const parsed = parseJson<unknown>(text);
    if (Array.isArray(parsed)) return parsed as ActiveActivation[];
    if (parsed && typeof parsed === "object") {
      const wrapped = parsed as { activeActivations?: ActiveActivation[] };
      return wrapped.activeActivations ?? [];
    }
    // null / valeur inattendue -> liste vide.
    return [];
  },

  /**
   * Achète un numéro. `maxPrice` (devise fournisseur) plafonne le coût.
   * Retourne l'id d'activation et le numéro.
   */
  async getNumber(opts: {
    service: string;
    country: string;
    maxPrice?: number;
    /**
     * Fournisseur(s) imposé(s) (ids séparés par des virgules). SANS ce
     * paramètre, `maxPrice` n'est qu'un PLAFOND : Grizzly choisit lui-même le
     * fournisseur, souvent pas le meilleur. C'est le seul moyen de cibler
     * réellement un fournisseur premium.
     */
    providerIds?: string;
    /**
     * (HeroSMS) Achat AU PRIX EXACT imposé — « Purchasing strictly at the
     * specified price ». Contrairement à maxPrice (plafond → prend le pool le
     * moins cher, souvent des numéros brûlés), fixedPrice force le pool PREMIUM
     * à ce niveau de prix (numéros frais qui délivrent réellement le code).
     */
    fixedPrice?: number;
    /** Opérateur imposé (optionnel). */
    operator?: string;
    /**
     * Mode de vérification demandé au fournisseur.
     *
     * `"call"` achète un numéro FlashCall : le service appelle, raccroche, et
     * le code EST le numéro de l'appelant. C'est un PRODUIT DISTINCT chez
     * HeroSMS, à un tarif distinct — d'où le paramètre à l'achat.
     *
     * Le nom exact du paramètre côté HeroSMS est confirmé par la sonde de
     * /admin/diagnostic. Tant qu'il n'est pas validé, l'appelant retombe sur
     * un achat SMS normal plutôt que de risquer une vente cassée.
     */
    verification?: "sms" | "call";
  }): Promise<{ activationId: string; phoneNumber: string }> {
    const text = await rawCall("getNumber", {
      service: opts.service,
      country: opts.country,
      maxPrice: opts.maxPrice,
      fixedPrice: opts.fixedPrice,
      operator: opts.operator,
      providerIds: opts.providerIds,
      // 1 = vérification par appel (FlashCall) dans le protocole sms-activate.
      ...(opts.verification === "call" ? { activationType: 1 } : {}),
    });
    // ACCESS_NUMBER:activationId:phoneNumber
    const m = text.match(/^ACCESS_NUMBER:([^:]+):(.+)$/);
    if (!m) throw new GrizzlyError("UNKNOWN", "Numéro illisible.", text);
    return { activationId: m[1], phoneNumber: m[2] };
  },

  /** État d'une activation (attente / code reçu / annulée). */
  async getStatus(activationId: string): Promise<ActivationStatus> {
    const text = await rawCall("getStatus", { id: activationId });
    if (text.startsWith("STATUS_OK:")) {
      return { kind: "OK", code: text.slice("STATUS_OK:".length) };
    }
    if (text.startsWith("STATUS_WAIT_RETRY:")) {
      return { kind: "WAIT_RETRY", lastCode: text.split(":")[1] ?? "" };
    }
    if (text === "STATUS_WAIT_RESEND") return { kind: "WAIT_RESEND" };
    if (text === "STATUS_CANCEL") return { kind: "CANCELLED" };
    if (text === "STATUS_WAIT_CODE") return { kind: "WAIT_CODE" };
    // Tout autre corps (ex. jeton d'erreur renvoyé en HTTP 200) ne doit PAS
    // être interprété silencieusement comme « en attente ».
    throw new GrizzlyError("UNKNOWN", "Statut Grizzly inattendu.", text);
  },

  /** Change l'état d'une activation (voir SET_STATUS). */
  async setStatus(
    activationId: string,
    status: (typeof SET_STATUS)[keyof typeof SET_STATUS],
  ): Promise<string> {
    // ACCESS_READY | ACCESS_RETRY_GET | ACCESS_ACTIVATION | ACCESS_CANCEL
    return rawCall("setStatus", { id: activationId, status });
  },

  /** Termine (succès) une activation. */
  finish(activationId: string) {
    return this.setStatus(activationId, SET_STATUS.FINISH);
  },

  /** Annule une activation (remboursement fournisseur si éligible). */
  cancel(activationId: string) {
    return this.setStatus(activationId, SET_STATUS.CANCEL);
  },

  // ───── Location (numéros loués, HeroSMS) ─────

  /** État riche (multi-SMS) d'une activation OU d'une location. */
  async getStatusV2(activationId: string): Promise<StatusV2> {
    const text = await rawCall("getStatusV2", { id: activationId });
    return parseJson<StatusV2>(text);
  },

  /**
   * Code reçu via getStatusV2 — SMS **ou APPEL**. WhatsApp propose « appelez-moi »
   * quand le SMS tarde ; le code arrive alors dans `call.code`. getStatus (texte)
   * ne voit que le SMS, d'où ce complément (numéros France & co qui délivrent
   * mieux par appel).
   */
  async getV2Code(
    activationId: string,
  ): Promise<{ code: string; via: "sms" | "call" } | null> {
    const v2 = await this.getStatusV2(activationId);
    const call = v2.call;
    if (call && typeof call === "object" && call.code) {
      return { code: String(call.code), via: "call" };
    }
    const sms = v2.sms;
    const item = Array.isArray(sms) ? sms[sms.length - 1] : sms;
    if (item && typeof item === "object" && item.code) {
      return { code: String(item.code), via: "sms" };
    }
    return null;
  },

  /** Prix des services louables pour un pays + une durée (heures). */
  async getRentPrices(opts: {
    country: string;
    durationHours: number;
  }): Promise<RentPrices> {
    const text = await rawCall("getRentServicesAndCountries", {
      country: opts.country,
      duration: opts.durationHours,
    });
    return parseJson<RentPrices>(text);
  },

  /** Loue un numéro dédié pour `durationHours` heures. */
  async rentNumber(opts: {
    service: string;
    country: string;
    durationHours: number;
  }): Promise<RentedNumber> {
    const text = await rawCall("getRentNumber", {
      service: opts.service,
      country: opts.country,
      duration: opts.durationHours,
    });
    const o = parseJson<{
      activationId?: string | number;
      phoneNumber?: string;
      activationCost?: number;
      activationEndTime?: string;
    }>(text);
    if (!o.activationId || !o.phoneNumber) {
      throw new GrizzlyError("UNKNOWN", "Réponse de location illisible.", text);
    }
    return {
      rentId: String(o.activationId),
      phoneNumber: String(o.phoneNumber),
      cost: Number(o.activationCost ?? 0),
      endTime: o.activationEndTime,
    };
  },

  /** Liste des services HeroSMS (code -> nom lisible). */
  async getServicesList(country?: string): Promise<ServiceListItem[]> {
    const text = await rawCall("getServicesList", country ? { country } : {});
    const j = parseJson<{ services?: ServiceListItem[] }>(text);
    return Array.isArray(j.services) ? j.services : [];
  },
};

// ───────────────────────────── Mode démo ─────────────────────────────
// Client simulé : permet de tester tout le parcours sans clé/compte Grizzly.
// Le code SMS « arrive » ~8 s après l'achat. Prix et pays sont réalistes.

interface MockEntry {
  id: string;
  eng: string;
  cost: number;
  dial: string;
}

// ~28 pays simulés (indicatifs réalistes). En mode réel, getCountries renvoie
// les 100+ pays de Grizzly automatiquement.
const MOCK_CATALOG: MockEntry[] = [
  { id: "0", eng: "Russia", cost: 0.18, dial: "7" },
  { id: "1", eng: "Ukraine", cost: 0.2, dial: "380" },
  { id: "2", eng: "Kazakhstan", cost: 0.25, dial: "77" },
  { id: "4", eng: "Philippines", cost: 0.35, dial: "63" },
  { id: "6", eng: "Indonesia", cost: 0.3, dial: "62" },
  { id: "7", eng: "Malaysia", cost: 0.4, dial: "60" },
  { id: "8", eng: "Kenya", cost: 0.45, dial: "254" },
  { id: "10", eng: "Vietnam", cost: 0.35, dial: "84" },
  { id: "15", eng: "Poland", cost: 0.9, dial: "48" },
  { id: "16", eng: "United Kingdom", cost: 3.2, dial: "44" },
  { id: "19", eng: "Nigeria", cost: 0.5, dial: "234" },
  { id: "21", eng: "Egypt", cost: 0.4, dial: "20" },
  { id: "22", eng: "India", cost: 0.22, dial: "91" },
  { id: "31", eng: "South Africa", cost: 0.6, dial: "27" },
  { id: "36", eng: "Canada", cost: 1.6, dial: "1" },
  { id: "37", eng: "Morocco", cost: 0.7, dial: "212" },
  { id: "43", eng: "Germany", cost: 3.0, dial: "49" },
  { id: "48", eng: "Netherlands", cost: 2.8, dial: "31" },
  { id: "54", eng: "Mexico", cost: 0.9, dial: "52" },
  { id: "56", eng: "Spain", cost: 2.0, dial: "34" },
  { id: "62", eng: "Turkey", cost: 0.8, dial: "90" },
  { id: "73", eng: "Brazil", cost: 0.5, dial: "55" },
  { id: "78", eng: "France", cost: 2.4, dial: "33" },
  { id: "86", eng: "Italy", cost: 2.2, dial: "39" },
  { id: "117", eng: "Portugal", cost: 1.8, dial: "351" },
  { id: "128", eng: "Argentina", cost: 0.8, dial: "54" },
  { id: "133", eng: "Colombia", cost: 0.7, dial: "57" },
  { id: "187", eng: "United States", cost: 1.5, dial: "1" },
];

const MOCK_BY_ID: Record<string, MockEntry> = Object.fromEntries(
  MOCK_CATALOG.map((c) => [c.id, c]),
);

const MOCK_COUNTRIES: Record<string, CountryInfo> = Object.fromEntries(
  MOCK_CATALOG.map((c) => [c.id, { id: c.id, eng: c.eng, visible: 1 }]),
);

function mockServiceFactor(service: string): number {
  const f: Record<string, number> = {
    wa: 1,
    tg: 0.8,
    ig: 0.9,
    go: 1.1,
    fb: 0.95,
  };
  return f[service] ?? 1;
}

function mockCost(country: string, service: string): number {
  const base = MOCK_BY_ID[country]?.cost ?? 0.4;
  return Math.round(base * mockServiceFactor(service) * 100) / 100;
}

function mockCount(country: string, service: string): number {
  // Pseudo-aléatoire déterministe (aucune dépendance à Math.random).
  let h = 0;
  for (const ch of country + service) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return 40 + (h % 460);
}

const mockGrizzly: typeof liveGrizzly = {
  async getBalance() {
    return 25.0;
  },

  /* En mode simulé, la sonde ne contacte personne : elle le dit clairement
     plutôt que de renvoyer une fausse réponse qu'on prendrait pour vraie. */
  async probeRaw(action: string) {
    return {
      ok: false,
      body: `[mode simulé] action « ${action} » non appelée`,
    };
  },

  async probeRest(path: string) {
    return [{ auth: "—", status: 0, body: `[mode simulé] ${path} non appelé` }];
  },

  async getPrices(opts: { service?: string; country?: string } = {}) {
    const service = opts.service ?? "wa";
    const countries = opts.country
      ? [opts.country]
      : Object.keys(MOCK_COUNTRIES);
    const out: PricesResponse = {};
    for (const c of countries) {
      if (!MOCK_COUNTRIES[c]) continue;
      out[c] = {
        [service]: { cost: mockCost(c, service), count: mockCount(c, service) },
      };
    }
    return out;
  },

  async getPricesV3(opts: { service?: string; country?: string } = {}) {
    const service = opts.service ?? "wa";
    const countries = opts.country
      ? [opts.country]
      : Object.keys(MOCK_COUNTRIES);
    const out: PricesV3Response = {};
    for (const c of countries) {
      if (!MOCK_COUNTRIES[c]) continue;
      const cost = mockCost(c, service);
      const count = mockCount(c, service);
      // Deux paliers simulés pour refléter la structure réelle.
      out[c] = {
        [service]: {
          price: cost,
          count,
          providers: {
            "1": { count, price: [cost], provider_id: 1 },
            "2": {
              count: Math.max(20, Math.round(count / 4)),
              price: [Math.round(cost * 2 * 100) / 100],
              provider_id: 2,
            },
          },
        },
      };
    }
    return out;
  },

  async getCountries() {
    return MOCK_COUNTRIES;
  },

  async getActiveActivations() {
    return [];
  },

  async getNumber(opts: {
    service: string;
    country: string;
    maxPrice?: number;
    providerIds?: string;
    fixedPrice?: number;
    operator?: string;
  }) {
    const activationId = `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const dial = MOCK_BY_ID[opts.country]?.dial ?? "1";
    const suffix = String(Date.now()).slice(-9);
    return { activationId, phoneNumber: `${dial}${suffix}` };
  },

  async getStatus(): Promise<ActivationStatus> {
    // En démo le code n'arrive PAS tout seul : il est délivré à la demande
    // (bouton « J'ai utilisé le numéro ») qui passe l'activation à RECEIVED.
    return { kind: "WAIT_CODE" };
  },

  async setStatus(_activationId: string, status: number) {
    const map: Record<number, string> = {
      1: "ACCESS_READY",
      3: "ACCESS_RETRY_GET",
      6: "ACCESS_ACTIVATION",
      8: "ACCESS_CANCEL",
    };
    return map[status] ?? "ACCESS_READY";
  },

  finish(activationId: string) {
    return this.setStatus(activationId, SET_STATUS.FINISH);
  },
  cancel(activationId: string) {
    return this.setStatus(activationId, SET_STATUS.CANCEL);
  },

  async getStatusV2(): Promise<StatusV2> {
    return { verificationType: 0, sms: null, call: null };
  },
  async getV2Code(): Promise<{ code: string; via: "sms" | "call" } | null> {
    return null;
  },
  async getRentPrices(): Promise<RentPrices> {
    return {
      services: { wa: { quantity: 10, price: 1.8, retail_price: 1.98 } },
    };
  },
  async rentNumber(opts: {
    service: string;
    country: string;
    durationHours: number;
  }): Promise<RentedNumber> {
    const dial = MOCK_BY_ID[opts.country]?.dial ?? "1";
    return {
      rentId: `mock-rent-${Date.now()}`,
      phoneNumber: `${dial}${String(Date.now()).slice(-9)}`,
      cost: 1.8,
      endTime: new Date(
        Date.now() + opts.durationHours * 3_600_000,
      ).toISOString(),
    };
  },
  async getServicesList(): Promise<ServiceListItem[]> {
    return [
      { code: "wa", name: "WhatsApp" },
      { code: "tg", name: "Telegram" },
      { code: "go", name: "Google, Youtube, Gmail" },
      { code: "ig", name: "Instagram" },
      { code: "fb", name: "Facebook" },
      { code: "ds", name: "Discord" },
      { code: "tw", name: "Twitter / X" },
    ];
  },
};

/**
 * Vrai si le client tourne en mode démo (données simulées). En mode HeroSMS,
 * la démo dépend uniquement de la présence de la clé HeroSMS (GRIZZLY_MOCK ne
 * concerne que Grizzly).
 */
export const isGrizzlyMock =
  env.smsProvider === "herosms"
    ? !env.heroSms.apiKey
    : env.grizzly.mock || !env.grizzly.apiKey;

/** Client Grizzly effectif : réel si une clé est configurée, sinon démo. */
export const grizzly = isGrizzlyMock ? mockGrizzly : liveGrizzly;
