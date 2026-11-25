import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";

/**
 * Comparaison de secrets en TEMPS CONSTANT.
 *
 * Un `a !== b` classique s'arrête au premier caractère différent : le temps de
 * réponse fuit alors, octet par octet, à quel endroit le secret diffère. Sur un
 * secret à forte entropie et via le réseau l'attaque reste très difficile, mais
 * un secret se compare toujours en temps constant — c'est gratuit et correct.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual exige deux tampons de MÊME longueur ; une différence de
  // longueur n'est pas secrète, on la tranche avant (sans court-circuit sur le
  // contenu).
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export type CronAuth = "ok" | "unauthorized" | "unconfigured";

/**
 * Vérifie le secret d'un appel cron, accepté sous trois formes (dans cet ordre) :
 *   - en-tête `Authorization: Bearer <CRON_SECRET>` (ajouté par Vercel Cron) ;
 *   - en-tête `x-cron-secret` ;
 *   - paramètre d'URL `?secret=` (pratique pour un déclenchement manuel).
 *
 * Renvoie `"unconfigured"` si `CRON_SECRET` n'est pas défini (fail-closed côté
 * appelant), sinon `"ok"` / `"unauthorized"`. Comparaison en temps constant.
 */
export function checkCronAuth(req: Request): CronAuth {
  if (!env.cronSecret) return "unconfigured";
  const url = new URL(req.url);
  const authz = req.headers.get("authorization") ?? "";
  const bearer = authz.toLowerCase().startsWith("bearer ")
    ? authz.slice(7).trim()
    : "";
  const provided =
    bearer ||
    req.headers.get("x-cron-secret") ||
    url.searchParams.get("secret") ||
    "";
  return safeEqual(provided, env.cronSecret) ? "ok" : "unauthorized";
}
