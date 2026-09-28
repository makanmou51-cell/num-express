import "server-only";
import { prisma } from "@/lib/db";

/**
 * Entonnoir de conversion, calculé sur NOTRE base — pas sur un outil tiers.
 *
 * Pourquoi pas PostHog ou Google Analytics : ces outils perdent le client qui
 * change de téléphone, vide son navigateur ou refuse les cookies. Ici on
 * compte des comptes réels et des paiements réels. Le chiffre est juste, il
 * ne coûte rien, et aucun code de vérification ne sort du serveur.
 *
 * Toutes les étapes sont comptées sur la MÊME cohorte : les clients inscrits
 * pendant la période. Sans ça, on comparerait les inscrits de janvier aux
 * achats de mars, et le taux n'aurait aucun sens.
 */

export interface FunnelStep {
  label: string;
  /** Ce que l'étape signifie pour le client, en une phrase. */
  hint: string;
  count: number;
  /** % de l'étape précédente — c'est là que se voit la fuite. */
  fromPrev: number;
  /** % des inscrits. */
  fromTop: number;
}

export interface FunnelData {
  days: number | null;
  steps: FunnelStep[];
  /** Encaissé pour de vrai, par les prestataires de paiement (F CFA). */
  encaisse: number;
  /** Crédité à la main par l'admin (cadeaux, dédommagements). */
  credite: number;
  /** Paiements lancés mais jamais aboutis, et le montant en jeu. */
  paiementsEchoues: number;
  paiementsReussis: number;
  montantPerdu: number;
  /** Répartition des activations, pour voir où passent les numéros. */
  activations: { status: string; count: number }[];
}

/** Libellés lisibles pour les statuts d'activation stockés en base. */
const STATUT_FR: Record<string, string> = {
  RECEIVED: "Code reçu",
  COMPLETED: "Terminée",
  WAITING_CODE: "En attente du code",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
  EXPIRED: "Expirée sans code",
};

export function libelleStatut(s: string): string {
  return STATUT_FR[s] ?? s;
}

export async function getFunnel(days: number | null): Promise<FunnelData> {
  // La cohorte : les comptes créés dans la période. `null` = depuis le début.
  const depuis = days ? new Date(Date.now() - days * 86_400_000) : null;
  const cohorte = depuis ? { createdAt: { gte: depuis } } : {};

  // Fenêtre d'argent : on regarde les transactions de la période, pas celles
  // de la cohorte — c'est la trésorerie du mois, pas celle des nouveaux.
  const fenetre = depuis ? { createdAt: { gte: depuis } } : {};

  const [
    inscrits,
    confirmes,
    ontTente,
    ontRecharge,
    ontAchete,
    ontRecuUnCode,
    encaisseAgg,
    crediteAgg,
    echoues,
    reussis,
    perduAgg,
    parStatut,
  ] = await Promise.all([
    prisma.user.count({ where: cohorte }),

    prisma.user.count({
      where: { ...cohorte, emailVerifiedAt: { not: null } },
    }),

    // A ouvert une page de paiement, quelle qu'en soit l'issue.
    prisma.user.count({
      where: { ...cohorte, transactions: { some: { type: "TOPUP" } } },
    }),

    // A de l'argent arrivé sur son compte. Les crédits manuels comptent : le
    // client a bien pu acheter ensuite, l'exclure ferait apparaître plus
    // d'acheteurs que de rechargeurs — un entonnoir à l'envers.
    prisma.user.count({
      where: {
        ...cohorte,
        transactions: { some: { type: "TOPUP", status: "COMPLETED" } },
      },
    }),

    prisma.user.count({ where: { ...cohorte, activations: { some: {} } } }),

    // La seule preuve qu'un client a été servi : un code réellement reçu.
    prisma.user.count({
      where: {
        ...cohorte,
        activations: { some: { smsCode: { not: null } } },
      },
    }),

    prisma.transaction.aggregate({
      where: {
        ...fenetre,
        type: "TOPUP",
        status: "COMPLETED",
        provider: { not: "MANUAL" },
      },
      _sum: { amount: true },
    }),

    prisma.transaction.aggregate({
      where: {
        ...fenetre,
        type: "TOPUP",
        status: "COMPLETED",
        provider: "MANUAL",
      },
      _sum: { amount: true },
    }),

    prisma.transaction.count({
      where: {
        ...fenetre,
        type: "TOPUP",
        status: { in: ["FAILED", "CANCELLED"] },
      },
    }),

    prisma.transaction.count({
      where: { ...fenetre, type: "TOPUP", status: "COMPLETED" },
    }),

    prisma.transaction.aggregate({
      where: {
        ...fenetre,
        type: "TOPUP",
        status: { in: ["FAILED", "CANCELLED"] },
      },
      _sum: { amount: true },
    }),

    prisma.activation.groupBy({
      by: ["status"],
      where: fenetre,
      _count: { _all: true },
    }),
  ]);

  const brut = [
    {
      label: "Inscrits",
      hint: "Ont créé un compte",
      count: inscrits,
    },
    {
      label: "E-mail confirmé",
      hint: "Ont cliqué le lien de confirmation",
      count: confirmes,
    },
    {
      label: "Ont tenté de recharger",
      hint: "Ont ouvert une page de paiement Mobile Money",
      count: ontTente,
    },
    {
      label: "Ont rechargé",
      hint: "L'argent est bien arrivé sur leur compte",
      count: ontRecharge,
    },
    {
      label: "Ont acheté un numéro",
      hint: "Ont lancé au moins une activation",
      count: ontAchete,
    },
    {
      label: "Ont reçu leur code",
      hint: "Le SMS est arrivé — le client est satisfait",
      count: ontRecuUnCode,
    },
  ];

  const top = brut[0].count || 1;
  const steps: FunnelStep[] = brut.map((s, i) => ({
    ...s,
    fromPrev:
      i === 0 ? 100 : Math.round((s.count / (brut[i - 1].count || 1)) * 100),
    fromTop: Math.round((s.count / top) * 100),
  }));

  return {
    days,
    steps,
    encaisse: encaisseAgg._sum.amount ?? 0,
    credite: crediteAgg._sum.amount ?? 0,
    paiementsEchoues: echoues,
    paiementsReussis: reussis,
    montantPerdu: perduAgg._sum.amount ?? 0,
    activations: parStatut
      .map((g) => ({ status: g.status, count: g._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}
