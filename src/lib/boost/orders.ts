import "server-only";
import { prisma } from "@/lib/db";
import { peakerr, PeakerrError, normalizeStatus } from "@/lib/peakerr/client";
import { findTier, tierIsLive, boostPriceXof } from "@/lib/boost/catalog";
import { applyWalletTx, InsufficientFundsError } from "@/lib/wallet";
import { pushToUser } from "@/lib/push";
import type { BoostOrder } from "@/generated/prisma/client";

export class BoostError extends Error {
  code: "INVALID" | "FUNDS" | "PROVIDER" | "UNAVAILABLE";
  constructor(code: BoostError["code"], message: string) {
    super(message);
    this.name = "BoostError";
    this.code = code;
  }
}

const TERMINAL = ["COMPLETED", "PARTIAL", "CANCELED", "FAILED", "REFUNDED"];

/** Passe une commande de boost : valide, débite le solde, envoie à Peakerr. */
export async function placeBoostOrder(
  userId: string,
  input: {
    network: string;
    service: string;
    tier: string;
    link: string;
    quantity: number;
  },
): Promise<BoostOrder> {
  const found = findTier(input.network, input.service, input.tier);
  if (!found) throw new BoostError("INVALID", "Service introuvable.");
  const { network: n, service: s, tier: t } = found;

  if (!tierIsLive(t)) {
    throw new BoostError(
      "UNAVAILABLE",
      "Ce service n'est pas encore disponible.",
    );
  }
  const link = input.link.trim();
  if (!/^https?:\/\/.+/i.test(link)) {
    throw new BoostError(
      "INVALID",
      "Lien invalide (il doit commencer par https://).",
    );
  }
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(qty) || qty < t.min || qty > t.max) {
    throw new BoostError(
      "INVALID",
      `La quantité doit être comprise entre ${t.min} et ${t.max}.`,
    );
  }
  const priceXof = boostPriceXof(t, qty);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  if (!user) throw new BoostError("INVALID", "Utilisateur introuvable.");
  if (user.balance < priceXof) {
    throw new BoostError("FUNDS", "Solde insuffisant. Rechargez votre compte.");
  }

  // 1) Commande chez Peakerr (avant le débit : si ça échoue, rien n'est prélevé).
  let orderId: string;
  try {
    ({ orderId } = await peakerr.addOrder(t.peakerrServiceId, link, qty));
  } catch (e) {
    if (e instanceof PeakerrError) throw new BoostError("PROVIDER", e.message);
    throw e;
  }

  // 2) Débit + création (atomique).
  try {
    return await prisma.$transaction(async (db) => {
      const bo = await db.boostOrder.create({
        data: {
          userId,
          network: n.key,
          serviceKey: `${n.key}_${s.key}_${t.key}`,
          serviceLabel: `${n.label} · ${s.label} (${t.label})`,
          peakerrServiceId: t.peakerrServiceId,
          link,
          quantity: qty,
          priceXof,
          providerOrderId: orderId,
          status: "PENDING",
        },
      });
      await applyWalletTx({
        userId,
        type: "PURCHASE",
        amount: -priceXof,
        description: `Boost ${n.label} · ${s.label}`,
        requireFunds: true,
        client: db,
      });
      return bo;
    });
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      throw new BoostError("FUNDS", "Solde insuffisant.");
    }
    throw e;
  }
}

async function refundBoost(bo: BoostOrder): Promise<void> {
  let rembourse = false;
  await prisma.$transaction(async (db) => {
    const fresh = await db.boostOrder.findUnique({
      where: { id: bo.id },
      select: { refunded: true },
    });
    if (!fresh || fresh.refunded) return;
    await applyWalletTx({
      userId: bo.userId,
      type: "REFUND",
      amount: bo.priceXof,
      description: `Remboursement · ${bo.serviceLabel}`,
      client: db,
    });
    await db.boostOrder.update({
      where: { id: bo.id },
      data: { refunded: true, status: "REFUNDED" },
    });
    rembourse = true;
  });

  /* On prévient le client. Sans ça il commande, Peakerr annule, on rembourse
     — et il n'en sait rien tant qu'il ne rouvre pas la page. Il croit avoir
     payé pour rien. Hors transaction et best-effort : un envoi raté ne doit
     pas annuler un remboursement déjà inscrit en base. */
  if (rembourse) {
    pushToUser(bo.userId, {
      title: "Commande boost remboursée",
      body: `${bo.serviceLabel} n'a pas pu être livrée. Tes ${bo.priceXof.toLocaleString("fr-FR")} F CFA sont de retour sur ton solde.`,
      url: "/boost",
      tag: `boost-remb-${bo.id}`,
    }).catch(() => {
      /* notification best-effort */
    });
  }
}

/** Interroge Peakerr pour mettre à jour l'état d'une commande (+ remboursement). */
export async function refreshBoostOrder(
  userId: string,
  id: string,
): Promise<BoostOrder | null> {
  const bo = await prisma.boostOrder.findFirst({ where: { id, userId } });
  if (!bo) return null;
  if (TERMINAL.includes(bo.status) || !bo.providerOrderId) return bo;

  let st;
  try {
    st = await peakerr.status(bo.providerOrderId);
  } catch {
    return bo; // erreur transitoire : on réessaiera
  }
  const status = normalizeStatus(st.status);
  const updated = await prisma.boostOrder.update({
    where: { id: bo.id },
    data: { status, startCount: st.startCount, remains: st.remains },
  });

  // Annulé / échoué -> remboursement (idempotent).
  if ((status === "CANCELED" || status === "FAILED") && !bo.refunded) {
    await refundBoost(updated);
    return prisma.boostOrder.findUnique({ where: { id: bo.id } });
  }
  return updated;
}

/** Rafraîchit les commandes non terminées d'un utilisateur (au chargement). */
export async function refreshUserBoosts(userId: string): Promise<void> {
  const pending = await prisma.boostOrder.findMany({
    where: { userId, status: { notIn: TERMINAL } },
    select: { id: true },
    take: 20,
  });
  for (const p of pending) await refreshBoostOrder(userId, p.id);
}

/** (Admin) Demande un refill Peakerr pour une commande (services refill=true). */
export async function refillBoostOrder(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const bo = await prisma.boostOrder.findUnique({ where: { id } });
  if (!bo || !bo.providerOrderId) {
    return { ok: false, message: "Commande introuvable." };
  }

  // Le statut affiché (« En attente ») peut être périmé : on relit le vrai état
  // chez Peakerr AVANT de refiller (souvent la commande est bien livrée).
  try {
    const st = await peakerr.status(bo.providerOrderId);
    await prisma.boostOrder.update({
      where: { id: bo.id },
      data: {
        status: normalizeStatus(st.status),
        startCount: st.startCount,
        remains: st.remains,
      },
    });
  } catch {
    /* statut non lu : on tente quand même le refill */
  }

  try {
    const { refillId } = await peakerr.refill(bo.providerOrderId);
    return {
      ok: true,
      message: `Refill demandé (réf. ${refillId}). Les abonnés perdus seront rechargés sous peu.`,
    };
  } catch (e) {
    if (e instanceof PeakerrError) return { ok: false, message: e.message };
    return { ok: false, message: "Erreur lors du refill." };
  }
}

export function listBoostOrders(userId: string, take = 30) {
  return prisma.boostOrder.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/**
 * Rafraîchit les commandes non terminées de TOUS les clients.
 *
 * Pourquoi cette fonction existe : jusqu'ici le statut d'une commande Boost
 * n'était mis à jour QUE lorsque le client rouvrait sa page /boost. Un client
 * qui commande et ne revient pas laissait sa commande figée sur « En cours »
 * indéfiniment — constaté en production : une commande bloquée depuis 20
 * jours. Et surtout, si Peakerr l'avait annulée, **le remboursement ne
 * partait jamais** : `refreshBoostOrder` est le seul endroit qui rembourse.
 *
 * Appelée par le cron quotidien. `deadlineMs` : la fonction Vercel est coupée
 * à 60 s et cette tâche partage son passage avec d'autres — on s'arrête avant,
 * le reste part au prochain tour.
 */
export async function sweepPendingBoosts(
  opts: { limit?: number; deadlineMs?: number } = {},
): Promise<{ checked: number; refunded: number }> {
  const pending = await prisma.boostOrder.findMany({
    where: { status: { notIn: TERMINAL }, providerOrderId: { not: null } },
    select: { id: true, userId: true },
    orderBy: { createdAt: "asc" }, // les plus vieilles d'abord
    take: opts.limit ?? 60,
  });

  const debut = Date.now();
  const deadline = opts.deadlineMs ?? 20_000;
  let checked = 0;
  let refunded = 0;

  for (const p of pending) {
    if (Date.now() - debut > deadline) break;
    try {
      const avant = await prisma.boostOrder.findUnique({
        where: { id: p.id },
        select: { refunded: true },
      });
      const apres = await refreshBoostOrder(p.userId, p.id);
      checked++;
      if (apres?.refunded && !avant?.refunded) refunded++;
    } catch (e) {
      // Une commande qui échoue ne doit pas arrêter le balayage.
      console.error(
        "[boost] synchronisation échouée",
        p.id,
        (e as Error).message,
      );
    }
  }
  return { checked, refunded };
}
