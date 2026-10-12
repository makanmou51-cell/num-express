import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reconcilePendingTopups } from "@/lib/payments";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Vérification d'UNE recharge en attente, pour la page portefeuille.
 *
 * ── Pourquoi un point d'entrée dédié ────────────────────────────────────
 * L'écran d'attente rafraîchissait la page entière (`router.refresh()`) à
 * chaque vérification. Or `/wallet` relance toute la réconciliation à chaque
 * rendu serveur, recharge l'historique et recalcule la page : trop lourd pour
 * être répété pendant plusieurs minutes. Le plafond avait donc été fixé à
 * quatre essais sur vingt secondes.
 *
 * Vingt secondes ne suffisent pas. Un paiement Mobile Money met couramment
 * une à cinq minutes à être confirmé — mesuré en production : un dépôt de
 * 900 F lancé à 10 h 18 n'a été crédité qu'à 11 h 21, parce que le client
 * avait quitté la page et n'est revenu qu'une heure plus tard.
 *
 * Cette route ne fait qu'une chose et renvoie trois nombres. On peut donc
 * l'interroger pendant cinq minutes sans alourdir quoi que ce soit, et ne
 * recharger la page QUE lorsque l'argent est réellement arrivé.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let credite = 0;
  try {
    credite = await reconcilePendingTopups(user.id);
  } catch {
    /* Le prestataire ne répond pas : on ne casse pas l'écran d'attente, le
       client continuera d'être vérifié au prochain passage. */
  }

  const [frais, enAttente] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { balance: true } }),
    prisma.transaction.count({
      where: { userId: user.id, type: "TOPUP", status: "PENDING" },
    }),
  ]);

  return NextResponse.json({
    credite,
    solde: frais?.balance ?? 0,
    enAttente,
  });
}
