import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { applyWalletTx } from "@/lib/wallet";
import { sendMail, broadcastTemplate } from "@/lib/mailer";
import { peakerr } from "@/lib/peakerr/client";

export interface AdminStats {
  users: number;
  activations: number;
  grossSales: number; // total dépensé en achats (F CFA)
  liabilities: number; // somme des soldes utilisateurs (dette)
  topups: number; // total des recharges validées
  commissions: number; // total des commissions versées
}

export async function getAdminStats(): Promise<AdminStats> {
  const [users, activations, purchaseAgg, balanceAgg, topupAgg, commissionAgg] =
    await Promise.all([
      prisma.user.count(),
      prisma.activation.count(),
      prisma.transaction.aggregate({
        where: { type: "PURCHASE" },
        _sum: { amount: true },
      }),
      prisma.user.aggregate({ _sum: { balance: true } }),
      prisma.transaction.aggregate({
        where: { type: "TOPUP", status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: "REFERRAL" },
        _sum: { amount: true },
      }),
    ]);

  return {
    users,
    activations,
    grossSales: Math.abs(purchaseAgg._sum.amount ?? 0),
    liabilities: balanceAgg._sum.balance ?? 0,
    topups: topupAgg._sum.amount ?? 0,
    commissions: commissionAgg._sum.amount ?? 0,
  };
}

export interface SalesPoint {
  at: string; // ISO
  amount: number; // F CFA
}

/**
 * Recharges VALIDÉES (le vrai chiffre d'affaires encaissé) sur la période, en
 * points bruts. Le client les regroupe par jour / semaine / mois.
 */
export async function getSalesData(
  days = 400,
): Promise<{ topups: SalesPoint[] }> {
  const since = new Date(Date.now() - days * 86_400_000);
  const topups = await prisma.transaction.findMany({
    where: { type: "TOPUP", status: "COMPLETED", createdAt: { gte: since } },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    topups: topups.map((t) => ({
      at: t.createdAt.toISOString(),
      amount: t.amount,
    })),
  };
}

/** Nombre total de destinataires potentiels d'une diffusion e-mail. */
export async function countRecipients(): Promise<number> {
  return prisma.user.count();
}

export async function listUsers(query?: string, take = 50) {
  return prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query } },
            { name: { contains: query } },
            { referralCode: { contains: query.toUpperCase() } },
          ],
        }
      : undefined,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      balance: true,
      emailVerifiedAt: true,
      createdAt: true,
      _count: { select: { activations: true, referrals: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getUserDetail(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      balance: true,
      emailVerifiedAt: true,
      referralCode: true,
      createdAt: true,
      referredBy: { select: { email: true, referralCode: true } },
      _count: { select: { activations: true, referrals: true } },
    },
  });
  if (!user) return null;

  const [transactions, activations, rentals] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.activation.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.rental.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return { user, transactions, activations, rentals };
}

/** Crédite/débite manuellement le solde d'un utilisateur (action admin). */
export async function manualAdjustBalance(
  userId: string,
  amount: number,
  reason: string,
) {
  return applyWalletTx({
    userId,
    type: amount >= 0 ? "TOPUP" : "ADJUSTMENT",
    amount,
    provider: "MANUAL",
    description: reason || "Ajustement administrateur",
    requireFunds: amount < 0, // empêche un solde négatif sur un débit
  });
}

export async function setUserRole(userId: string, role: "USER" | "ADMIN") {
  return prisma.user.update({ where: { id: userId }, data: { role } });
}

/** Statistiques Boost pour l'admin (CA, commandes, solde Peakerr). */
export async function getBoostAdminStats() {
  const [total, revenue, byStatus, peakBal] = await Promise.all([
    prisma.boostOrder.count(),
    prisma.boostOrder.aggregate({
      _sum: { priceXof: true },
      where: { refunded: false },
    }),
    prisma.boostOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    peakerr.balance().catch(() => null),
  ]);
  const counts: Record<string, number> = {};
  for (const g of byStatus) counts[g.status] = g._count._all;
  const inProgress =
    (counts.PENDING ?? 0) +
    (counts.PROCESSING ?? 0) +
    (counts.IN_PROGRESS ?? 0);
  const done = (counts.COMPLETED ?? 0) + (counts.PARTIAL ?? 0);
  return {
    total,
    revenueXof: revenue._sum.priceXof ?? 0,
    inProgress,
    done,
    peakerrBalance: peakBal, // { balance, currency } | null
  };
}

/** Dernières commandes Boost (tous utilisateurs), pour l'admin. */
export async function listAllBoostOrders(take = 30) {
  return prisma.boostOrder.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { email: true } } },
  });
}

/** Dernières RECHARGES validées (qui vient de charger son compte). */
export async function listRecentTopups(take = 15) {
  return prisma.transaction.findMany({
    where: { type: "TOPUP", status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { email: true, name: true } } },
  });
}

/** Derniers ACHATS (numéros, boost, location) — qui vient d'acheter. */
export async function listRecentPurchases(take = 15) {
  return prisma.transaction.findMany({
    where: { type: "PURCHASE" },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { email: true, name: true } } },
  });
}

/** Envoie un e-mail à UN client précis (action admin). `{nom}` -> prénom. */
export async function sendUserEmail(
  userId: string,
  subject: string,
  body: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) throw new Error("Utilisateur introuvable.");

  const prenom = user.name?.trim().split(/\s+/)[0] || "cher client";
  const subj = subject.replace(/\{nom\}/gi, prenom);
  const text = body.replace(/\{nom\}/gi, prenom);

  const replyTo = env.mail.replyTo || undefined;
  await sendMail({
    to: user.email,
    subject: subj,
    html: broadcastTemplate(subj, text),
    text,
    replyTo,
    headers: replyTo
      ? { "List-Unsubscribe": `<mailto:${replyTo}?subject=Desabonnement>` }
      : undefined,
  });
  return user.email;
}
