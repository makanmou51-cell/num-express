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
