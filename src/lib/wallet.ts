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
  "TOPUP" | "PURCHASE" | "REFUND" | "ADJUSTMENT" | "REFERRAL";

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

/**
 * Fourchette de prix réellement pratiquée sur les numéros.
 *
 * Sert à écrire, sur l'écran de recharge, ce que chaque montant permet
 * d'acheter. Sans cette information le client venait de la publicité, prenait
 * le premier montant proposé (500 F) et découvrait ensuite qu'aucun numéro ne
 * descend sous 2 750 F : 14 des 15 clients qui ont payé sans jamais acheter
 * étaient exactement dans ce cas.
 *
 * Mesuré sur les ventes plutôt que codé en dur : le prix suit le coût
 * fournisseur et le taux de change, une constante serait fausse en un mois.
 * Lecture sur 90 jours pour ne pas traîner d'anciens tarifs.
 */
export async function numberPriceRange(): Promise<{
  min: number;
  median: number;
} | null> {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const rows = await prisma.activation.findMany({
    where: { createdAt: { gte: since } },
    select: { priceXof: true },
    orderBy: { priceXof: "asc" },
  });
  if (rows.length < 5) return null; // trop peu de ventes : on n'affirme rien
  return {
    min: rows[0].priceXof,
    median: rows[Math.floor(rows.length / 2)].priceXof,
  };
}
