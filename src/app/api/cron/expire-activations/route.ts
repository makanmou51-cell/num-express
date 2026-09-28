import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { expireStaleActivations } from "@/lib/activations";
import { resumePendingBroadcast } from "@/lib/broadcast";

export const runtime = "nodejs";
// Deux tâches dans le même appel (voir plus bas) : il faut la durée maximale.
export const maxDuration = 60;

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

  const debut = Date.now();
  const result = await expireStaleActivations();

  /* Reprise de la diffusion e-mail en cours.
     Elle est greffée ICI, et pas dans un cron dédié, parce que le plan Vercel
     Hobby n'autorise que deux tâches planifiées — toutes deux déjà utilisées.
     Les remboursements passent d'abord (c'est de l'argent client), la
     diffusion prend le temps qu'il reste avant la coupure à 60 s. Si le lot
     est écourté, rien n'est perdu : les clients non servis restent dans la
     file et repartent au prochain passage. */
  let diffusion = null;
  try {
    const restant = 50_000 - (Date.now() - debut);
    if (restant > 5_000) {
      diffusion = await resumePendingBroadcast({ deadlineMs: restant });
    }
  } catch (e) {
    // Une diffusion en échec ne doit pas faire passer le cron pour cassé :
    // les remboursements, eux, ont bien eu lieu.
    console.error(
      "[cron] reprise de diffusion échouée :",
      (e as Error).message,
    );
  }

  return NextResponse.json({ ok: true, ...result, diffusion });
}

export const GET = handle;
export const POST = handle;
