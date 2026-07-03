import "server-only";
import { prisma } from "@/lib/db";
import { applyWalletTx } from "@/lib/wallet";

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

  const [transactions, activations] = await Promise.all([
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
  ]);

  return { user, transactions, activations };
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
