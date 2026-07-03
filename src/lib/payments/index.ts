import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { moneyfusionProvider } from "@/lib/payments/moneyfusion";
import { leekpayProvider } from "@/lib/payments/leekpay";
import { fedapayProvider } from "@/lib/payments/fedapay";
import { manualProvider } from "@/lib/payments/manual";
import type { PaymentProvider } from "@/lib/payments/types";

export function getPaymentProvider(): PaymentProvider {
  if (
    env.payment.provider === "moneyfusion" &&
    env.payment.moneyfusion.apiUrl
  ) {
    return moneyfusionProvider;
  }
  if (env.payment.provider === "leekpay" && env.payment.leekpay.secretKey) {
    return leekpayProvider;
  }
  if (env.payment.provider === "fedapay" && env.payment.fedapay.secretKey) {
    return fedapayProvider;
  }
  // En production, on n'autorise JAMAIS le repli silencieux sur le provider
  // « manual » (crédit gratuit) à cause d'une clé manquante -> fail-closed.
  if (process.env.NODE_ENV === "production" && env.payment.provider !== "manual") {
    throw new Error(
      `Prestataire de paiement '${env.payment.provider}' mal configuré (clés manquantes).`,
    );
  }
  return manualProvider;
}

/**
 * Démarre une recharge : crée une transaction locale PENDING puis une charge
 * chez le prestataire. Retourne l'URL de paiement.
 */
export async function startTopup(
  user: { id: string; email: string; name: string | null; balance: number },
  amountXof: number,
  phone?: string,
): Promise<{ paymentUrl: string }> {
  const provider = getPaymentProvider();

  // 1) Transaction locale PENDING (le solde n'est crédité qu'à la confirmation).
  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: "TOPUP",
      amount: amountXof,
      balanceAfter: user.balance, // inchangé tant que non confirmé
      status: "PENDING",
      provider: provider.name.toUpperCase(),
      description: `Recharge de ${amountXof} F CFA`,
    },
  });

  // 2) Charge chez le prestataire.
  const charge = await provider.createCharge({
    amountXof,
    description: `Recharge num express (${amountXof} F CFA)`,
    customer: { email: user.email, name: user.name, phone },
    callbackUrl: `${env.appUrl}/wallet?topup=retour`,
    reference: tx.id,
  });

  await prisma.transaction.update({
    where: { id: tx.id },
    data: { providerRef: charge.providerRef },
  });

  return { paymentUrl: charge.paymentUrl };
}

/**
 * Réconcilie les recharges PENDING d'un utilisateur en interrogeant le
 * prestataire (au retour de la page de paiement). Complète le webhook :
 * fonctionne même quand le webhook ne peut pas joindre l'app (localhost).
 * Retourne le nombre de recharges créditées.
 */
export async function reconcilePendingTopups(userId: string): Promise<number> {
  const provider = getPaymentProvider();
  if (!provider.fetchChargeStatus) return 0;

  const since = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 h
  const pending = await prisma.transaction.findMany({
    where: {
      userId,
      type: "TOPUP",
      status: "PENDING",
      provider: provider.name.toUpperCase(),
      providerRef: { not: null },
      createdAt: { gte: since },
    },
  });

  let credited = 0;
  for (const tx of pending) {
    if (!tx.providerRef) continue;
    try {
      const st = await provider.fetchChargeStatus(tx.providerRef);
      if (st.approved) {
        const r = await confirmTopup(tx.providerRef, true, {
          paidXof: st.amountXof,
          expectedUserId: userId,
        });
        if (r.status === "credited") credited++;
      } else if (st.failed) {
        await confirmTopup(tx.providerRef, false, { expectedUserId: userId });
      }
    } catch {
      /* on réessaiera au prochain retour/refresh */
    }
  }
  return credited;
}

/**
 * Confirme (ou échoue) une recharge de façon idempotente. Crédite le solde si
 * approuvée. Sûr à appeler plusieurs fois (webhook + retry).
 */
export async function confirmTopup(
  providerRef: string,
  approved: boolean,
  opts: { paidXof?: number; expectedUserId?: string } = {},
): Promise<{ status: "credited" | "already" | "failed" | "unknown" }> {
  return prisma.$transaction(async (db) => {
    const tx = await db.transaction.findUnique({ where: { providerRef } });
    if (!tx || tx.type !== "TOPUP") return { status: "unknown" as const };
    // Anti-IDOR : un appel initié par un utilisateur ne confirme que SES recharges.
    if (opts.expectedUserId && tx.userId !== opts.expectedUserId) {
      return { status: "unknown" as const };
    }
    if (tx.status === "COMPLETED") return { status: "already" as const };

    if (!approved) {
      await db.transaction.update({
        where: { id: tx.id },
        data: { status: "FAILED" },
      });
      return { status: "failed" as const };
    }

    // On crédite le montant réellement PAYÉ (source autoritative), jamais plus
    // que le montant demandé. Empêche le crédit gonflé via payload falsifié.
    const creditAmount = Math.min(opts.paidXof ?? tx.amount, tx.amount);
    if (creditAmount <= 0) {
      await db.transaction.update({
        where: { id: tx.id },
        data: { status: "FAILED" },
      });
      return { status: "failed" as const };
    }

    // Crédit ATOMIQUE (increment) -> pas de course/lost-update.
    const updated = await db.user.update({
      where: { id: tx.userId },
      data: { balance: { increment: creditAmount } },
      select: { balance: true },
    });
    await db.transaction.update({
      where: { id: tx.id },
      data: {
        status: "COMPLETED",
        amount: creditAmount,
        balanceAfter: updated.balance,
      },
    });
    return { status: "credited" as const };
  });
}
