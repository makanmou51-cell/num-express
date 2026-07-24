import "server-only";
import { env } from "@/lib/env";

/**
 * Sonde OnlineSim — appels BRUTS en lecture seule, exécutés depuis le serveur
 * (Vercel). Sert à relever les formats JSON exacts avant d'écrire le vrai
 * client. Aucun de ces appels n'achète de numéro.
 */
const BASE = "https://onlinesim.io/api";

export interface ProbeResult {
  action: string;
  ok: boolean;
  status: number | null;
  body: string;
  error?: string;
  ms: number;
}

interface RawResult {
  ok: boolean;
  status: number | null;
  text: string;
  error?: string;
  ms: number;
}

async function fetchOnlineSim(
  action: string,
  params: Record<string, string | number | undefined> = {},
): Promise<RawResult> {
  const started = Date.now();
  const key = env.onlinesim.apiKey;
  if (!key) {
    return {
      ok: false,
      status: null,
      text: "",
      error: "ONLINESIM_API_KEY non configurée",
      ms: 0,
    };
  }

  const url = new URL(`${BASE}/${action}.php`);
  url.searchParams.set("apikey", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
    });
    return {
      ok: res.ok,
      status: res.status,
      text: (await res.text()).trim(),
      ms: Date.now() - started,
    };
  } catch (e) {
    return {
      ok: false,
      status: null,
      text: "",
      error: (e as Error).message,
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeOnlineSim(
  action: string,
  params: Record<string, string | number | undefined> = {},
): Promise<ProbeResult> {
  const r = await fetchOnlineSim(action, params);
  let body = r.text;
  // Ré-indente si c'est du JSON : bien plus lisible qu'une ligne unique.
  try {
    body = JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    /* pas du JSON : on garde le texte brut */
  }
  return {
    action,
    ok: r.ok,
    status: r.status,
    body: body.slice(0, 1500),
    error: r.error,
    ms: r.ms,
  };
}

/**
 * getNumbersStats ne renvoie les prix que pour UN pays. Pour bâtir le
 * catalogue il faut tous les pays d'un service en un appel — on teste ici
 * les variantes possibles pour trouver laquelle le permet.
 */
export interface StrategyResult {
  label: string;
  status: number | null;
  bytes: number;
  topKeys: string[];
  entryCount: number | null;
  hasWhatsapp: boolean;
  hasPrice: boolean;
  snippet: string;
  error?: string;
}

export async function inspectCatalogStrategies(): Promise<StrategyResult[]> {
  const variants: {
    label: string;
    action: string;
    params: Record<string, string | number>;
  }[] = [
    {
      label: "getNumbersStats?service=whatsapp",
      action: "getNumbersStats",
      params: { service: "whatsapp" },
    },
    { label: "getNumbersStats (sans param)", action: "getNumbersStats", params: {} },
    {
      label: "getTariffs?service=whatsapp",
      action: "getTariffs",
      params: { service: "whatsapp" },
    },
    { label: "getTariffs?country=49", action: "getTariffs", params: { country: 49 } },
  ];

  return Promise.all(
    variants.map(async (v) => {
      const r = await fetchOnlineSim(v.action, v.params);
      const base: StrategyResult = {
        label: v.label,
        status: r.status,
        bytes: r.text.length,
        topKeys: [],
        entryCount: null,
        hasWhatsapp: /whatsapp/i.test(r.text),
        hasPrice: /"price"/.test(r.text),
        snippet: "",
        error: r.error,
      };
      try {
        const j = JSON.parse(r.text) as Record<string, unknown>;
        base.topKeys = Object.keys(j).slice(0, 8);
        // La charge utile est soit à la racine, soit sous "countries".
        const holder =
          (j.countries as Record<string, unknown> | undefined) ??
          (j as Record<string, unknown>);
        const keys = Object.keys(holder).filter((k) => k.startsWith("_"));
        if (keys.length) {
          base.entryCount = keys.length;
          base.snippet = `"${keys[0]}": ${pretty(holder[keys[0]])}`;
        } else {
          base.snippet = pretty(j);
        }
      } catch {
        base.snippet = r.text.slice(0, 400);
      }
      return base;
    }),
  );
}

/** Ce qu'on cherche à savoir pour écrire le client. */
export interface OnlineSimInspect {
  balance: string;
  countryCount: number | null;
  countrySample: string | null;
  serviceKeys: string[];
  whatsappKey: string | null;
  whatsappEntry: string | null;
  notes: string[];
}

function pretty(v: unknown): string {
  return JSON.stringify(v, null, 2).slice(0, 900);
}

/**
 * Extrait précisément : le solde, la forme d'un pays, la liste des services
 * d'un pays et l'entrée WhatsApp (pour connaître le nom du service et le
 * champ contenant le prix).
 */
export async function inspectOnlineSim(
  countryCode = 49,
): Promise<OnlineSimInspect> {
  const notes: string[] = [];
  const out: OnlineSimInspect = {
    balance: "?",
    countryCount: null,
    countrySample: null,
    serviceKeys: [],
    whatsappKey: null,
    whatsappEntry: null,
    notes,
  };

  const [bal, tariffs, stats] = await Promise.all([
    fetchOnlineSim("getBalance"),
    fetchOnlineSim("getTariffs"),
    fetchOnlineSim("getNumbersStats", { country: countryCode }),
  ]);

  // Solde
  try {
    const j = JSON.parse(bal.text) as { balance?: unknown };
    out.balance = String(j.balance ?? "?");
  } catch {
    notes.push(`getBalance illisible: ${bal.error ?? bal.text.slice(0, 120)}`);
  }

  // Pays (getTariffs)
  try {
    const j = JSON.parse(tariffs.text) as {
      countries?: Record<string, unknown>;
    };
    const c = j.countries;
    if (c && typeof c === "object") {
      const keys = Object.keys(c);
      out.countryCount = keys.length;
      out.countrySample = `"${keys[0]}": ${pretty(c[keys[0]])}`;
    } else {
      notes.push("getTariffs: pas de clé 'countries'.");
    }
  } catch {
    notes.push(
      `getTariffs illisible: ${tariffs.error ?? tariffs.text.slice(0, 120)}`,
    );
  }

  // Services d'un pays (getNumbersStats)
  try {
    const j = JSON.parse(stats.text) as Record<string, unknown>;
    // Selon les cas la charge utile est à la racine ou sous une clé pays.
    const holder =
      (j.services ? j : (Object.values(j).find(
        (v) => v && typeof v === "object" && "services" in (v as object),
      ) as Record<string, unknown> | undefined)) ?? j;
    const services = holder?.services as Record<string, unknown> | undefined;
    if (services && typeof services === "object") {
      const keys = Object.keys(services);
      out.serviceKeys = keys.slice(0, 60);
      const waKey =
        keys.find((k) => /whats/i.test(k)) ??
        keys.find((k) => /(^|_)wa($|_)/i.test(k)) ??
        null;
      out.whatsappKey = waKey;
      if (waKey) out.whatsappEntry = pretty(services[waKey]);
      else notes.push("Aucune clé de service contenant 'whats' trouvée.");
    } else {
      notes.push(
        `getNumbersStats: pas de clé 'services'. Début: ${stats.text.slice(0, 200)}`,
      );
    }
  } catch {
    notes.push(
      `getNumbersStats illisible: ${stats.error ?? stats.text.slice(0, 120)}`,
    );
  }

  return out;
}
