import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { expireStaleActivations } from "@/lib/activations";
import { resumePendingBroadcast } from "@/lib/broadcast";
import { sweepPendingBoosts } from "@/lib/boost/orders";

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

  /* Ce premier appel n'etait PAS protege, contrairement aux deux suivants.
     S'il echouait — API HeroSMS indisponible, coupure reseau — toute la
     fonction s'arretait sur une 500, et le balayage Boost comme la reprise
     de la diffusion e-mail ne tournaient pas du tout. Silencieusement, et
     tous les jours tant que la panne durait. Les trois taches sont
     independantes : l'echec de l'une ne doit pas emporter les autres. */
  let result: Awaited<ReturnType<typeof expireStaleActivations>> | null = null;
  let erreurActivations: string | null = null;
  try {
    result = await expireStaleActivations();
  } catch (e) {
    erreurActivations = (e as Error).message;
    console.error("[cron] expiration des activations echouee :", erreurActivations);
  }

  /* Commandes Boost : meme probleme que les activations. Leur statut n'etait
     mis a jour qu'au retour du client sur /boost ; une commande annulee par
     Peakerr n'etait donc JAMAIS remboursee si le client ne revenait pas. */
  let boosts = null;
  try {
    boosts = await sweepPendingBoosts({ limit: 60, deadlineMs: 15_000 });
  } catch (e) {
    console.error("[cron] balayage boost echoue :", (e as Error).message);
  }

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

  return NextResponse.json({
    ok: true,
    ...(result ?? {}),
    erreurActivations,
    boosts,
    diffusion,
  });
}

export const GET = handle;
export const POST = handle;
