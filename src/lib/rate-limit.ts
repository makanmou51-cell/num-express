import "server-only";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limiting distribué (Upstash Redis) — actif uniquement si configuré.
// Sans clés, checkRateLimit laisse tout passer (dev / non configuré).
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

type Window = `${number} s` | `${number} m` | `${number} h`;

function make(limit: number, window: Window): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: "ne-rl",
    analytics: false,
  });
}

// Limiteurs par usage (par IP).
const limiters = {
  auth: make(10, "10 m"), // connexion / inscription
  reset: make(5, "15 m"), // mot de passe oublié
  topup: make(20, "10 m"), // initiation de recharge
  purchase: make(60, "10 m"), // achats de numéros
} as const;

export type RateLimitKind = keyof typeof limiters;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Retourne true si la requête est autorisée, false si la limite est atteinte.
 * No-op (true) si Upstash n'est pas configuré.
 */
export async function checkRateLimit(
  kind: RateLimitKind,
  extraKey?: string,
): Promise<boolean> {
  const limiter = limiters[kind];
  if (!limiter) return true;
  try {
    const ip = await clientIp();
    const { success } = await limiter.limit(`${kind}:${ip}:${extraKey ?? ""}`);
    return success;
  } catch {
    // En cas de panne Redis, on ne bloque pas les utilisateurs légitimes.
    return true;
  }
}
