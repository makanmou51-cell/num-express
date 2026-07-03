import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { expireStaleActivations } from "@/lib/activations";

export const runtime = "nodejs";

/**
 * Cron : rembourse les activations expirées sans code.
 * Protégé par CRON_SECRET (header `x-cron-secret` ou query `?secret=`).
 * À planifier (Vercel Cron, GitHub Actions, cron système…), ex. toutes les 5 min.
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

  const result = await expireStaleActivations();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
