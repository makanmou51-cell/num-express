import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { grizzly } from "@/lib/grizzly/client";
import { payReferralCommission } from "@/lib/affiliate";
import { notifyCodeReceived } from "@/lib/activations";

export const runtime = "nodejs";

/**
 * Webhook HeroSMS — le code arrive, on le livre immédiatement.
 *
 * Jusqu'ici la page d'attente interrogeait `getStatus` toutes les 3 secondes.
 * Deux défauts : un délai moyen d'une seconde et demie entre l'arrivée réelle
 * du SMS et son affichage, et surtout — si le client FERME la page, plus
 * personne n'interroge. Or on lui conseille justement de la fermer pour aller
 * sur WhatsApp. Son code pouvait donc arriver sans que rien ne le lui dise.
 *
 * HeroSMS pousse l'événement `sms-incoming` en POST JSON dès réception :
 *   { activationId, phoneFrom, service, text, code, country, receivedAt }
 *
 * Leur documentation précise qu'il faut répondre 200 même si le SMS a déjà
 * été traité — sans quoi ils réessaient 7 fois sur 3 minutes. On répond donc
 * 200 dans tous les cas où la requête est légitime, y compris sur un doublon.
 */

/* Adresses sources déclarées par HeroSMS. Le webhook crédite une activation
   et envoie une notification au client : sans ce filtre, n'importe qui
   pourrait injecter un faux code dans le compte d'un client en devinant un
   identifiant d'activation. */
const IP_HEROSMS = new Set(["84.32.223.53", "185.138.88.87"]);

function ipSource(req: Request): string {
  // Vercel place l'IP réelle du client en tête de x-forwarded-for.
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return (
    (xff.split(",")[0] ?? "").trim() || (req.headers.get("x-real-ip") ?? "")
  );
}

export async function POST(req: Request) {
  const ip = ipSource(req);
  if (!IP_HEROSMS.has(ip)) {
    console.warn("[webhook herosms] IP refusée :", ip || "(inconnue)");
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let body: {
    activationId?: number | string;
    code?: string | null;
    text?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const providerId = String(body.activationId ?? "").trim();
  if (!providerId) {
    return NextResponse.json(
      { error: "activationId manquant" },
      { status: 400 },
    );
  }

  const activation = await prisma.activation.findUnique({
    where: { providerActivationId: providerId },
  });
  // Activation inconnue : on répond 200 pour qu'ils cessent de réessayer —
  // rejouer ne la fera pas apparaître.
  if (!activation) return NextResponse.json({ ok: true, ignored: "inconnue" });

  const code = body.code?.trim();
  if (!code) {
    // SMS sans code extrait (message publicitaire, format non reconnu) :
    // on accuse réception et on laisse l'activation en attente.
    return NextResponse.json({ ok: true, ignored: "sans code" });
  }

  /* Revendication atomique : le webhook et le polling de la page arrivent
     SIMULTANÉMENT par conception. Sans cette condition dans le WHERE, les
     deux passeraient le test et verseraient chacun la commission de
     parrainage — le même piège qui a produit 169 250 F de doubles
     remboursements la semaine dernière. */
  const claim = await prisma.activation.updateMany({
    where: { id: activation.id, status: "WAITING_CODE" },
    data: { status: "RECEIVED", smsCode: code, smsText: body.text ?? null },
  });
  if (claim.count === 0) {
    // Déjà traité par le polling : succès, pas de double traitement.
    return NextResponse.json({ ok: true, ignored: "déjà traité" });
  }

  // Clore côté fournisseur et verser la commission — best effort, hors du
  // chemin critique : un échec ici ne doit pas faire rejouer le webhook.
  grizzly.finish(providerId).catch(() => {});
  payReferralCommission(
    activation.userId,
    activation.id,
    activation.priceXof,
  ).catch(() => {});

  /* Même notification que par le polling : on réutilise le helper partagé
     plutôt que d'en écrire une seconde version, qui divergerait au premier
     changement de libellé. */
  notifyCodeReceived(activation.userId, code, activation.id);

  return NextResponse.json({ ok: true });
}
