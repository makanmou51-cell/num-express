import "server-only";
import { env } from "@/lib/env";

/**
 * Sonde OnlineSim — appels BRUTS en lecture seule, exécutés depuis le serveur
 * (Vercel). Objectif : vérifier que l'IP du serveur n'est pas bloquée par leur
 * protection anti-bot, et relever les formats JSON exacts avant d'écrire le
 * vrai client. Aucun de ces appels n'achète de numéro.
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

export async function probeOnlineSim(
  action: string,
  params: Record<string, string | number | undefined> = {},
): Promise<ProbeResult> {
  const started = Date.now();
  const key = env.onlinesim.apiKey;
  if (!key) {
    return {
      action,
      ok: false,
      status: null,
      body: "",
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
        // Certaines protections rejettent les requêtes sans User-Agent.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
    });
    const text = (await res.text()).trim();
    return {
      action,
      ok: res.ok,
      status: res.status,
      // Tronqué : on veut juste calibrer le format, pas tout afficher.
      body: text.slice(0, 2000),
      ms: Date.now() - started,
    };
  } catch (e) {
    return {
      action,
      ok: false,
      status: null,
      body: "",
      error: (e as Error).message,
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}
