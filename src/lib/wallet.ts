import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export class InsufficientFundsError extends Error {
  constructor() {
    super("Solde insuffisant.");
    this.name = "InsufficientFundsError";
  }
}

export type TxType =
  | "TOPUP"
  | "PURCHASE"
  | "REFUND"
  | "ADJUSTMENT"
  | "REFERRAL";

export interface ApplyTxOptions {
  userId: string;
  type: TxType;
  amount: number; // signé : + crédit, - débit (F CFA)
  provider?: string; // FEDAPAY | MANUAL | INTERNAL
  providerRef?: string;
  description?: string;
  activationId?: string;
  requireFunds?: boolean; // refuse si le solde deviendrait négatif
  client?: Prisma.TransactionClient; // pour s'inscrire dans une transaction existante
}

/**
 * Applique un mouvement de wallet de façon atomique : met à jour le solde et
 * écrit une ligne au grand-livre. Lève InsufficientFundsError si requireFunds.
 */
export async function applyWalletTx(opts: ApplyTxOptions) {
  const run = async (tx: Prisma.TransactionClient) => {
    let balanceAfter: number;

    if (opts.requireFunds && opts.amount < 0) {
      // Débit conditionnel ATOMIQUE : n'applique le décrément que si le solde
      // suffit (évite toute course / lost-update / solde négatif).
      const res = await tx.user.updateMany({
        where: { id: opts.userId, balance: { gte: -opts.amount } },
        data: { balance: { increment: opts.amount } },
      });
      if (res.count === 0) {
        const exists = await tx.user.findUnique({
          where: { id: opts.userId },
          select: { id: true },
        });
        if (!exists) throw new Error("Utilisateur introuvable");
        throw new InsufficientFundsError();
      }
      const u = await tx.user.findUnique({
        where: { id: opts.userId },
        select: { balance: true },
      });
      balanceAfter = u!.balance;
    } else {
      // Crédit / ajustement : increment atomique.
      const updated = await tx.user.update({
        where: { id: opts.userId },
        data: { balance: { increment: opts.amount } },
        select: { balance: true },
      });
      balanceAfter = updated.balance;
    }

    const transaction = await tx.transaction.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        amount: opts.amount,
        balanceAfter,
        status: "COMPLETED",
        provider: opts.provider ?? "INTERNAL",
        providerRef: opts.providerRef,
        description: opts.description,
        activationId: opts.activationId,
      },
    });

    return { transaction, balanceAfter };
  };

  return opts.client ? run(opts.client) : prisma.$transaction(run);
}

/** Liste paginée des transactions d'un utilisateur (plus récentes d'abord). */
export function listTransactions(userId: string, take = 20) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
