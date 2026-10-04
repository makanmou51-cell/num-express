import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { grizzly, GrizzlyError } from "@/lib/grizzly/client";
import { getSettings, type AppSettings } from "@/lib/settings";
import { computePublicPriceXof } from "@/lib/pricing";
import { isoFromName } from "@/lib/grizzly/flags";
import { serviceLabel } from "@/lib/grizzly/catalog";
import { applyWalletTx, InsufficientFundsError } from "@/lib/wallet";
import { env } from "@/lib/env";
import type { Rental } from "@/generated/prisma/client";

/** La location n'est proposée que quand HeroSMS est le fournisseur actif. */
export const RENTALS_ENABLED = env.smsProvider === "herosms";

/** Durées de location proposées (heures HeroSMS valides). */
export const RENT_DURATIONS = [
  { hours: 24, label: "1 jour" },
  { hours: 72, label: "3 jours" },
  { hours: 168, label: "7 jours" },
  { hours: 336, label: "14 jours" },
  { hours: 720, label: "30 jours" },
] as const;

export function isValidDuration(h: number): boolean {
  return RENT_DURATIONS.some((d) => d.hours === h);
}

export function durationLabel(h: number): string {
  return (
    RENT_DURATIONS.find((d) => d.hours === h)?.label ??
    `${Math.round(h / 24)} j`
  );
}

/** Services « populaires » mis en tête du sélecteur (dans cet ordre). */
export const RENT_SERVICES = [
  "wa",
  "tg",
  "go",
  "ig",
  "fb",
  "ds",
  "tw",
  "vi",
  "wb",
  "mm",
  "am",
  "nf",
];

export interface RentService {
  code: string;
  name: string;
  featured: boolean;
}

function cleanServiceName(n: string): string {
  const t = (n || "").trim().replace(/\s+/g, " ");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// La liste des services change très rarement : cache long.
// Niveau 1 — mémoire du process : gratuit tant que la lambda reste chaude.
let servicesCache: { at: number; list: RentService[] } | null = null;
const SERVICES_TTL = 6 * 60 * 60_000;

/** Tag de révalidation à la demande (revalidateTag) pour la liste services. */
export const RENT_SERVICES_TAG = "herosms-services";

/**
 * Appel réseau brut : ~1 s pour 800+ services. Lève si HeroSMS ne répond pas
 * ou renvoie une liste vide — `unstable_cache` ne mémorise PAS les rejets,
 * donc un échec est réessayé à la requête suivante au lieu d'être figé 6 h.
 */
async function fetchRentServices(): Promise<RentService[]> {
  const raw = await grizzly.getServicesList();
  const seen = new Set<string>();
  const list: RentService[] = [];
  for (const s of raw) {
    // "full" = louer le numéro pour TOUS les services : hors sélecteur simple.
    if (!s?.code || s.code === "full" || seen.has(s.code)) continue;
    seen.add(s.code);
    list.push({
      code: s.code,
      name: cleanServiceName(s.name) || s.code.toUpperCase(),
      featured: RENT_SERVICES.includes(s.code),
    });
  }
  list.sort((a, b) => {
    const fa = RENT_SERVICES.indexOf(a.code);
    const fb = RENT_SERVICES.indexOf(b.code);
    if (fa !== -1 || fb !== -1)
      return (fa === -1 ? 999 : fa) - (fb === -1 ? 999 : fb);
    return a.name.localeCompare(b.name, "fr");
  });
  if (!list.length) throw new Error("HeroSMS: liste de services vide");
  return list;
}

// Niveau 2 — Data Cache de Next : partagé entre toutes les requêtes ET
// conservé d'un cold start serverless à l'autre, contrairement à une simple
// variable de module (qui meurt avec la lambda et refaisait l'appel d'~1 s
// à presque chaque ouverture de /buy).
const cachedRentServices = unstable_cache(
  fetchRentServices,
  ["herosms:services"],
  { tags: [RENT_SERVICES_TAG], revalidate: 21600 },
);

/** Tous les services HeroSMS (nom lisible), populaires en tête puis alphabétique. */
export async function getRentServiceList(): Promise<RentService[]> {
  if (servicesCache && Date.now() - servicesCache.at < SERVICES_TTL) {
    return servicesCache.list;
  }
  try {
    const list = await cachedRentServices();
    servicesCache = { at: Date.now(), list };
    return list;
  } catch {
    // Repli si l'API ne répond pas : au moins les services populaires.
    return RENT_SERVICES.map((code) => ({
      code,
      name: serviceLabel(code),
      featured: true,
    }));
  }
}

/** Nom lisible d'un service (repli sur le code). */
export async function rentServiceName(code: string): Promise<string> {
  const list = await getRentServiceList();
  return list.find((s) => s.code === code)?.name ?? serviceLabel(code);
}

const FR_NAMES: Record<string, string> = {
  "United Kingdom": "Royaume-Uni",
  USA: "États-Unis",
  "United States": "États-Unis",
  Germany: "Allemagne",
  Netherlands: "Pays-Bas",
  Brazil: "Brésil",
  Thailand: "Thaïlande",
  Greece: "Grèce",
  Colombia: "Colombie",
  Estonia: "Estonie",
  Spain: "Espagne",
  Poland: "Pologne",
  Italy: "Italie",
  Morocco: "Maroc",
  Indonesia: "Indonésie",
  Ukraine: "Ukraine",
  India: "Inde",
  Kazakhstan: "Kazakhstan",
  Mexico: "Mexique",
  Canada: "Canada",
  France: "France",
  Turkey: "Turquie",
  Argentina: "Argentine",
  Vietnam: "Viêt Nam",
  Malaysia: "Malaisie",
  Philippines: "Philippines",
  Nigeria: "Nigéria",
  "South Africa": "Afrique du Sud",
  Egypt: "Égypte",
  Kenya: "Kenya",
  Russia: "Russie",
  Romania: "Roumanie",
  Bulgaria: "Bulgarie",
  Latvia: "Lettonie",
  Lithuania: "Lituanie",
  Sweden: "Suède",
  Finland: "Finlande",
  Ireland: "Irlande",
  Austria: "Autriche",
  Belgium: "Belgique",
  Denmark: "Danemark",
  Norway: "Norvège",
  Croatia: "Croatie",
  Serbia: "Serbie",
  Israel: "Israël",
  Georgia: "Géorgie",
  Moldova: "Moldavie",
  Cambodia: "Cambodge",
  Laos: "Laos",
  HongKong: "Hong Kong",
  China: "Chine",
  Japan: "Japon",
  "South Korea": "Corée du Sud",
  Australia: "Australie",
  "New Zealand": "Nouvelle-Zélande",
  Chile: "Chili",
  Peru: "Pérou",
  Bolivia: "Bolivie",
  Paraguay: "Paraguay",
  Uruguay: "Uruguay",
  Ecuador: "Équateur",
  Uzbekistan: "Ouzbékistan",
  Tajikistan: "Tadjikistan",
  Azerbaijan: "Azerbaïdjan",
  Armenia: "Arménie",
  Belarus: "Biélorussie",
  Pakistan: "Pakistan",
  Bangladesh: "Bangladesh",
  "Sri Lanka": "Sri Lanka",
  Nepal: "Népal",
  Myanmar: "Myanmar",
  Cyprus: "Chypre",
  Portugal: "Portugal",
};

function frName(eng?: string): string {
  if (!eng) return "";
  return FR_NAMES[eng] ?? eng;
}

/** Exécute `fn` sur `items` avec au plus `limit` en parallèle. */
async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (x: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
}

/**
 * IDs des pays réellement LOUABLES pour une durée (champ `countries` de l'API,
 * un seul appel « graine »). HeroSMS ne loue que dans ~35 pays. La liste peut
 * dépendre de la durée (moins de pays sur les longues durées).
 */
async function rentableCountryIds(durationHours: number): Promise<string[]> {
  for (const seed of ["16", "49", "1", "187", "43", "78"]) {
    try {
      const j = await grizzly.getRentPrices({ country: seed, durationHours });
      const c = j.countries;
      if (c && typeof c === "object") {
        const ids = Object.values(c as Record<string, unknown>).map((v) =>
          String(v),
        );
        if (ids.length) return Array.from(new Set(ids));
      }
    } catch {
      /* graine indispo pour cette durée : on essaie la suivante */
    }
  }
  return [];
}

/** Prix public d'une location = coût réel × fx + marge FIXE location (5000). */
function rentPriceXof(cost: number, settings: AppSettings): number {
  const P = env.pricing.heroSmsRentProfitXof;
  // Pas de graine -> pas de micro-variation : prix propre « coût + marge ».
  return computePublicPriceXof(cost, {
    ...settings,
    tier1ProfitXof: P,
    tier2ProfitXof: P,
    tier3ProfitXof: P,
  });
}

export interface RentOffer {
  countryCode: string;
  countryName: string;
  iso: string | null;
  serviceCode: string;
  serviceName: string;
  durationHours: number;
  quantity: number;
  rawCost: number;
  priceXof: number;
}

export class RentalError extends Error {
  code: "UNAVAILABLE" | "PROVIDER" | "FUNDS" | "BAD_INPUT";
  constructor(code: RentalError["code"], message: string) {
    super(message);
    this.name = "RentalError";
    this.code = code;
  }
}

// Cache (service:durée) -> offres. La location bouge peu, TTL généreux.
const catalogCache = new Map<string, { at: number; offers: RentOffer[] }>();
const CACHE_TTL = 20 * 60_000;

/** Catalogue location pour un service + une durée, sur TOUS les pays louables. */
export async function getRentCatalog(
  serviceCode: string,
  durationHours: number,
): Promise<RentOffer[]> {
  const key = `${serviceCode}:${durationHours}`;
  const cached = catalogCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.offers;

  const [ids, countries, settings, services] = await Promise.all([
    rentableCountryIds(durationHours),
    grizzly.getCountries(),
    getSettings(),
    getRentServiceList(),
  ]);
  const svcName =
    services.find((s) => s.code === serviceCode)?.name ??
    serviceLabel(serviceCode);

  const offers: RentOffer[] = [];
  await mapLimit(ids, 12, async (id) => {
    try {
      const prices = await grizzly.getRentPrices({
        country: id,
        durationHours,
      });
      const info = prices.services?.[serviceCode];
      if (!info || !(info.price > 0) || !(info.quantity > 0)) return;
      const eng = countries[id]?.eng;
      offers.push({
        countryCode: id,
        countryName: frName(eng) || `Pays ${id}`,
        iso: isoFromName(eng),
        serviceCode,
        serviceName: svcName,
        durationHours,
        quantity: info.quantity,
        rawCost: info.price,
        priceXof: rentPriceXof(info.price, settings),
      });
    } catch {
      /* pays indispo pour cette durée : on ignore */
    }
  });
  offers.sort((a, b) => a.priceXof - b.priceXof);
  if (offers.length) catalogCache.set(key, { at: Date.now(), offers });
  return offers;
}

/** Loue un numéro dédié. Débit APRÈS obtention du numéro (comme les achats). */
export async function createRental(
  userId: string,
  serviceCode: string,
  countryCode: string,
  durationHours: number,
): Promise<Rental> {
  if (!RENTALS_ENABLED)
    throw new RentalError("BAD_INPUT", "Location indisponible.");
  if (!isValidDuration(durationHours))
    throw new RentalError("BAD_INPUT", "Durée invalide.");

  const settings = await getSettings();

  // 1) Reconfirmer prix + dispo côté fournisseur.
  let price: number;
  let quantity: number;
  try {
    const prices = await grizzly.getRentPrices({
      country: countryCode,
      durationHours,
    });
    const info = prices.services?.[serviceCode];
    if (!info || !(info.price > 0)) {
      throw new RentalError("UNAVAILABLE", "Ce numéro n'est plus disponible.");
    }
    price = info.price;
    quantity = info.quantity;
  } catch (e) {
    if (e instanceof RentalError) throw e;
    throw new RentalError(
      "PROVIDER",
      "Fournisseur momentanément indisponible.",
    );
  }
  if (!(quantity > 0))
    throw new RentalError(
      "UNAVAILABLE",
      "Plus de numéro disponible pour ce pays.",
    );

  const priceXof = rentPriceXof(price, settings);

  // 2) Noms lisibles (affichage).
  const countries = await grizzly.getCountries();
  const countryName = frName(countries[countryCode]?.eng) || countryCode;
  const svcName = await rentServiceName(serviceCode);

  // 3) Pré-vérifier le solde AVANT de louer (évite un numéro orphelin).
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  if (!user || user.balance < priceXof) {
    throw new RentalError("FUNDS", "Solde insuffisant.");
  }

  // 4) Louer (le débit vient après).
  let rented: Awaited<ReturnType<typeof grizzly.rentNumber>>;
  try {
    rented = await grizzly.rentNumber({
      service: serviceCode,
      country: countryCode,
      durationHours,
    });
  } catch (e) {
    if (e instanceof GrizzlyError) {
      if (e.code === "NO_NUMBERS")
        throw new RentalError("UNAVAILABLE", "Plus de numéro disponible.");
      throw new RentalError("PROVIDER", e.message);
    }
    throw e;
  }

  // 5) Débit + création (atomiques).
  try {
    return await prisma.$transaction(async (db) => {
      const created = await db.rental.create({
        data: {
          userId,
          providerRentId: rented.rentId,
          phoneNumber: rented.phoneNumber,
          countryCode,
          countryName,
          serviceCode,
          serviceName: svcName,
          durationHours,
          priceXof,
          costRaw: rented.cost || price,
          status: "ACTIVE",
          endsAt: new Date(Date.now() + durationHours * 3_600_000),
        },
      });
      await applyWalletTx({
        userId,
        type: "PURCHASE",
        amount: -priceXof,
        description: `Location ${svcName} · ${countryName} · ${durationLabel(durationHours)}`,
        requireFunds: true,
        client: db,
      });
      return created;
    });
  } catch (e) {
    if (e instanceof InsufficientFundsError)
      throw new RentalError("FUNDS", "Solde insuffisant.");
    throw e;
  }
}

export interface RentalSms {
  code?: string;
  text?: string;
  date?: string;
  sender?: string;
}

/** Lit les SMS reçus par un numéro loué (getStatusV2). Met à jour lastCode. */
export async function getRentalMessages(rental: Rental): Promise<RentalSms[]> {
  try {
    const v2 = await grizzly.getStatusV2(rental.providerRentId);
    const list = Array.isArray(v2.sms) ? (v2.sms as RentalSms[]) : [];
    const latest = list.length ? list[list.length - 1]?.code : undefined;
    if (latest && latest !== rental.lastCode) {
      await prisma.rental
        .update({ where: { id: rental.id }, data: { lastCode: latest } })
        .catch(() => {});
    }
    return list;
  } catch {
    return [];
  }
}

/** Marque les locations arrivées à échéance, puis renvoie celles de l'user. */
export async function listRentals(userId: string): Promise<Rental[]> {
  await prisma.rental
    .updateMany({
      where: { userId, status: "ACTIVE", endsAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    })
    .catch(() => {});
  return prisma.rental.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** Prix + dispo location pour UN couple (service, pays, durée). null si indispo. */
export async function getRentOfferFor(
  serviceCode: string,
  countryCode: string,
  durationHours: number,
): Promise<{ priceXof: number; quantity: number } | null> {
  if (!RENTALS_ENABLED || !isValidDuration(durationHours)) return null;
  try {
    const [prices, settings] = await Promise.all([
      grizzly.getRentPrices({ country: countryCode, durationHours }),
      getSettings(),
    ]);
    const info = prices.services?.[serviceCode];
    if (!info || !(info.price > 0) || !(info.quantity > 0)) return null;
    return {
      priceXof: rentPriceXof(info.price, settings),
      quantity: info.quantity,
    };
  } catch {
    return null;
  }
}

export async function getRentalForUser(
  userId: string,
  id: string,
): Promise<Rental | null> {
  const r = await prisma.rental.findUnique({ where: { id } });
  return r && r.userId === userId ? r : null;
}

/**
 * Annule la location chez HeroSMS PUIS rembourse le client et la clôt (statut
 * CANCELLED). Idempotent : le statut sert de verrou, on ne rembourse jamais deux
 * fois.
 *
 * Annulation fournisseur : les locations réutilisent les endpoints d'activation,
 * donc `setStatus(status=8)` = ACCESS_CANCEL fonctionne avec le rentId (alors que
 * `setRentStatus`/`getRentList` renvoient BAD_ACTION). HeroSMS n'accepte
 * l'annulation qu'~2 min après l'achat et rembourse le vendeur dans une fenêtre
 * de 20 min ; un refus de sa part (hors fenêtre, déjà terminé…) ne doit pas
 * empêcher le remboursement du client → best-effort.
 */
async function finishRentalRefund(
  rental: Rental,
  label: string,
): Promise<{ ok: boolean; message?: string }> {
  /* On insiste. Un seul essai suffisait à perdre 3 $ : HeroSMS refuse une
     annulation jugée trop précoce, et le refus était avalé en silence. Trois
     tentatives espacées couvrent le cas limite où le client clique à la
     seconde près. Le client est remboursé dans TOUS les cas — on ne lui fait
     pas payer un désaccord entre nous et le fournisseur — mais un échec
     definitif est désormais journalisé, pas ignoré. */
  let annuleChezFournisseur = false;
  for (let essai = 1; essai <= 3; essai++) {
    try {
      await grizzly.cancel(rental.providerRentId);
      annuleChezFournisseur = true;
      break;
    } catch (e) {
      if (essai === 3) {
        console.error(
          "[location] annulation refusée par HeroSMS après 3 essais —",
          "le numéro reste facturé :",
          rental.providerRentId,
          (e as Error).message,
        );
      } else {
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }
  if (annuleChezFournisseur) {
    console.log("[location] annulée chez HeroSMS :", rental.providerRentId);
  }
  await prisma.$transaction(async (db) => {
    /* Revendication atomique : le statut SERT de verrou, mais il faut le
       poser dans le WHERE d'une ecriture, pas le lire puis decider. Deux
       appels simultanes lisaient tous deux « ACTIVE » et remboursaient
       chacun — c'est ainsi qu'une activation a ete remboursee 21 fois. */
    const claim = await db.rental.updateMany({
      where: { id: rental.id, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
    if (claim.count === 0) return; // deja traite : pas de double remboursement
    await applyWalletTx({
      userId: rental.userId,
      type: "REFUND",
      amount: rental.priceXof,
      description: `${label} · ${rental.serviceName ?? rental.serviceCode} · ${rental.countryName ?? rental.countryCode}`,
      client: db,
    });
  });
  return { ok: true };
}

/**
 * Annulation par l'UTILISATEUR : rembourse tant qu'aucun code n'a été reçu.
 * Un code déjà reçu = service rendu -> pas de remboursement (anti-abus).
 */
export async function cancelRental(
  userId: string,
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const rental = await prisma.rental.findUnique({ where: { id } });
  if (!rental || rental.userId !== userId) {
    return { ok: false, message: "Location introuvable." };
  }
  if (rental.status !== "ACTIVE") {
    return { ok: false, message: "Cette location ne peut plus être annulée." };
  }
  /* HeroSMS n'accepte une annulation qu'à partir de ~120 s. Ce seuil était
     réglé à 110 s « pour s'aligner » — soit 10 secondes TROP TÔT. Le client
     annulait, HeroSMS refusait, l'erreur était avalée, le client remboursé…
     et num express continuait de payer un numéro que plus personne n'utilise.
     Constaté le 2026-10-04 : quatre locations allemandes annulées à 2 min
     pile, deux encore « En attente de SMS » chez HeroSMS, 3 $ perdus chacune.
     On passe au-dessus du seuil, avec une marge. */
  const MIN_CANCEL_MS = 125_000;
  /* Borne HAUTE, qui manquait. HeroSMS l'affiche noir sur blanc sur sa propre
     page d'achat : « Vous pouvez annuler la location dans les 20 minutes si le
     code n'est pas reçu. Passé ce délai, aucun remboursement ne sera
     possible. » Sans cette borne, un client annulait à la 24e minute : num
     express le remboursait intégralement pendant que HeroSMS gardait l'argent.
     Chaque annulation tardive coûtait donc le prix entier du numéro.
     Le client n'est pas lésé pour autant : il garde le numéro TOUTE la durée
     achetée et peut continuer à demander son code — ce qui est précisément
     l'intérêt d'une location par rapport à un numéro jetable. */
  const MAX_CANCEL_MS = 20 * 60_000;
  const ageMs = Date.now() - rental.createdAt.getTime();
  if (ageMs < MIN_CANCEL_MS) {
    const wait = Math.max(1, Math.ceil((MIN_CANCEL_MS - ageMs) / 1000));
    return {
      ok: false,
      message: `Patientez encore ${wait} s avant d'annuler (le code peut encore arriver).`,
    };
  }
  if (ageMs > MAX_CANCEL_MS) {
    return {
      ok: false,
      message:
        "Le délai d'annulation de 20 minutes est passé. Ce numéro reste à vous " +
        "pour toute la durée achetée : vous pouvez continuer à demander votre " +
        "code dessus, autant de fois que nécessaire.",
    };
  }
  // On relit en direct : évite qu'un client annule juste après avoir reçu son code.
  const messages = await getRentalMessages(rental);
  if (rental.lastCode || messages.some((m) => m.code)) {
    return {
      ok: false,
      message:
        "Un code a déjà été reçu sur ce numéro — le remboursement n'est pas possible.",
    };
  }
  return finishRentalRefund(rental, "Remboursement location");
}

/** (Admin) Force le remboursement d'une location active, sans condition. */
export async function adminRefundRental(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const rental = await prisma.rental.findUnique({ where: { id } });
  if (!rental) return { ok: false, message: "Location introuvable." };
  if (rental.status !== "ACTIVE") {
    return { ok: false, message: "Location déjà terminée ou remboursée." };
  }

  /* L'admin peut TOUJOURS rembourser — un geste commercial ne se discute pas.
     Mais il doit savoir ce que ça lui coûte : passé 20 minutes, HeroSMS ne
     rend rien, et le remboursement sort entièrement de notre poche. */
  const ageMs = Date.now() - rental.createdAt.getTime();
  const horsFenetre = ageMs > 20 * 60_000;
  const r = await finishRentalRefund(rental, "Remboursement location (admin)");
  if (r.ok && horsFenetre) {
    const minutes = Math.round(ageMs / 60_000);
    return {
      ok: true,
      message:
        `Client remboursé. Attention : la location a ${minutes} min, au-delà de ` +
        `la fenêtre de 20 min de HeroSMS — ce remboursement sort de ta poche, ` +
        `le fournisseur ne rendra rien.`,
    };
  }
  return r;
}
