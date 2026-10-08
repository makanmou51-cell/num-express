import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";

/**
 * Notifications navigateur (Web Push).
 *
 * Deux usages :
 *   - transactionnel : « ton code SMS est arrivé », envoyé à UN client ;
 *   - diffusion : « 501 nouveaux numéros WhatsApp disponibles », envoyé à tous
 *     les abonnés pour les faire revenir.
 *
 * Point important : on ne peut notifier QUE les gens qui ont explicitement
 * accepté dans leur navigateur. Aucun moyen d'inscrire quelqu'un d'autorité —
 * l'audience se construit dans le temps.
 */

let configured = false;

/** Configure la bibliothèque à la première utilisation. */
function ensureConfigured(): boolean {
  if (configured) return true;
  /* `.trim()` n'est pas cosmétique : une espace ou un retour à la ligne collé
     à la clé en la saisissant dans Vercel la rend invalide, et web-push lève
     « Vapid public key must be a URL safe Base 64 » — une erreur 500 opaque au
     moment de l'envoi. C'est exactement ce qui est arrivé en production. */
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:contact@num-express.com";
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(subject, pub, priv);
  } catch (e) {
    // Clé malformée : on le journalise clairement plutôt que de laisser
    // remonter une 500 sans explication.
    console.error("[push] clés VAPID invalides :", (e as Error).message);
    return false;
  }
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Page ouverte au clic. */
  url?: string;
  /** Regroupe les notifications de même nature (la nouvelle remplace l'ancienne). */
  tag?: string;
  icon?: string;
}

/**
 * Envoie à une liste d'abonnements et DÉSACTIVE ceux que le navigateur
 * déclare morts (404/410). Sans ce nettoyage, la table se remplit d'entrées
 * périmées et chaque diffusion devient plus lente pour rien.
 */
async function sendToAll(
  subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!ensureConfigured() || !subs.length) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;
  let failed = 0;

  // En séquence par paquets : une diffusion à 500 abonnés ne doit pas ouvrir
  // 500 connexions simultanées depuis une fonction serverless.
  const BATCH = 25;
  for (let i = 0; i < subs.length; i += BATCH) {
    const slice = subs.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          // 404 / 410 : l'abonnement n'existe plus côté navigateur.
          if (code === 404 || code === 410) {
            dead.push(s.id);
          } else {
            failed++;
            console.error("[push] échec", code, (e as Error).message);
          }
        }
      }),
    );
  }

  if (dead.length) {
    await prisma.pushSubscription.updateMany({
      where: { id: { in: dead } },
      data: { active: false },
    });
  }
  if (sent) {
    await prisma.pushSubscription.updateMany({
      where: { id: { in: subs.map((s) => s.id) } },
      data: { lastSentAt: new Date() },
    });
  }

  return { sent, failed, removed: dead.length };
}

/** Notifie UN utilisateur sur tous ses appareils. */
export async function pushToUser(userId: string, payload: PushPayload) {
  const subs = await prisma.pushSubscription.findMany({
    where: { userId, active: true },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  return sendToAll(subs, payload);
}

/** Diffusion à TOUS les abonnés, inscrits ou simples visiteurs. */
export async function pushToAll(payload: PushPayload) {
  const subs = await prisma.pushSubscription.findMany({
    where: { active: true },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  return sendToAll(subs, payload);
}

/** Nombre d'abonnements actifs — affiché dans l'admin avant une diffusion. */
export function countActiveSubscriptions() {
  return prisma.pushSubscription.count({ where: { active: true } });
}
