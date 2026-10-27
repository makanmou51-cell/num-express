import "server-only";
import { prisma } from "@/lib/db";
import { acckit, AccKitError } from "./client";
import { findCatalogProduct } from "./catalog";
import { applyWalletTx, InsufficientFundsError } from "@/lib/wallet";
import type { AccountOrder } from "@/generated/prisma/client";

export class AccountError extends Error {
  code: "INVALID" | "FUNDS" | "PROVIDER" | "UNAVAILABLE" | "UNCERTAIN";
  constructor(code: AccountError["code"], message: string) {
    super(message);
    this.name = "AccountError";
    this.code = code;
  }
}

/** Messages AccKit (anglais) → français pour le client. */
function mapProviderMsg(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("insufficient balance")) {
    // C'est NOTRE solde AccKit qui est vide — le client n'y peut rien.
    console.error("[acckit] SOLDE FOURNISSEUR ÉPUISÉ — recharger acckit.com !");
    return "Ce produit est momentanément indisponible. Réessaie plus tard.";
  }
  if (m.includes("minimum quantity is")) {
    const n = msg.replace(/\D+/g, " ").trim().split(" ").pop();
    return `Ce produit se vend par ${n} minimum.`;
  }
  if (m.includes("exceeds available stock")) {
    return "Stock insuffisant pour cette quantité.";
  }
  if (m.includes("not for sale") || m.includes("does not exist")) {
    return "Ce produit n'est plus en vente.";
  }
  if (m.includes("temporarily unavailable") || m.includes("system error")) {
    return "Produit temporairement indisponible, réessaie dans quelques minutes.";
  }
  return "Le fournisseur a refusé la commande. Réessaie plus tard.";
}

/**
 * Achète des comptes : vérifie catalogue et solde, appelle AccKit, puis
 * débite et enregistre (atomique) — le même ordre que placeBoostOrder :
 * le fournisseur d'abord, le débit ensuite, pour ne jamais prélever sur
 * un refus du fournisseur.
 */
export async function placeAccountOrder(
  userId: string,
  input: { productId: number; quantity: number },
): Promise<AccountOrder> {
  const productId = Math.floor(Number(input.productId));
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(productId) || productId <= 0 || !Number.isFinite(qty) || qty < 1 || qty > 20) {
    throw new AccountError("INVALID", "Sélection invalide.");
  }

  // Catalogue FRAIS : le prix et le stock affichés peuvent être périmés.
  const found = await findCatalogProduct(productId).catch(() => null);
  if (!found) {
    throw new AccountError("UNAVAILABLE", "Ce produit n'est plus disponible.");
  }
  const { category, product } = found;
  if (product.quantity < qty) {
    throw new AccountError(
      "UNAVAILABLE",
      `Stock insuffisant (reste ${product.quantity}).`,
    );
  }
  const priceXof = product.priceXof * qty;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  if (!user) throw new AccountError("INVALID", "Utilisateur introuvable.");
  if (user.balance < priceXof) {
    throw new AccountError("FUNDS", "Solde insuffisant. Recharge ton compte.");
  }

  // 1) Achat chez AccKit.
  let buy: Awaited<ReturnType<typeof acckit.buy>>;
  try {
    buy = await acckit.buy(productId, qty);
  } catch (e) {
    if (
      e instanceof AccKitError &&
      (e.code === "TIMEOUT" || e.code === "NETWORK" || e.code === "HTTP_5XX")
    ) {
      /* NE JAMAIS renvoyer /buy (doc §7) : la commande a pu être créée chez
         AccKit et payée avec NOTRE solde. On trace une commande CHECK, NON
         débitée, que refreshAccountOrder réconciliera via /orders. */
      await prisma.accountOrder.create({
        data: {
          userId,
          productId,
          productName: product.name,
          categoryName: category,
          quantity: qty,
          priceXof,
          status: "CHECK",
        },
      });
      throw new AccountError(
        "UNCERTAIN",
        "Le fournisseur a mis trop de temps à répondre. Aucun débit pour l'instant : ta commande est en vérification, regarde « Mes commandes de comptes » dans quelques minutes.",
      );
    }
    if (e instanceof AccKitError) {
      throw new AccountError("PROVIDER", mapProviderMsg(e.message));
    }
    throw e;
  }

  // 2) Prix réellement facturé + livraison complète via /order (doc §6.9).
  let info: Awaited<ReturnType<typeof acckit.order>> | null = null;
  try {
    info = await acckit.order(buy.orderId);
  } catch {
    /* illisible maintenant : le refresh à l'ouverture de /comptes reprendra */
  }

  const lines =
    info?.data?.length && info.data.some((l) => l.full_info)
      ? info.data.map((l) => l.full_info)
      : buy.accounts;
  const status = lines.length > 0 ? "DELIVERED" : "PENDING";

  // 3) Débit + création (atomique).
  try {
    return await prisma.$transaction(async (db) => {
      const order = await db.accountOrder.create({
        data: {
          userId,
          productId,
          productName: product.name,
          categoryName: category,
          quantity: qty,
          priceXof,
          costVnd: info?.total_price ?? null,
          providerOrderId: String(buy.orderId),
          status,
          accounts: lines.length > 0 ? lines.join("\n") : null,
        },
      });
      await applyWalletTx({
        userId,
        type: "PURCHASE",
        amount: -priceXof,
        description: `Compte ${product.name} ×${qty}`,
        requireFunds: true,
        client: db,
      });
      return order;
    });
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      throw new AccountError("FUNDS", "Solde insuffisant.");
    }
    throw e;
  }
}

/**
 * Met à jour une commande non livrée :
 *  - PENDING : on relit /order — les comptes sont peut-être arrivés ;
 *  - CHECK   : après 3 min on cherche la commande dans /orders (règle doc §7).
 *    Trouvée = AccKit nous A facturé : on débite alors le client (même si son
 *    solde a baissé entre-temps — on lui doit la livraison) et on livre.
 *    Introuvable après 30 min = jamais créée : FAILED, rien n'a été débité.
 */
export async function refreshAccountOrder(
  userId: string,
  id: string,
): Promise<AccountOrder | null> {
  const o = await prisma.accountOrder.findFirst({ where: { id, userId } });
  if (!o || o.status === "DELIVERED" || o.status === "FAILED") return o;

  if (o.status === "PENDING" && o.providerOrderId) {
    try {
      const info = await acckit.order(Number(o.providerOrderId));
      const lines = (info.data ?? [])
        .map((l) => l.full_info)
        .filter((s) => s && s.length > 0);
      if (lines.length > 0) {
        return await prisma.accountOrder.update({
          where: { id: o.id },
          data: {
            status: "DELIVERED",
            accounts: lines.join("\n"),
            costVnd: info.total_price ?? o.costVnd,
          },
        });
      }
    } catch {
      /* erreur transitoire : on réessaiera à la prochaine visite */
    }
    return o;
  }

  if (o.status === "CHECK") {
    const ageMs = Date.now() - o.createdAt.getTime();
    if (ageMs < 3 * 60_000) return o; // la doc demande d'attendre ~2-3 min
    if (ageMs > 30 * 60_000) {
      return prisma.accountOrder.update({
        where: { id: o.id },
        data: { status: "FAILED" },
      });
    }
    try {
      const found = await acckit.findRecentOrder(o.productId, o.createdAt);
      if (!found) return o;
      const info = await acckit.order(found.id);
      const lines = (info.data ?? [])
        .map((l) => l.full_info)
        .filter((s) => s && s.length > 0);
      return await prisma.$transaction(async (db) => {
        // Revendication atomique : un seul refresh peut débiter.
        const claim = await db.accountOrder.updateMany({
          where: { id: o.id, status: "CHECK" },
          data: {
            status: lines.length > 0 ? "DELIVERED" : "PENDING",
            providerOrderId: String(found.id),
            accounts: lines.length > 0 ? lines.join("\n") : null,
            costVnd: info.total_price ?? null,
          },
        });
        if (claim.count === 0) {
          return db.accountOrder.findUniqueOrThrow({ where: { id: o.id } });
        }
        await applyWalletTx({
          userId: o.userId,
          type: "PURCHASE",
          amount: -o.priceXof,
          description: `Compte ${o.productName} ×${o.quantity} (régularisation)`,
          client: db,
        });
        return db.accountOrder.findUniqueOrThrow({ where: { id: o.id } });
      });
    } catch {
      return o; // AccKit injoignable : on réessaiera plus tard
    }
  }
  return o;
}

/** Rafraîchit les commandes non terminées d'un client (à l'ouverture de /comptes). */
export async function refreshUserAccountOrders(userId: string): Promise<void> {
  const pending = await prisma.accountOrder.findMany({
    where: { userId, status: { in: ["PENDING", "CHECK"] } },
    select: { id: true },
    take: 10,
  });
  for (const p of pending) {
    await refreshAccountOrder(userId, p.id).catch(() => {
      /* une commande en échec ne bloque pas les autres */
    });
  }
}

export function listAccountOrders(userId: string, take = 20) {
  return prisma.accountOrder.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
