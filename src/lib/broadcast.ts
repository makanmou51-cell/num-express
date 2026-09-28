import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMail, broadcastTemplate } from "@/lib/mailer";

/**
 * Diffusion e-mail PAR LOTS, reprenable.
 *
 * Pourquoi : l'ancienne version parcourait les 480 clients d'un seul appel.
 * Deux murs, atteints le même jour :
 *   - Resend (plan gratuit) plafonne à 100 envois par JOUR ;
 *   - une fonction Vercel est coupée à 60 s, et 480 × 120 ms = 58 s avant même
 *     de compter le temps de réponse de l'API.
 * Résultat : quota explosé, liste traitée à moitié, et aucun moyen de savoir
 * qui avait reçu le message.
 *
 * Ici, chaque destinataire traité laisse une ligne `BroadcastDelivery`. La
 * reprise sélectionne les utilisateurs SANS ligne : relancer dix fois
 * n'enverra jamais deux fois au même.
 */

/** Marge sous le quota Resend de 100/jour : on garde de la place pour les
 *  e-mails transactionnels (confirmations d'inscription, mots de passe). */
export const DAILY_LIMIT = 80;

/** On s'arrête avant la coupure à 60 s de la fonction Vercel. */
const DEFAULT_DEADLINE_MS = 45_000;

/** Pause entre deux envois — reste sous la limite de débit de Resend. */
const THROTTLE_MS = 120;

/** Raison pour laquelle le lot s'est arrêté. */
export type StopReason =
  | "termine" // plus personne à servir
  | "lot-plein" // le quota du jour est atteint
  | "temps" // la fonction allait être coupée
  | "quota-fournisseur"; // Resend a refusé : quota journalier dépassé

export interface BatchResult {
  broadcastId: string;
  sent: number;
  failed: number;
  remaining: number;
  done: boolean;
  reason: StopReason;
}

/**
 * Le refus de Resend pour cause de quota ne doit PAS marquer le destinataire
 * comme traité : sinon il serait définitivement sauté alors qu'il n'a rien
 * reçu. On distingue donc le mur de quota d'une vraie erreur (adresse
 * invalide, domaine inexistant), qui elle mérite d'être enregistrée.
 */
function estMurDeQuota(message: string): boolean {
  const m = message.toLowerCase();
  if (/\b429\b/.test(m)) return true;
  return (
    m.includes("daily") ||
    m.includes("quota") ||
    m.includes("rate limit") ||
    m.includes("rate_limit") ||
    m.includes("too many requests")
  );
}

/** Crée la diffusion sans rien envoyer. L'envoi se fait par lots ensuite. */
export function createBroadcast(subject: string, body: string) {
  return prisma.broadcast.create({ data: { subject, body } });
}

/** La diffusion en cours, s'il y en a une. */
export function currentBroadcast() {
  return prisma.broadcast.findFirst({
    where: { done: false },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Nombre d'e-mails de diffusion partis DEPUIS MINUIT (UTC), toutes diffusions
 * confondues. C'est ce chiffre — pas le nombre par lot — qui doit rester sous
 * le quota du fournisseur : sans ça, cliquer deux fois sur « envoyer le lot
 * suivant » le même jour ferait sauter le quota une seconde fois.
 *
 * Journée calendaire et non fenêtre glissante de 24 h, pour deux raisons :
 * c'est ainsi que Resend remet son compteur à zéro, et une fenêtre glissante
 * bloquerait le cron. Celui-ci passe à 3 h UTC ; à 3 h le lendemain, le lot
 * de la veille serait encore dans les 24 h écoulées, le quota paraîtrait
 * plein, et plus aucun lot ne partirait jamais.
 */
export async function sentToday(): Promise<number> {
  const minuit = new Date();
  minuit.setUTCHours(0, 0, 0, 0);
  return prisma.broadcastDelivery.count({
    where: { ok: true, sentAt: { gte: minuit } },
  });
}

/** Avancement d'une diffusion : traités / restants. */
export async function broadcastProgress(broadcastId: string) {
  const [total, traites, ok] = await Promise.all([
    prisma.user.count(),
    prisma.broadcastDelivery.count({ where: { broadcastId } }),
    prisma.broadcastDelivery.count({ where: { broadcastId, ok: true } }),
  ]);
  return {
    total,
    done: traites,
    ok,
    failed: traites - ok,
    remaining: Math.max(0, total - traites),
  };
}

/**
 * Envoie le prochain lot. Idempotent : les destinataires déjà traités sont
 * exclus, et la contrainte d'unicité `[broadcastId, userId]` sert de filet.
 */
export async function sendBroadcastBatch(
  broadcastId: string,
  opts: { limit?: number; deadlineMs?: number } = {},
): Promise<BatchResult> {
  const deadlineMs = opts.deadlineMs ?? DEFAULT_DEADLINE_MS;

  const bc = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!bc) throw new Error("Diffusion introuvable.");

  async function cloture(reason: StopReason, sent: number, failed: number) {
    const p = await broadcastProgress(broadcastId);
    const done = p.remaining === 0;
    if (done) {
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: { done: true },
      });
    }
    return {
      broadcastId,
      sent,
      failed,
      remaining: p.remaining,
      done,
      reason: done ? ("termine" as StopReason) : reason,
    };
  }

  // Ce qu'il reste de quota aujourd'hui.
  const restantAujourdhui = Math.max(0, DAILY_LIMIT - (await sentToday()));
  const limite = Math.min(opts.limit ?? DAILY_LIMIT, restantAujourdhui);
  if (limite <= 0) return cloture("lot-plein", 0, 0);

  // Les destinataires déjà traités, pour les exclure.
  const traites = await prisma.broadcastDelivery.findMany({
    where: { broadcastId },
    select: { userId: true },
  });
  const dejaVus = traites.map((d) => d.userId);

  const restants = await prisma.user.findMany({
    where: dejaVus.length ? { id: { notIn: dejaVus } } : {},
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
    take: limite,
  });

  if (!restants.length) return cloture("termine", 0, 0);

  const replyTo = env.mail.replyTo || undefined;
  const headers = replyTo
    ? { "List-Unsubscribe": `<mailto:${replyTo}?subject=Desabonnement>` }
    : undefined;

  const start = Date.now();
  let sent = 0;
  let failed = 0;

  for (const u of restants) {
    if (Date.now() - start > deadlineMs) return cloture("temps", sent, failed);

    // Personnalisation : un message qui ressemble à un courrier personnel a
    // bien plus de chances d'atterrir dans « Principale » que dans
    // « Promotions ».
    const prenom = u.name?.trim().split(/\s+/)[0] || "cher client";
    const subj = bc.subject.replace(/\{nom\}/gi, prenom);
    const body = bc.body.replace(/\{nom\}/gi, prenom);

    let ok = true;
    let error: string | null = null;
    try {
      await sendMail({
        to: u.email,
        subject: subj,
        html: broadcastTemplate(subj, body),
        text: body,
        replyTo,
        headers,
      });
      sent++;
    } catch (e) {
      const message = (e as Error).message;
      if (estMurDeQuota(message)) {
        // On s'arrête net SANS enregistrer : ce client n'a rien reçu, il doit
        // rester dans la file pour le lot de demain.
        console.warn("[diffusion] quota fournisseur atteint :", message);
        return cloture("quota-fournisseur", sent, failed);
      }
      ok = false;
      error = message.slice(0, 300);
      failed++;
      console.error("[diffusion] échec pour", u.email, error);
    }

    // On enregistre le destinataire traité MÊME en cas d'échec « définitif »
    // (adresse invalide) : sans ça, elle serait retentée à chaque lot et
    // bloquerait la file derrière elle.
    await prisma.broadcastDelivery.create({
      data: { broadcastId, userId: u.id, email: u.email, ok, error },
    });

    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }

  return cloture("lot-plein", sent, failed);
}

/**
 * Reprise automatique, appelée par le cron quotidien. Traite le prochain lot
 * de la diffusion en cours, s'il y en a une.
 */
export async function resumePendingBroadcast(
  opts: { deadlineMs?: number } = {},
): Promise<BatchResult | null> {
  const bc = await currentBroadcast();
  if (!bc) return null;
  return sendBroadcastBatch(bc.id, opts);
}
