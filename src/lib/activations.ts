import "server-only";
import { prisma } from "@/lib/db";
import { preferredOperators } from "@/lib/grizzly/operators";
import { grizzly, GrizzlyError, SET_STATUS } from "@/lib/grizzly/client";
import {
  getOffer,
  usingHeroSms,
  usingOnlineSim,
  type CatalogOffer,
} from "@/lib/grizzly/catalog";
import { getSettings } from "@/lib/settings";
import {
  onlinesim,
  OnlineSimError,
  ONLINESIM_SERVICE_SLUG,
} from "@/lib/onlinesim/client";
import { env } from "@/lib/env";
import {
  annuler as sms1001Annuler,
  codeRecu as sms1001CodeRecu,
  commander as sms1001Commander,
  echecTerminal as sms1001EchecTerminal,
  Sms1001Error,
  verifier as sms1001Verifier,
} from "@/lib/sms1001/client";
import {
  decoderLigne,
  SMS1001_SERVICE_SLUG,
  usingSms1001,
} from "@/lib/sms1001/catalog";
import { applyWalletTx, InsufficientFundsError } from "@/lib/wallet";
import { payReferralCommission } from "@/lib/affiliate";
import { pushToUser } from "@/lib/push";
import type { Activation } from "@/generated/prisma/client";

// Doit refléter le délai RÉEL du fournisseur actif : afficher plus long
// ferait patienter le client sur un numéro déjà libéré côté fournisseur.
const ACTIVATION_TTL_MIN =
  env.activationTtlMin > 0
    ? env.activationTtlMin
    : usingOnlineSim || usingSms1001
      ? 15
      : 20;

/** Temps total accordé aux essais par opérateur avant de prendre au hasard. */
const OPERATOR_TRY_BUDGET_MS = 7_000;

export class PurchaseError extends Error {
  code: "UNAVAILABLE" | "PROVIDER" | "FUNDS";
  constructor(code: PurchaseError["code"], message: string) {
    super(message);
    this.name = "PurchaseError";
    this.code = code;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Notification navigateur « ton code est arrivé ».
 *
 * C'est LE moment qui compte : le client a saisi son numéro dans WhatsApp et
 * a quitté le navigateur. Sans cette notification, il doit revenir surveiller
 * la page lui-même.
 *
 * Best-effort et non bloquant : un échec d'envoi ne doit jamais empêcher
 * l'enregistrement du code ni la suite du traitement.
 */
export function notifyCodeReceived(
  userId: string,
  code: string,
  activationId: string,
) {
  pushToUser(userId, {
    title: "Ton code est arrivé",
    body: `Code : ${code}`,
    url: `/numbers/${activationId}`,
    // Un seul avis par activation : un second SMS remplace le premier au lieu
    // d'empiler les lignes dans le volet de notifications.
    tag: `code-${activationId}`,
  }).catch(() => {
    /* le client verra le code en revenant sur la page */
  });
}

/**
 * Achat OnlineSim : getNum ne renvoie qu'un `tzid` ; le numéro lui-même
 * n'apparaît qu'ensuite via getState. On sonde brièvement pour le récupérer.
 */
async function buyFromOnlineSim(
  serviceCode: string,
  countryCode: string,
): Promise<{ activationId: string; phoneNumber: string }> {
  const slug = ONLINESIM_SERVICE_SLUG[serviceCode] ?? serviceCode;
  const { tzid } = await onlinesim.getNum(slug, countryCode);

  for (let i = 0; i < 5; i++) {
    try {
      const st = await onlinesim.getState(tzid);
      if (st.phoneNumber)
        return { activationId: tzid, phoneNumber: st.phoneNumber };
    } catch {
      /* transitoire : on retente */
    }
    await sleep(800);
  }
  // Numéro pas encore visible : on garde l'opération, le polling le remplira.
  return { activationId: tzid, phoneNumber: "" };
}

/**
 * Achat 1001SMS : `/activations/order` exige le POOL (MAIN, NEW, EXTRA…) et
 * accepte un opérateur précis. Les deux sont encodés dans `providerId` au
 * format « MAIN:Charlie » par `getSms1001Offer`, qui a choisi la ligne sur
 * les taux réellement mesurés.
 *
 * ── LE PRIX ANNONCÉ N'ENGAGE PAS 1001SMS ────────────────────────────────
 * Deux achats réels le 29 octobre, même pays, même service, même opérateur
 * imposé (TikTok / Allemagne / MAIN:Charlie), à UNE MINUTE d'intervalle :
 *
 *     12 h 29  facturé 0,31 $   <- le tarif annoncé
 *     12 h 30  facturé 2,11 $   <- sept fois plus
 *
 * Les deux réponses annonçaient pourtant `operatorName: "Charlie"`. Quand le
 * pool demandé se vide, ils servent un pool plus cher sous la même étiquette.
 * Leur `/activations/order` n'accepte AUCUN plafond de prix — contrairement
 * au `maxPrice` de Grizzly.
 *
 * Sans garde-fou, un client paierait 2 750 F pour un numéro qui nous en
 * coûterait 1 308 : la marge tomberait de 2 500 F à 1 442 F sur un pays bon
 * marché, et deviendrait NÉGATIVE sur un pays cher.
 *
 * Le seul contrôle possible est donc a posteriori : la commande dit ce
 * qu'elle a coûté, on compare, et au-delà du dépassement toléré on rend le
 * numéro. L'annulation est souvent refusée pendant une à deux minutes — dans
 * ce cas leur remboursement automatique à l'expiration fait le travail. On
 * perd une vente ; on ne vend jamais à perte.
 */
async function buyFromSms1001(
  serviceCode: string,
  countryCode: string,
  offer: CatalogOffer,
): Promise<{
  activationId: string;
  phoneNumber: string;
  expiresAt?: Date;
  operator: string;
}> {
  if (!offer.providerId) {
    throw new PurchaseError(
      "UNAVAILABLE",
      "Cette offre n'est plus disponible. Réessayez avec un autre pays.",
    );
  }
  const { provider, operator } = decoderLigne(offer.providerId);
  const ordre = await sms1001Commander(
    countryCode,
    SMS1001_SERVICE_SLUG[serviceCode] ?? serviceCode,
    provider,
    operator,
  );

  /** Rend le numéro au fournisseur et fabrique l'erreur à lever. */
  const rendreLeNumero = async (
    journal: string,
    message: string,
  ): Promise<PurchaseError> => {
    console.error(`[1001sms] ${journal}`);
    try {
      await sms1001Annuler(ordre.id);
    } catch {
      /* Refus fréquent dans les deux premières minutes : leur remboursement
         automatique à l'expiration prendra le relais. */
    }
    return new PurchaseError("UNAVAILABLE", message);
  };

  if (!ordre.phone) {
    throw await rendreLeNumero(
      `commande ${ordre.id} sans numéro — annulation`,
      "Le fournisseur n'a pas pu fournir de numéro. Essayez un autre pays.",
    );
  }

  /* Le dépassement de prix, en F CFA : c'est la marge qu'on accepte de
     perdre. Au-delà, on rend le numéro plutôt que de vendre à perte. */
  if (ordre.prixPaye !== undefined && offer.rawCost > 0) {
    const reglages = await getSettings();
    const depassementXof = Math.round(
      (ordre.prixPaye - offer.rawCost) * reglages.fxToXof,
    );
    if (depassementXof > env.sms1001.maxDepassementXof) {
      throw await rendreLeNumero(
        `commande ${ordre.id} facturée ${ordre.prixPaye} $ au lieu de ${offer.rawCost} $ ` +
          `(+${depassementXof} F CFA, plafond ${env.sms1001.maxDepassementXof}) — annulation`,
        "Le prix a changé chez le fournisseur. Réessayez — vous n'avez pas été débité.",
      );
    }
  }

  return {
    activationId: ordre.id,
    phoneNumber: ordre.phone,
    /* Leur expiration fait foi quand ils la donnent ; sinon notre TTL. */
    expiresAt: ordre.expireLe ?? undefined,
    operator: offer.providerId,
  };
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
    Math.round(
      offer.rawCost * (1 + Math.max(0, settings.maxPriceBuffer)) * 100,
    ) / 100;
  let acquired: { activationId: string; phoneNumber: string };
  /** Opérateur réellement imposé (undefined = achat libre). Enregistré sur
   *  l'activation : sans ça, impossible de vérifier si forcer un opérateur
   *  sert à quelque chose — c'est ce qui a manqué en septembre. */
  let operateurObtenu: string | undefined;
  /** Expiration réelle renvoyée par le fournisseur : elle fait foi — notre
   *  TTL calculé n'est qu'un repli. */
  let expiryFromProvider: Date | undefined;
  try {
    if (usingSms1001) {
      const b = await buyFromSms1001(serviceCode, countryCode, offer);
      acquired = { activationId: b.activationId, phoneNumber: b.phoneNumber };
      operateurObtenu = b.operator;
      expiryFromProvider = b.expiresAt;
    } else if (usingOnlineSim) {
      acquired = await buyFromOnlineSim(serviceCode, countryCode);
    } else {
      /* Grizzly : on IMPOSE le fournisseur premium choisi (providerIds) — PAS
         de repli vers un fournisseur bon marché.

         HeroSMS : providerId est null et `maxPrice` n'est qu'un PLAFOND, donc
         l'API servait le numéro le moins cher — des plages recyclées que
         WhatsApp refuse (8 % de réussite mesurés sur 678 ventes). Le palier de
         prix avait été testé sans effet (fixedPrice = maxPrice), mais le
         paramètre `operator`, lui, est bien honoré : vérifié par 4 achats
         réels, `operator=three` rend du 074xx et `operator=o2` du 078xx, là où
         un achat sans contrainte tombait sur du 075xx au hasard.

         On tente donc les vrais réseaux du pays, puis — TOUJOURS — l'achat
         sans contrainte. Un opérateur sans stock ne doit jamais faire échouer
         une vente : le repli final reproduit exactement l'ancien comportement. */
      const attempts: Array<string | undefined> = [
        ...(await preferredOperators(serviceCode, countryCode)),
        undefined,
      ];
      let lastErr: unknown;
      let got: { activationId: string; phoneNumber: string } | null = null;

      /* Limite de TEMPS plutôt que de nombre d'essais. Un pays peut avoir
         quatre réseaux ; les essayer tous à la suite ferait patienter le
         client sur un écran bloqué si aucun n'a de stock. Passé ce délai on
         saute directement au repli « sans opérateur », qui a toujours du
         stock. Le client ne perd donc jamais sa vente NI son temps. */
      const dateLimite = Date.now() + OPERATOR_TRY_BUDGET_MS;
      for (const operator of attempts) {
        if (operator !== undefined && Date.now() > dateLimite) continue;
        try {
          got = await grizzly.getNumber({
            service: serviceCode,
            country: countryCode,
            maxPrice,
            providerIds: offer.providerId ?? undefined,
            operator,
            verification: "sms",
          });
          /* On enregistre l'operateur REELLEMENT retenu. Sans cette ligne,
             `operateurObtenu` restait indefini et la colonne `operator`
             etait nulle sur 100 % des ventes — la selection d'operateurs
             mesures tournait donc en aveugle : aucun moyen de savoir quel
             reseau avait servi, ni lequel marche. « any » distingue le
             repli sans operateur d'une absence d'enregistrement. */
          operateurObtenu = operator ?? "any";
          break;
        } catch (err) {
          lastErr = err;
          // Cet opérateur n'a plus de stock : on passe au suivant. Toute autre
          // erreur (solde, clé, service) est définitive, on la remonte.
          const noStock =
            err instanceof GrizzlyError &&
            (err.code === "NO_NUMBERS" || err.code === "WRONG_MAX_PRICE");
          if (noStock && operator !== undefined) continue;
          throw err;
        }
      }
      if (!got) throw lastErr;
      acquired = got;
    }
  } catch (e) {
    if (e instanceof OnlineSimError) {
      const unavailable = [
        "NO_NUMBER",
        "NO_NUMBERS",
        "NO_COUNTRY",
        "NO_SERVICE",
      ];
      if (unavailable.includes(e.code)) {
        throw new PurchaseError("UNAVAILABLE", e.message);
      }
      // Lenteur/rejet ponctuel du fournisseur : message clair + rassurant
      // (getNum a lieu AVANT le débit -> aucun prélèvement).
      const friendly =
        e.code === "NETWORK" || e.code === "TRY_AGAIN_LATER"
          ? "Le fournisseur est momentanément surchargé. Réessayez dans un instant — vous n'avez pas été débité."
          : e.message;
      throw new PurchaseError("PROVIDER", friendly);
    }
    if (e instanceof Sms1001Error) {
      if (e.code === "NO_STOCK") {
        throw new PurchaseError(
          "UNAVAILABLE",
          "Stock épuisé sur ce pays. Essayez un autre pays.",
        );
      }
      if (e.code === "NO_FUNDS") {
        // C'est NOTRE solde 1001SMS qui est vide — le client n'y peut rien.
        console.error(
          "[1001sms] SOLDE FOURNISSEUR ÉPUISÉ — recharger 1001sms.com !",
        );
        throw new PurchaseError(
          "PROVIDER",
          "Service momentanément indisponible. Réessayez plus tard.",
        );
      }
      if (e.code === "RATE_LIMIT") {
        /* Leur seau de 30 requêtes est vide — souvent parce qu'un catalogue
           se reconstruit au même instant. Rien n'a été acheté ni débité, et
           cinq secondes suffisent à le vider. */
        throw new PurchaseError(
          "PROVIDER",
          "Le fournisseur est momentanément saturé. Réessayez dans quelques secondes — vous n'avez pas été débité.",
        );
      }
      if (e.code === "TIMEOUT" || e.code === "NETWORK") {
        /* État INCONNU côté fournisseur : la commande a pu aboutir. On ne
           rejoue JAMAIS (pas de clé d'idempotence côté 1001SMS). Le client
           n'a pas été débité — le débit n'a lieu qu'après un achat confirmé. */
        throw new PurchaseError(
          "PROVIDER",
          "Le fournisseur a mis trop de temps à répondre. Vous n'avez pas été débité — réessayez dans quelques minutes.",
        );
      }
      throw new PurchaseError("PROVIDER", e.message);
    }
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
  // (1001SMS : pas de statut à signaler — le numéro attend le SMS dès la
  // commande.)
  if (!usingSms1001) {
    try {
      await grizzly.setStatus(acquired.activationId, SET_STATUS.READY);
    } catch (e) {
      console.error("setStatus(READY) échoué:", e);
    }
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
          /* La colonne reste : elle porte l'historique des ventes « Appel »
             de septembre-octobre, que supprimer ferait mentir les
             statistiques passées. Plus aucune vente ne s'y inscrit en CALL —
             le produit n'existe plus chez nos fournisseurs. */
          verifyType: "SMS",
          operator: operateurObtenu ?? null,
          expiresAt:
            expiryFromProvider ??
            new Date(Date.now() + ACTIVATION_TTL_MIN * 60_000),
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
    // Échec du débit (course sur le solde…) : libérer le numéro chez le
    // fournisseur qui l'a vendu (1001SMS rembourse alors immédiatement).
    try {
      if (usingSms1001) {
        await sms1001Annuler(acquired.activationId);
      } else {
        await grizzly.cancel(acquired.activationId);
      }
    } catch {
      /* best effort */
    }
    if (e instanceof InsufficientFundsError) {
      throw new PurchaseError("FUNDS", "Solde insuffisant.");
    }
    throw e;
  }
}

/**
 * Rembourse une activation. UNE SEULE FOIS, quoi qu'il arrive.
 *
 * ── Le bug que ce code corrige (constaté en production le 2026-10-03) ──
 * La version précédente lisait `refunded` puis décidait :
 *
 *     const fresh = await db.activation.findUnique(...)   // lecture
 *     if (fresh.refunded) return;                          // décision
 *     await applyWalletTx(...)                             // crédit
 *
 * C'est un « teste-puis-agis » SANS VERROU. PostgreSQL tourne en READ
 * COMMITTED : deux appels simultanés lisent tous les deux `refunded: false`,
 * et CHACUN crédite le solde. Or ces appels sont simultanés par conception —
 * `refundExpiredForUser` tourne sur /dashboard, sur /numbers, sur la fiche
 * admin, pendant que la page de suivi interroge `refreshActivation` toutes
 * les trois secondes, et que le cron balaye.
 *
 * Résultat réel : une activation remboursée VINGT ET UNE FOIS, 80 achats pour
 * 100 remboursements sur un seul compte, et ~94 000 F CFA créés à partir de
 * rien. Le même piège était déjà documenté et correctement traité dans
 * `confirmTopup` (paiements) — il ne l'était pas ici.
 *
 * La parade : REVENDIQUER avant de créditer. `updateMany` avec
 * `refunded: false` dans le WHERE est un compare-and-swap atomique — la base
 * garantit qu'un seul appel voit `count === 1`. Tous les autres voient 0 et
 * repartent sans rien faire.
 */
async function refundActivation(
  activation: Activation,
  newStatus: "REFUNDED" | "CANCELLED" | "EXPIRED",
): Promise<void> {
  let rembourse = false;
  await prisma.$transaction(async (db) => {
    // Revendication atomique : un seul appel peut passer d'ici.
    const claim = await db.activation.updateMany({
      where: { id: activation.id, refunded: false },
      data: { refunded: true, status: newStatus },
    });
    if (claim.count === 0) return; // déjà remboursée par un appel concurrent

    await applyWalletTx({
      userId: activation.userId,
      type: "REFUND",
      amount: activation.priceXof,
      description: `Remboursement · ${activation.serviceName ?? activation.serviceCode}`,
      activationId: activation.id,
      client: db,
    });
    rembourse = true;
  });

  /* On PRÉVIENT le client. Sans ça, il achète, ne reçoit rien, ferme la page
     — c'est même ce qu'on lui conseille de faire pendant l'attente — et il
     ne sait jamais qu'il a été remboursé. De son point de vue le site a pris
     4 700 F et n'a rien livré. La notification est le seul moyen de le lui
     dire sans qu'il ait à revenir de lui-même.
     Hors transaction et best-effort : un envoi raté ne doit jamais empêcher
     ni annuler le remboursement, qui est déjà en base. */
  if (rembourse) {
    pushToUser(activation.userId, {
      title: "Tu as été remboursé",
      body: `Pas de code reçu pour ${activation.serviceName ?? activation.serviceCode} · ${activation.countryName ?? ""}. Tes ${activation.priceXof.toLocaleString("fr-FR")} F CFA sont de retour sur ton solde.`,
      url: "/numbers",
      tag: `remb-${activation.id}`,
    }).catch(() => {
      /* notification best-effort */
    });
  }
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
  if (
    ["RECEIVED", "COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"].includes(
      activation.status,
    )
  ) {
    return activation;
  }

  // ── OnlineSim : getState porte à la fois le numéro et le code ──
  if (usingOnlineSim) {
    try {
      const st = await onlinesim.getState(activation.providerActivationId);
      // Le numéro peut n'arriver qu'après l'achat : on le complète.
      if (st.phoneNumber && !activation.phoneNumber) {
        await prisma.activation.update({
          where: { id: activation.id },
          data: { phoneNumber: st.phoneNumber },
        });
      }
      if (st.code) {
        const updated = await prisma.activation.update({
          where: { id: activation.id },
          data: { status: "RECEIVED", smsCode: st.code },
        });
        notifyCodeReceived(activation.userId, st.code, activation.id);
        onlinesim.finish(activation.providerActivationId).catch(() => {});
        payReferralCommission(
          activation.userId,
          activation.id,
          activation.priceXof,
        ).catch(() => {});
        return updated;
      }
    } catch {
      /* erreur transitoire : on réessaiera au prochain poll */
    }
    // Expiration sans code : on annule chez OnlineSim et on REMBOURSE, ce qui
    // débloque le solde du client sans qu'il ait à annuler à la main.
    if (activation.expiresAt && activation.expiresAt < new Date()) {
      try {
        await onlinesim.cancel(activation.providerActivationId);
      } catch {
        /* le fournisseur ne facture pas une activation sans SMS reçu */
      }
      await refundActivation(activation, "EXPIRED");
      return prisma.activation.findUnique({ where: { id: activation.id } });
    }
    return prisma.activation.findUnique({ where: { id: activation.id } });
  }

  /* ── 1001SMS ──────────────────────────────────────────────────────────
     Ce sondage n'est PLUS le chemin principal : leur webhook signé pousse le
     code dès qu'il arrive (voir /api/webhooks/1001sms). Il reste le filet —
     webhook mal configuré, désactivé après 20 échecs, ou simplement en retard.
     Les deux chemins se revendiquent l'activation de façon atomique, donc ils
     peuvent arriver en même temps sans se marcher dessus. */
  if (usingSms1001) {
    let ordre;
    try {
      ordre = await sms1001Verifier(activation.providerActivationId);
    } catch (e) {
      /* Commande inconnue ET délai dépassé : terminal, on rembourse. */
      if (
        e instanceof Sms1001Error &&
        e.code === "API" &&
        activation.expiresAt &&
        activation.expiresAt < new Date()
      ) {
        await refundActivation(activation, "EXPIRED");
        return prisma.activation.findUnique({ where: { id: activation.id } });
      }
      return activation; // transitoire : on réessaiera au prochain poll
    }

    // Le numéro peut n'arriver qu'après l'achat : on le complète.
    if (ordre.phone && !activation.phoneNumber) {
      await prisma.activation.update({
        where: { id: activation.id },
        data: { phoneNumber: ordre.phone },
      });
    }

    if (sms1001CodeRecu(ordre) && ordre.code) {
      /* Revendication atomique : le webhook peut livrer le même code à la
         même seconde. Sans la condition dans le WHERE, les deux verseraient
         la commission de parrainage. */
      const claim = await prisma.activation.updateMany({
        where: { id: activation.id, status: "WAITING_CODE" },
        data: { status: "RECEIVED", smsCode: ordre.code, smsText: ordre.texte },
      });
      if (claim.count > 0) {
        notifyCodeReceived(activation.userId, ordre.code, activation.id);
        payReferralCommission(
          activation.userId,
          activation.id,
          activation.priceXof,
        ).catch(() => {});
      }
      return prisma.activation.findUnique({ where: { id: activation.id } });
    }

    if (sms1001EchecTerminal(ordre)) {
      /* Annulée ou expirée sans code : 1001SMS a remboursé de son côté. */
      await refundActivation(activation, "REFUNDED");
      return prisma.activation.findUnique({ where: { id: activation.id } });
    }

    if (activation.expiresAt && activation.expiresAt < new Date()) {
      try {
        await sms1001Annuler(activation.providerActivationId);
      } catch {
        /* Leur remboursement automatique intervient ~10 min après expiration. */
      }
      await refundActivation(activation, "EXPIRED");
      return prisma.activation.findUnique({ where: { id: activation.id } });
    }
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
    notifyCodeReceived(activation.userId, status.code, activation.id);
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

  // (HeroSMS) getStatus ne voit que le SMS. Le code peut aussi arriver par
  // APPEL (WhatsApp « appelez-moi ») : on lit getStatusV2.call. Plus fiable sur
  // les pays où le SMS passe mal (France…).
  if (usingHeroSms) {
    try {
      const v2 = await grizzly.getV2Code(activation.providerActivationId);
      if (v2?.code) {
        const updated = await prisma.activation.update({
          where: { id: activation.id },
          data: { status: "RECEIVED", smsCode: v2.code },
        });
        notifyCodeReceived(activation.userId, v2.code, activation.id);
        grizzly.finish(activation.providerActivationId).catch(() => {});
        payReferralCommission(
          activation.userId,
          activation.id,
          activation.priceXof,
        ).catch(() => {});
        return updated;
      }
    } catch {
      /* transitoire : on réessaiera au prochain poll */
    }
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
    return {
      ok: false,
      message: "Cette activation ne peut plus être annulée.",
    };
  }

  // Annulation possible seulement après 5 minutes : on laisse le temps au code
  // d'arriver, et on évite l'abus achat/annulation immédiat.
  const MIN_CANCEL_MS = 5 * 60_000;
  const ageMs = Date.now() - activation.createdAt.getTime();
  if (ageMs < MIN_CANCEL_MS) {
    const wait = Math.max(1, Math.ceil((MIN_CANCEL_MS - ageMs) / 60_000));
    return {
      ok: false,
      message: `Patientez encore ${wait} min avant d'annuler — le code peut arriver.`,
    };
  }

  if (usingOnlineSim) {
    try {
      await onlinesim.cancel(activation.providerActivationId);
    } catch {
      /* on rembourse quand même : le fournisseur ne facture pas sans SMS */
    }
    await refundActivation(activation, "CANCELLED");
    return { ok: true };
  }

  if (usingSms1001) {
    try {
      await sms1001Annuler(activation.providerActivationId);
    } catch {
      /* Leur documentation prévient que certains pools refusent une
         annulation pendant une à deux minutes. Notre propre délai de 5 min
         est déjà passé ici, et une commande expirée est de toute façon
         remboursée automatiquement chez eux : on rembourse le client. */
    }
    await refundActivation(activation, "CANCELLED");
    return { ok: true };
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
    if (usingSms1001) {
      // 1001SMS n'a pas d'endpoint de renvoi : le client redemande le code
      // depuis le service cible (WhatsApp…), le numéro reste le même.
      return {
        ok: false,
        message:
          "Renvoyez le code depuis le service (ex. WhatsApp) — le numéro reste actif.",
      };
    }
    if (usingOnlineSim) {
      await onlinesim.requestNewCode(activation.providerActivationId);
      return { ok: true };
    }
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

/**
 * Rembourse les activations expirées d'UN utilisateur (code jamais reçu).
 * Appelé au chargement de son espace : libère son solde même s'il a fermé la
 * page de suivi, sans dépendre du cron (limité à 1×/jour sur Vercel Hobby).
 */
export async function refundExpiredForUser(userId: string): Promise<number> {
  const stale = await prisma.activation.findMany({
    where: { userId, status: "WAITING_CODE", expiresAt: { lt: new Date() } },
    select: { id: true },
    take: 20,
  });
  let refunded = 0;
  for (const a of stale) {
    const updated = await refreshActivation(userId, a.id);
    if (
      updated &&
      (updated.status === "EXPIRED" || updated.status === "REFUNDED")
    ) {
      refunded++;
    }
  }
  return refunded;
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
