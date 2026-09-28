"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { pushToAll } from "@/lib/push";
import {
  createBroadcast,
  currentBroadcast,
  sendBroadcastBatch,
  type BatchResult,
} from "@/lib/broadcast";
import type { ActionState } from "@/lib/forms";

export type BroadcastState = { error: string } | BatchResult | undefined;

/**
 * Crée la diffusion et envoie le PREMIER lot.
 *
 * Le reste part par lots quotidiens : c'est la seule façon de servir 480
 * clients avec un quota de 100 e-mails par jour sans perdre la trace de qui a
 * reçu quoi.
 */
export async function sendBroadcastAction(
  _prev: BroadcastState,
  formData: FormData,
): Promise<BroadcastState> {
  await requireAdmin();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (subject.length < 3) return { error: "Le sujet est trop court." };
  if (body.length < 10) return { error: "Le message est trop court." };

  // Deux diffusions en parallèle se disputeraient le quota et la reprise
  // automatique n'en servirait qu'une : on refuse tant que l'autre n'est pas
  // terminée (ou arrêtée à la main).
  const enCours = await currentBroadcast();
  if (enCours) {
    return {
      error:
        "Une diffusion est déjà en cours. Termine-la ou arrête-la avant d'en lancer une autre.",
    };
  }

  const bc = await createBroadcast(subject, body);
  const r = await sendBroadcastBatch(bc.id);
  revalidatePath("/admin/broadcast");
  return r;
}

/** Envoie le lot suivant de la diffusion en cours. */
export async function sendNextBatchAction(
  _prev: BroadcastState,
  formData: FormData,
): Promise<BroadcastState> {
  await requireAdmin();

  const id = String(formData.get("broadcastId") ?? "");
  if (!id) return { error: "Diffusion introuvable." };

  const r = await sendBroadcastBatch(id);
  revalidatePath("/admin/broadcast");
  return r;
}

/**
 * Arrête une diffusion en cours : les destinataires non encore servis ne
 * recevront rien. Sert à corriger une faute de frappe repérée après le
 * premier lot — les suivants ne partiront pas.
 */
export async function stopBroadcastAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("broadcastId") ?? "");
  if (!id) return { error: "Diffusion introuvable." };

  await prisma.broadcast.update({ where: { id }, data: { done: true } });
  revalidatePath("/admin/broadcast");
  return { success: "Diffusion arrêtée. Les lots suivants ne partiront pas." };
}

/**
 * Diffusion d'une notification navigateur à tous les abonnés.
 *
 * Réservé à l'admin : `requireAdmin()` protège l'action, sans quoi n'importe
 * qui pourrait envoyer une notification sous ta marque.
 */
export async function sendPushBroadcastAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const url = String(formData.get("url") ?? "/").trim() || "/";

  if (title.length < 3) return { error: "Le titre est trop court." };
  if (body.length < 5) return { error: "Le message est trop court." };
  // Une URL externe permettrait d'envoyer tes clients n'importe où depuis une
  // notification portant ton nom : on n'accepte que des chemins internes.
  if (!url.startsWith("/")) {
    return { error: "La page doit être un chemin interne, commençant par /." };
  }

  const r = await pushToAll({
    title,
    body,
    url,
    // Tag commun : une nouvelle annonce remplace la précédente si le client
    // n'a pas encore lu l'ancienne, au lieu d'empiler.
    tag: "annonce",
  });

  if (r.sent === 0 && r.failed === 0 && r.removed === 0) {
    // Deux causes possibles : personne d'abonné, ou les clés VAPID sont
    // absentes/invalides. On le dit, plutôt que de laisser croire à un envoi.
    const configured =
      Boolean(process.env.VAPID_PRIVATE_KEY?.trim()) &&
      Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim());
    return {
      error: configured
        ? "Aucun abonné actif pour l'instant."
        : "Notifications non configurées (clés VAPID manquantes ou invalides).",
    };
  }
  return {
    success:
      `Envoyée à ${r.sent} appareil${r.sent > 1 ? "s" : ""}.` +
      (r.removed ? ` ${r.removed} abonnement(s) expiré(s) nettoyé(s).` : "") +
      (r.failed ? ` ${r.failed} échec(s).` : ""),
  };
}
