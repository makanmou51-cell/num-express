import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { moneyfusionProvider } from "@/lib/payments/moneyfusion";
import { leekpayProvider } from "@/lib/payments/leekpay";
import { fedapayProvider } from "@/lib/payments/fedapay";
import { bkapayProvider } from "@/lib/payments/bkapay";
import { manualProvider } from "@/lib/payments/manual";
import type { PaymentProvider } from "@/lib/payments/types";

/**
 * Catalogue des prestataires. Le site peut en proposer PLUSIEURS à la fois (le
 * client choisit au moment de recharger) : c'est pour ça que l'aiguillage n'est
 * plus un simple « un seul provider actif ».
 *
 * - `configured` : a-t-on les clés nécessaires pour créer ET vérifier une
 *   charge ? Un prestataire non configuré n'est jamais proposé.
 * - `label`/`hint` : ce qu'on affiche au client quand il y a le choix.
 */
type ProviderEntry = {
  provider: PaymentProvider;
  configured: () => boolean;
  label: string;
  hint: string;
};

const CATALOG: Record<string, ProviderEntry> = {
  bkapay: {
    provider: bkapayProvider,
    configured: () => Boolean(env.payment.bkapay.secretKey),
    label: "MTN Mobile Money",
    hint: "Recommandé",
  },
  leekpay: {
    provider: leekpayProvider,
    configured: () => Boolean(env.payment.leekpay.secretKey),
    label: "Orange Money & autres",
    hint: "",
  },
  fedapay: {
    provider: fedapayProvider,
    configured: () => Boolean(env.payment.fedapay.secretKey),
    label: "FedaPay",
    hint: "MTN, Moov, carte",
  },
  moneyfusion: {
    provider: moneyfusionProvider,
    configured: () => Boolean(env.payment.moneyfusion.apiUrl),
    label: "Mobile Money",
    hint: "Via MoneyFusion",
  },
  manual: {
    provider: manualProvider,
    // Jamais « configuré » en production : interdit le crédit gratuit.
    configured: () => process.env.NODE_ENV !== "production",
    label: "Simulation (dev)",
    hint: "",
  },
};

/**
 * Noms des prestataires proposés au client, dans l'ordre, dédupliqués et
 * filtrés sur ceux RÉELLEMENT configurés. Source : `PAYMENT_PROVIDERS` (liste),
 * sinon `PAYMENT_PROVIDER` seul (rétro-compatible).
 */
function enabledProviderNames(): string[] {
  const names = env.payment.providers.length
    ? env.payment.providers
    : [env.payment.provider];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    const entry = CATALOG[name];
    if (entry && entry.configured()) out.push(name);
  }
  return out;
}

/** Liste pour l'écran de recharge (le client choisit son moyen de paiement). */
export function getCheckoutProviders(): {
  name: string;
  label: string;
  hint: string;
}[] {
  return enabledProviderNames().map((name) => ({
    name,
    label: CATALOG[name].label,
    hint: CATALOG[name].hint,
  }));
}

/** Prestataire par défaut : le premier proposé. Fail-closed en production. */
export function getPaymentProvider(): PaymentProvider {
  const enabled = enabledProviderNames();
  if (enabled.length) return CATALOG[enabled[0]].provider;
  // Aucun prestataire configuré. En production, on n'autorise JAMAIS le repli
  // silencieux sur « manual » (crédit gratuit) -> fail-closed.
  if (
    process.env.NODE_ENV === "production" &&
    env.payment.provider !== "manual"
  ) {
    throw new Error(
      `Prestataire de paiement '${env.payment.provider}' mal configuré (clés manquantes).`,
    );
  }
  return manualProvider;
}

/**
 * Résout le prestataire CHOISI par le client, validé contre la liste des
 * prestataires proposés (un nom non proposé est ignoré -> pas d'injection).
 * Repli sûr sur le prestataire par défaut.
 */
function resolveProvider(name?: string): PaymentProvider {
  const wanted = (name ?? "").toLowerCase();
  if (wanted && enabledProviderNames().includes(wanted)) {
    return CATALOG[wanted].provider;
  }
  return getPaymentProvider();
}

/**
 * Retrouve le prestataire d'une transaction d'après son champ `provider`
 * (ex "BKAPAY"), pour la réconciliation. Null si inconnu ou plus configuré :
 * on ne touche alors pas à la transaction (on ne sait pas la vérifier).
 */
function providerByStoredName(stored: string | null): PaymentProvider | null {
  if (!stored) return null;
  const entry = CATALOG[stored.toLowerCase()];
  if (!entry || !entry.configured()) return null;
  return entry.provider;
}

/**
 * Démarre une recharge : crée une transaction locale PENDING puis une charge
 * chez le prestataire. Retourne l'URL de paiement.
 */
export async function startTopup(
  user: { id: string; email: string; name: string | null; balance: number },
  amountXof: number,
  phone?: string,
  providerName?: string,
): Promise<{ paymentUrl: string }> {
  const provider = resolveProvider(providerName);

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
// Fenêtre de rattrapage. Elle porte sur `createdAt`, c'est-à-dire l'instant du
// CLIC, pas du paiement : en Mobile Money la validation USSD peut arriver bien
// plus tard. Bornée à 2 h, toute recharge payée après devenait invisible À VIE.
const RECONCILE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 h
// Garde-fous : /wallet attend cette boucle AVANT d'afficher le solde, et chaque
// appel réseau peut durer. On plafonne pour ne jamais faire tomber la page.
const RECONCILE_MAX_ITEMS = 8;
const RECONCILE_DEADLINE_MS = 12_000;
// Au-delà, une recharge jamais payée est close : sinon elle reste « En attente »
// à vie dans l'historique du client et le grand-livre ne converge jamais.
const TOPUP_STALE_MS = 24 * 60 * 60 * 1000; // 24 h

type PendingTopup = {
  id: string;
  userId: string;
  providerRef: string | null;
  createdAt: Date;
};

/** Interroge le prestataire pour UNE recharge en attente et applique le verdict. */
async function settlePendingTopup(
  provider: PaymentProvider,
  tx: PendingTopup,
  opts: { expectedUserId?: string } = {},
): Promise<"credited" | "failed" | "pending" | "error"> {
  if (!tx.providerRef || !provider.fetchChargeStatus) return "pending";
  try {
    const st = await provider.fetchChargeStatus(tx.providerRef);
    if (st.approved) {
      const r = await confirmTopup(tx.providerRef, true, {
        paidXof: st.amountXof,
        expectedUserId: opts.expectedUserId,
      });
      return r.status === "credited" ? "credited" : "pending";
    }
    if (st.failed) {
      await confirmTopup(tx.providerRef, false, {
        expectedUserId: opts.expectedUserId,
      });
      return "failed";
    }
    return "pending";
  } catch (e) {
    // Trace explicite : sans elle, une vérification échouée (429/500/timeout)
    // est indiscernable d'un panier abandonné et personne n'est alerté.
    console.error(
      "[topup] vérification échouée",
      tx.id,
      tx.providerRef,
      (e as Error).message,
    );
    return "error";
  }
}

export async function reconcilePendingTopups(userId: string): Promise<number> {
  const since = new Date(Date.now() - RECONCILE_WINDOW_MS);
  // On ne filtre PLUS sur un seul prestataire : avec deux moyens de paiement
  // proposés, une recharge BKApay ET une recharge LeekPay peuvent être en
  // attente en même temps. On réconcilie chacune via SON propre prestataire,
  // lu sur la transaction (champ `provider`).
  const pending = await prisma.transaction.findMany({
    where: {
      userId,
      type: "TOPUP",
      status: "PENDING",
      providerRef: { not: null },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: RECONCILE_MAX_ITEMS,
  });

  const deadline = Date.now() + RECONCILE_DEADLINE_MS;
  let credited = 0;
  for (const tx of pending) {
    // On n'immobilise JAMAIS l'affichage du solde : le cron reprend le reste.
    if (Date.now() > deadline) break;
    const provider = providerByStoredName(tx.provider);
    if (!provider || !provider.fetchChargeStatus) continue;
    if (
      (await settlePendingTopup(provider, tx, { expectedUserId: userId })) ===
      "credited"
    ) {
      credited++;
    }
  }
  return credited;
}

/**
 * (Cron) Balaye les recharges en attente de TOUS les utilisateurs : crédite
 * celles réellement payées, clôt celles jamais payées. C'est le filet de
 * sécurité quand le webhook s'est perdu ET que le client n'est pas revenu —
 * sans lui, une recharge payée reste invisible pour toujours.
 */
export async function sweepPendingTopups(limit = 150): Promise<{
  checked: number;
  credited: number;
  failed: number;
  expired: number;
  errors: number;
}> {
  const out = { checked: 0, credited: 0, failed: 0, expired: 0, errors: 0 };

  const staleBefore = new Date(Date.now() - TOPUP_STALE_MS);

  // Toutes les recharges en attente, TOUS prestataires confondus : chacune est
  // vérifiée via le prestataire inscrit sur la transaction.
  const pending = await prisma.transaction.findMany({
    where: {
      type: "TOPUP",
      status: "PENDING",
      providerRef: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  for (const tx of pending) {
    out.checked++;
    const provider = providerByStoredName(tx.provider);
    if (!provider || !provider.fetchChargeStatus) {
      // Prestataire inconnu / plus configuré : invérifiable. On ne clôt que si
      // la recharge est vieille de +24 h, pour que le grand-livre converge.
      if (tx.createdAt < staleBefore) {
        const claim = await prisma.transaction.updateMany({
          where: { id: tx.id, status: "PENDING" },
          data: { status: "FAILED" },
        });
        if (claim.count > 0) out.expired++;
      }
      continue;
    }
    const r = await settlePendingTopup(provider, tx);
    if (r === "credited") out.credited++;
    else if (r === "failed") out.failed++;
    else if (r === "error") out.errors++;
    else if (tx.createdAt < staleBefore) {
      // Toujours « pending » chez le prestataire et vieille de +24 h : panier
      // abandonné -> on la clôt pour que le grand-livre converge.
      const claim = await prisma.transaction.updateMany({
        where: { id: tx.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      if (claim.count > 0) out.expired++;
    }
  }

  // Lignes orphelines : `createCharge` a échoué, aucun paiement n'a jamais pu
  // exister (providerRef absent) -> invérifiables, on les clôt.
  const orphans = await prisma.transaction.updateMany({
    where: {
      type: "TOPUP",
      status: "PENDING",
      providerRef: null,
      createdAt: { lt: staleBefore },
    },
    data: { status: "FAILED" },
  });
  out.expired += orphans.count;

  return out;
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
      const claim = await db.transaction.updateMany({
        where: { id: tx.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      return {
        status: claim.count > 0 ? ("failed" as const) : ("already" as const),
      };
    }

    // On crédite le montant réellement PAYÉ (source autoritative), jamais plus
    // que le montant demandé. Empêche le crédit gonflé via payload falsifié.
    const creditAmount = Math.min(opts.paidXof ?? tx.amount, tx.amount);
    if (creditAmount <= 0) {
      await db.transaction.updateMany({
        where: { id: tx.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      return { status: "failed" as const };
    }

    // REVENDICATION ATOMIQUE (compare-and-swap) — INDISPENSABLE.
    // `findUnique` + `if (status === COMPLETED)` est un test-puis-agis SANS
    // verrou : sous READ COMMITTED, deux appels concurrents lisent tous deux
    // « PENDING » et créditent CHACUN le solde (double crédit). Or le webhook et
    // le retour du client sur /wallet arrivent SIMULTANÉMENT par conception
    // (même `return_url`), donc le cas est nominal, pas exotique.
    // Ici, seul le PREMIER appelant obtient count === 1 et crédite.
    // On accepte aussi FAILED : une recharge close localement mais réellement
    // payée ensuite doit rester créditable (sinon = argent client perdu).
    const claim = await db.transaction.updateMany({
      where: { id: tx.id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "COMPLETED" },
    });
    if (claim.count === 0) return { status: "already" as const };

    const updated = await db.user.update({
      where: { id: tx.userId },
      data: { balance: { increment: creditAmount } },
      select: { balance: true },
    });
    await db.transaction.update({
      where: { id: tx.id },
      data: { amount: creditAmount, balanceAfter: updated.balance },
    });
    return { status: "credited" as const };
  });
}
