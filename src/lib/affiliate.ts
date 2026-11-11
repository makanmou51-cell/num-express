import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { applyWalletTx } from "@/lib/wallet";
import { getSettings } from "@/lib/settings";

// Alphabet sans caractères ambigus (I, O, 0, 1).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 8): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return out;
}

/** Génère un code de parrainage unique. */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = randomCode();
    const exists = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  return randomCode(12);
}

/** Retourne l'id du parrain à partir d'un code (ou null). */
export async function resolveReferrerId(
  code?: string | null,
): Promise<string | null> {
  if (!code) return null;
  const user = await prisma.user.findUnique({
    where: { referralCode: code.trim().toUpperCase() },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * Crédite la commission de parrainage au parrain du `buyer`, sur un achat donné.
 * Best-effort : n'interrompt pas l'achat en cas d'échec.
 */
export async function payReferralCommission(
  buyerId: string,
  activationId: string,
  priceXof: number,
): Promise<void> {
  // Idempotence : une seule commission par activation (anti double-versement).
  const already = await prisma.transaction.findFirst({
    where: { activationId, type: "REFERRAL" },
    select: { id: true },
  });
  if (already) return;

  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
    select: { referredById: true },
  });
  if (!buyer?.referredById) return;

  const { commissionRate } = await getSettings();
  const amount = Math.round(priceXof * commissionRate);
  if (amount <= 0) return;

  await applyWalletTx({
    userId: buyer.referredById,
    type: "REFERRAL",
    amount,
    provider: "INTERNAL",
    description: "Commission de parrainage",
    activationId,
  });
}

/**
 * Bonus de bienvenue versé AU FILLEUL (le nouveau), une seule fois, après sa
 * PREMIÈRE recharge réussie. C'est le côté « gagnant-gagnant » du parrainage :
 * sans récompense pour le filleul, le lien n'a aucune raison d'être partagé.
 *
 * Déclenché sur une recharge CRÉDITÉE (argent réellement entré) → un faux
 * compte ne peut pas farmer le bonus sans payer. Idempotent par `providerRef`
 * unique : même deux appels concurrents ne créditent qu'une fois.
 * Best-effort : ne doit jamais interrompre une recharge.
 */
export async function grantReferralWelcomeBonus(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredById: true },
  });
  // Réservé aux filleuls (arrivés par un lien de parrainage).
  if (!user?.referredById) return;

  const { referralBonusXof } = await getSettings();
  if (referralBonusXof <= 0) return;

  // Idempotence (chemin rapide) : un seul bonus par filleul, à vie.
  const already = await prisma.transaction.findFirst({
    where: { userId, type: "REFERRAL_BONUS" },
    select: { id: true },
  });
  if (already) return;

  try {
    await applyWalletTx({
      userId,
      type: "REFERRAL_BONUS",
      amount: referralBonusXof,
      provider: "INTERNAL",
      // Clé unique = garde-fou anti double-versement même en cas de course.
      providerRef: `welcomebonus_${userId}`,
      description: "Bonus de bienvenue (parrainage)",
    });
  } catch (e) {
    // Violation d'unicité = bonus déjà versé par un appel concurrent : OK.
    const msg = (e as Error).message ?? "";
    if (!/unique|P2002/i.test(msg)) throw e;
  }
}

export interface AffiliateStats {
  referralsCount: number;
  totalEarned: number;
  referrals: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  }[];
}

export async function getAffiliateStats(userId: string): Promise<AffiliateStats> {
  const [referralsCount, agg, referrals] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
    prisma.transaction.aggregate({
      where: { userId, type: "REFERRAL" },
      _sum: { amount: true },
    }),
    prisma.user.findMany({
      where: { referredById: userId },
      select: { id: true, email: true, name: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    referralsCount,
    totalEarned: agg._sum.amount ?? 0,
    referrals,
  };
}
