import "server-only";
import { prisma } from "@/lib/db";
import { grizzly, GrizzlyError, SET_STATUS } from "@/lib/grizzly/client";
import { getOffer } from "@/lib/grizzly/catalog";
import { getSettings } from "@/lib/settings";
import { applyWalletTx, InsufficientFundsError } from "@/lib/wallet";
import { payReferralCommission } from "@/lib/affiliate";
import type { Activation } from "@/generated/prisma/client";

const ACTIVATION_TTL_MIN = 20;

export class PurchaseError extends Error {
  code: "UNAVAILABLE" | "PROVIDER" | "FUNDS";
  constructor(code: PurchaseError["code"], message: string) {
    super(message);
    this.name = "PurchaseError";
    this.code = code;
  }
}

/** Achète un numéro et débite l'utilisateur (atomique). */
export async function purchaseNumber(
  userId: string,
  serviceCode: string,
  countryCode: string,
): Promise<Activation> {
  // 1) Revalider l'offre et le prix côté serveur.
  const offer = await getOffer(serviceCode, countryCode);
  if (!offer) {
    throw new PurchaseError(
      "UNAVAILABLE",
      "Cette offre n'est plus disponible. Réessayez avec un autre pays.",
    );
  }

  // 2) Vérifier le solde avant d'acheter chez le fournisseur.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  if (!user) throw new Error("Utilisateur introuvable");
  if (user.balance < offer.priceXof) {
    throw new PurchaseError(
      "FUNDS",
      "Solde insuffisant. Rechargez votre compte.",
    );
  }

  // 3) Acheter le numéro chez Grizzly.
  // getPrices renvoie le palier LE MOINS CHER (« from »). S'y limiter strictement
  // force les numéros les moins fiables (stock résiduel, codes qui n'arrivent
  // jamais) et fait échouer l'achat dès que ce palier est épuisé. On autorise
  // donc une marge au-dessus : le surcoût éventuel est absorbé par notre marge,
  // le client paie bien le prix affiché.
  const settings = await getSettings();
  const maxPrice =
    Math.round(offer.rawCost * (1 + Math.max(0, settings.maxPriceBuffer)) * 100) /
    100;
  let acquired: { activationId: string; phoneNumber: string };
  try {
    try {
      acquired = await grizzly.getNumber({
        service: serviceCode,
        country: countryCode,
        maxPrice,
        // Fournisseur imposé : sans lui, maxPrice n'est qu'un plafond et
        // Grizzly sert le fournisseur de son choix.
        providerIds: offer.providerId ?? undefined,
      });
    } catch (e) {
      // Le lot du fournisseur visé vient d'être épuisé : on retente sans
      // l'imposer plutôt que de faire échouer la vente.
      if (
        offer.providerId &&
        e instanceof GrizzlyError &&
        (e.code === "NO_NUMBERS" || e.code === "WRONG_MAX_PRICE")
      ) {
        console.warn(
          `Fournisseur ${offer.providerId} indisponible (${serviceCode}/${countryCode}), repli sans ciblage.`,
        );
        acquired = await grizzly.getNumber({
          service: serviceCode,
          country: countryCode,
          maxPrice,
        });
      } else {
        throw e;
      }
    }
  } catch (e) {
    if (e instanceof GrizzlyError) {
      // Prix changé ou stock épuisé entre la consultation et l'achat :
      // c'est une « offre indisponible », pas une panne fournisseur.
      if (e.code === "WRONG_MAX_PRICE" || e.code === "NO_NUMBERS") {
        throw new PurchaseError("UNAVAILABLE", e.message);
      }
      throw new PurchaseError("PROVIDER", e.message);
    }
    throw e;
  }

  // 3 bis) Signaler au fournisseur que le numéro est prêt à recevoir le SMS
  // (statut 1). Sans cet appel l'activation reste en attente côté fournisseur
  // et le code peut tarder à être acheminé. Best-effort : un échec ici ne doit
  // pas faire perdre le numéro déjà acheté.
  try {
    await grizzly.setStatus(acquired.activationId, SET_STATUS.READY);
  } catch (e) {
    console.error("setStatus(READY) échoué:", e);
  }

  // 4) Débit + création de l'activation, atomiques.
  try {
    const activation = await prisma.$transaction(async (db) => {
      const created = await db.activation.create({
        data: {
          userId,
          providerActivationId: acquired.activationId,
          phoneNumber: acquired.phoneNumber,
          countryCode,
          serviceCode,
          serviceName: offer.serviceName,
          countryName: offer.countryName,
          priceXof: offer.priceXof,
          costRaw: offer.rawCost,
          status: "WAITING_CODE",
          expiresAt: new Date(Date.now() + ACTIVATION_TTL_MIN * 60_000),
        },
      });
      await applyWalletTx({
        userId,
        type: "PURCHASE",
        amount: -offer.priceXof,
        description: `Numéro ${offer.serviceName} · ${offer.countryName}`,
        activationId: created.id,
        requireFunds: true,
        client: db,
      });
      return created;
    });

    // NB : la commission de parrainage n'est PAS versée ici (WAITING_CODE est
    // remboursable). Elle l'est à la réception du code (RECEIVED), voir
    // refreshActivation — pour éviter le farming achat/annulation.
    return activation;
  } catch (e) {
    // Échec du débit (course sur le solde…) : libérer le numéro chez Grizzly.
    try {
      await grizzly.cancel(acquired.activationId);
    } catch {
      /* best effort */
    }
    if (e instanceof InsufficientFundsError) {
      throw new PurchaseError("FUNDS", "Solde insuffisant.");
    }
    throw e;
  }
}

/** Rembourse une activation (idempotent : ne rembourse qu'une fois). */
async function refundActivation(
  activation: Activation,
  newStatus: "REFUNDED" | "CANCELLED" | "EXPIRED",
): Promise<void> {
  await prisma.$transaction(async (db) => {
    const fresh = await db.activation.findUnique({
      where: { id: activation.id },
      select: { refunded: true },
    });
    if (!fresh || fresh.refunded) return;

    await applyWalletTx({
      userId: activation.userId,
      type: "REFUND",
      amount: activation.priceXof,
      description: `Remboursement · ${activation.serviceName ?? activation.serviceCode}`,
      activationId: activation.id,
      client: db,
    });
    await db.activation.update({
      where: { id: activation.id },
      data: { refunded: true, status: newStatus },
    });
  });
}

/**
 * Interroge Grizzly pour mettre à jour une activation : récupère le code,
 * gère l'annulation/expiration et déclenche le remboursement le cas échéant.
 */
export async function refreshActivation(
  userId: string,
  activationId: string,
): Promise<Activation | null> {
  const activation = await prisma.activation.findFirst({
    where: { id: activationId, userId },
  });
  if (!activation) return null;

  // États terminaux : rien à faire.
  if (["RECEIVED", "COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"].includes(
    activation.status,
  )) {
    return activation;
  }

  let status;
  try {
    status = await grizzly.getStatus(activation.providerActivationId);
  } catch (e) {
    // Activation inexistante/expirée côté fournisseur (NO_ACTIVATION) : signal
    // terminal -> on rembourse tout de suite au lieu d'attendre l'expiration locale.
    if (e instanceof GrizzlyError && e.code === "WRONG_ACTIVATION_ID") {
      await refundActivation(activation, "EXPIRED");
      return prisma.activation.findUnique({ where: { id: activation.id } });
    }
    return activation; // erreur transitoire : on réessaiera au prochain poll
  }

  if (status.kind === "OK") {
    const updated = await prisma.activation.update({
      where: { id: activation.id },
      data: { status: "RECEIVED", smsCode: status.code },
    });
    // Clore l'activation côté fournisseur (best effort).
    grizzly.finish(activation.providerActivationId).catch(() => {});
    // Commission de parrainage : versée seulement maintenant (code reçu = état
    // non remboursable), idempotente. Best-effort.
    payReferralCommission(
      activation.userId,
      activation.id,
      activation.priceXof,
    ).catch(() => {});
    return updated;
  }

  if (status.kind === "CANCELLED") {
    await refundActivation(activation, "REFUNDED");
    return prisma.activation.findUnique({ where: { id: activation.id } });
  }

  // Expiration sans code : annuler chez le fournisseur + rembourser.
  if (activation.expiresAt && activation.expiresAt < new Date()) {
    try {
      await grizzly.cancel(activation.providerActivationId);
    } catch {
      /* peut être refusé si trop tôt */
    }
    await refundActivation(activation, "EXPIRED");
    return prisma.activation.findUnique({ where: { id: activation.id } });
  }

  return activation;
}

/** Annulation par l'utilisateur (remboursement si Grizzly accepte). */
export async function cancelActivation(
  userId: string,
  activationId: string,
): Promise<{ ok: boolean; message?: string }> {
  const activation = await prisma.activation.findFirst({
    where: { id: activationId, userId },
  });
  if (!activation) return { ok: false, message: "Activation introuvable." };
  if (activation.status !== "WAITING_CODE") {
    return { ok: false, message: "Cette activation ne peut plus être annulée." };
  }

  try {
    await grizzly.cancel(activation.providerActivationId);
  } catch (e) {
    if (e instanceof GrizzlyError && e.code === "EARLY_CANCEL_DENIED") {
      return {
        ok: false,
        message: "Annulation possible seulement après 2 minutes d'attente.",
      };
    }
    return { ok: false, message: "Annulation refusée par le fournisseur." };
  }

  await refundActivation(activation, "CANCELLED");
  return { ok: true };
}

/**
 * Redemande un SMS au fournisseur (statut 3) sans racheter de numéro : utile
 * quand le client attend et que le code tarde. Ne modifie ni le solde ni le
 * statut local — l'activation reste en attente et le sondage continue.
 */
export async function requestNewCode(
  userId: string,
  activationId: string,
): Promise<{ ok: boolean; message?: string }> {
  const activation = await prisma.activation.findFirst({
    where: { id: activationId, userId },
  });
  if (!activation) return { ok: false, message: "Activation introuvable." };
  if (activation.status !== "WAITING_CODE") {
    return {
      ok: false,
      message: "Disponible uniquement tant que le code est attendu.",
    };
  }

  try {
    await grizzly.setStatus(activation.providerActivationId, SET_STATUS.RETRY);
  } catch (e) {
    // Le fournisseur refuse souvent tant que le numéro n'a pas encore servi.
    const msg =
      e instanceof GrizzlyError
        ? e.message
        : "Le fournisseur a refusé la demande.";
    return {
      ok: false,
      message: `${msg} Patientez encore un peu, ou annulez pour être remboursé.`,
    };
  }
  return { ok: true };
}

/**
 * Balaye les activations en attente dont le délai est dépassé : annule chez
 * Grizzly et rembourse. Destiné à être appelé par un cron.
 */
export async function expireStaleActivations(
  limit = 100,
): Promise<{ processed: number; refunded: number }> {
  const stale = await prisma.activation.findMany({
    where: { status: "WAITING_CODE", expiresAt: { lt: new Date() } },
    select: { id: true, userId: true },
    take: limit,
  });

  let refunded = 0;
  for (const a of stale) {
    const updated = await refreshActivation(a.userId, a.id);
    if (
      updated &&
      (updated.status === "EXPIRED" || updated.status === "REFUNDED")
    ) {
      refunded++;
    }
  }
  return { processed: stale.length, refunded };
}

export function listActivations(userId: string, take = 50) {
  return prisma.activation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function getActivation(userId: string, id: string) {
  return prisma.activation.findFirst({ where: { id, userId } });
}
