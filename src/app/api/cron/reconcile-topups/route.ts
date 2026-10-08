import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sweepPendingTopups } from "@/lib/payments";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron : filet de sécurité des recharges.
 * - crédite les recharges réellement payées dont le webhook s'est perdu ;
 * - clôt les recharges jamais payées (sinon « En attente » à vie).
 * Protégé par CRON_SECRET (Bearer, header `x-cron-secret` ou `?secret=`).
 * Appelable aussi à la main pour forcer un balayage immédiat.
 */
async function handle(req: Request) {
  if (!env.cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET non configuré." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  // Vercel Cron ajoute automatiquement `Authorization: Bearer <CRON_SECRET>`.
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const provided =
    bearer ||
    req.headers.get("x-cron-secret") ||
    url.searchParams.get("secret") ||
    "";
  if (provided !== env.cronSecret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const limitRaw = Number(url.searchParams.get("limit") ?? 150);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(500, Math.max(1, Math.floor(limitRaw)))
    : 150;

  const result = await sweepPendingTopups(limit);
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
