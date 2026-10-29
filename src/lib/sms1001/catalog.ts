import "server-only";
import { unstable_cache } from "next/cache";
import { env } from "@/lib/env";
import { computePublicPriceXof } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import {
  detailPays,
  pays,
  tarifs,
  tauxMesure,
  type Sms1001Operateur,
} from "./client";
// Cycle ESM assumé avec grizzly/catalog (qui nous importe pour ses branches
// fournisseur) : sans danger, serviceLabel n'est appelé qu'à l'exécution.
import type { CatalogOffer } from "@/lib/grizzly/catalog";
import { serviceLabel } from "@/lib/grizzly/catalog";

/** Vrai quand 1001SMS est le fournisseur actif (SMS_PROVIDER=sms1001). */
export const usingSms1001 = env.smsProvider === "sms1001";

/** Codes service maison -> slug 1001SMS. Les 17 existent chez eux (vérifié). */
export const SMS1001_SERVICE_SLUG: Record<string, string> = {
  wa: "whatsapp",
  tg: "telegram",
  go: "google",
  ig: "instagram",
  fb: "facebook",
  lf: "tiktok",
  ds: "discord",
  tw: "twitter",
  vi: "viber",
  mm: "microsoft",
  am: "amazon",
  nf: "netflix",
  ub: "uber",
  ya: "yandex",
  wb: "wechat",
  vk: "vkontakte",
  ot: "other",
};

/** Noms français des pays les plus vendus ; sinon le nom anglais de l'API. */
const NOMS_FR: Record<string, string> = {
  benin: "Bénin",
  togo: "Togo",
  "ivory-coast": "Côte d'Ivoire",
  "cote-divoire": "Côte d'Ivoire",
  senegal: "Sénégal",
  cameroon: "Cameroun",
  ghana: "Ghana",
  nigeria: "Nigéria",
  kenya: "Kenya",
  tanzania: "Tanzanie",
  uganda: "Ouganda",
  "south-africa": "Afrique du Sud",
  morocco: "Maroc",
  algeria: "Algérie",
  tunisia: "Tunisie",
  egypt: "Égypte",
  philippines: "Philippines",
  vietnam: "Viêt Nam",
  indonesia: "Indonésie",
  india: "Inde",
  thailand: "Thaïlande",
  malaysia: "Malaisie",
  bangladesh: "Bangladesh",
  pakistan: "Pakistan",
  turkey: "Turquie",
  brazil: "Brésil",
  mexico: "Mexique",
  colombia: "Colombie",
  argentina: "Argentine",
  peru: "Pérou",
  chile: "Chili",
  portugal: "Portugal",
  spain: "Espagne",
  germany: "Allemagne",
  france: "France",
  greece: "Grèce",
  netherlands: "Pays-Bas",
  "united-kingdom": "Royaume-Uni",
  "united-states": "États-Unis",
  poland: "Pologne",
  austria: "Autriche",
  belgium: "Belgique",
  ireland: "Irlande",
  sweden: "Suède",
  finland: "Finlande",
  denmark: "Danemark",
  croatia: "Croatie",
  italy: "Italie",
  canada: "Canada",
  switzerland: "Suisse",
  norway: "Norvège",
  romania: "Roumanie",
  "czech-republic": "Tchéquie",
  ukraine: "Ukraine",
  russia: "Russie",
};

/* ── Choix de la ligne à acheter ───────────────────────────────────────────

   Un pays expose jusqu'à 21 lignes réparties sur quatre pools de gros :
   NEW, MAIN, EXTRA et EXTRA 2. Leur champ `deliverability` serait le juge
   idéal — sauf qu'il ne mesure presque rien (voir `tauxMesure` : 0 = jamais
   mesuré, 30 = valeur par défaut collée sur MAIN).

   Ce qui reste VRAI est précieux. Lignes mesurées au 29 octobre, WhatsApp :

       Philippines  MAIN/Charlie     0,97 $   58 %   <- la moins chère du pays
       Philippines  EXTRA/virtual58  1,94 $   52 %
       Philippines  EXTRA/virtual34  2,65 $   42 %
       Indonésie    EXTRA/virtual58  1,93 $   17 %
       Indonésie    EXTRA/virtual34  2,01 $    4 %
       Portugal     EXTRA/virtual66  4,75 $   12 %   <- chère ET mauvaise

   L'enseignement principal : une ligne MESURÉE MAUVAISE est pire qu'une
   ligne jamais mesurée. Les quatre lignes mesurées d'Indonésie plafonnent à
   17 % et la seule du Portugal à 12 % — payer 4,75 $ pour un code qui tombe
   une fois sur huit, c'est le scénario HeroSMS (678 ventes à 8 %) en
   connaissance de cause. Elles sont donc écartées, pas classées en dernier.

   D'où la règle :
     1. on écarte les lignes sans stock ;
     2. on écarte les lignes dont le taux MESURÉ est sous le plancher ;
     3. s'il reste des lignes mesurées bonnes, on prend la MOINS CHÈRE ;
     4. sinon on prend la moins chère des non mesurées.

   Ce que la règle accepte sciemment : une ligne mesurée bonne l'emporte même
   si elle coûte plus cher qu'une ligne jamais testée. C'est tenable parce que
   la marge est FIXE (2 500 F par numéro, quel que soit le coût) — un pays
   cher ne rapporte pas moins — et parce que 1001SMS rembourse intégralement
   une commande sans SMS. Vérifié le 29 octobre sur deux achats réels :
   « Full refund - No SMS received », 0,31 $ et 2,11 $ recrédités au centime.
   L'annulation est en revanche REFUSÉE pendant une à deux minutes.

   ATTENTION : le prix annoncé ici n'engage pas 1001SMS. Le contrôle se fait
   après la commande, dans `buyFromSms1001` — voir son commentaire.

   Le pool retenu est enregistré sur chaque vente (colonne `operator`, au
   format « MAIN:Charlie »). C'est ce qui permettra à `operateursEcartes()`
   d'écarter tout seul un pool qui ne délivre pas chez NOS clients — le
   mécanisme qui manquait en septembre et qui a coûté 678 ventes à 8 %. */

const PLANCHER_MESURE = 25;

interface Ligne {
  provider: string;
  operator: string;
  price: number;
  count: number;
  /** Taux RÉELLEMENT mesuré, ou undefined. Jamais le 30 par défaut. */
  taux?: number;
}

export function choisirLigne(ops: Sms1001Operateur[]): Ligne | null {
  const lignes: Ligne[] = ops
    .filter((o) => o.count > 0 && o.price > 0 && o.provider)
    .map((o) => ({
      provider: o.provider,
      operator: o.operator,
      price: o.price,
      count: o.count,
      taux: tauxMesure(o),
    }));
  if (!lignes.length) return null;

  const bonnes = lignes.filter((l) => l.taux !== undefined && l.taux >= PLANCHER_MESURE);
  if (bonnes.length) {
    return bonnes.reduce((a, b) => (b.price < a.price ? b : a));
  }
  /* Aucune mesure exploitable : on écarte quand même ce qui est mesuré
     MAUVAIS, puis on prend la moins chère. */
  const restantes = lignes.filter((l) => l.taux === undefined);
  const pool = restantes.length ? restantes : lignes;
  return pool.reduce((a, b) => (b.price < a.price ? b : a));
}

/** `providerId` encode le pool ET l'opérateur : `/activations/order` exige
 *  les deux. Format « MAIN:Charlie ». */
export function encoderLigne(l: Ligne): string {
  return `${l.provider}:${l.operator}`;
}

export function decoderLigne(id: string): { provider: string; operator?: string } {
  const i = id.indexOf(":");
  if (i < 0) return { provider: id };
  return { provider: id.slice(0, i), operator: id.slice(i + 1) || undefined };
}

/* La liste des pays bouge rarement : une journée de cache. */
const listePays = unstable_cache(pays, ["sms1001:countries"], {
  revalidate: 86_400,
});

function nomPays(slug: string, nomApi?: string): string {
  return NOMS_FR[slug] ?? nomApi ?? slug;
}

function offreDepuisLigne(
  serviceCode: string,
  slug: string,
  nom: string,
  iso: string | null,
  ligne: Ligne,
  reglages: Awaited<ReturnType<typeof getSettings>>,
): CatalogOffer {
  return {
    countryCode: slug,
    countryName: nomPays(slug, nom),
    iso,
    providerId: encoderLigne(ligne),
    serviceCode,
    serviceName: serviceLabel(serviceCode),
    rawCost: ligne.price,
    count: ligne.count,
    /* Jamais le 30 par défaut : seulement un vrai chiffre, ou rien. Sans
       cette discipline le badge « Fiable » s'afficherait sur des pays que
       personne n'a testés. */
    successRate: ligne.taux,
    reliable: (ligne.taux ?? 0) >= 45,
    priceXof: computePublicPriceXof(ligne.price, reglages, `${serviceCode}:${slug}`),
  };
}

/**
 * Catalogue complet d'un service.
 *
 * ── Un seul appel, et pourquoi ce n'est pas un compromis ────────────────
 * `/informative/pricing?service=whatsapp` rend tous les pays desservis en UNE
 * requête. La tentation était de faire plutôt 86 appels — un par pays — parce
 * que la vue détaillée expose davantage de lignes.
 *
 * Mesuré le 29 octobre, ça ne marche pas : leur API accepte TRENTE requêtes
 * puis renvoie 429. Sur 86 appels en lots de 20, 56 échouaient, et le
 * catalogue n'affichait que les pays commençant par A, B ou C — trente pays
 * sur quatre-vingt-six, sans la moindre erreur visible. Exactement le piège
 * AccKit (60 en parallèle rendaient 54 pays sur 184), en pire.
 *
 * Et la comparaison des deux vues au même instant, sur dix pays, montre que
 * la perte est faible :
 *
 *     prix plancher      identique dans 10 pays sur 10
 *     pool EXTRA entier  absent du résumé dans 5 pays sur 10
 *     lignes mesurées    4 pays en gagnent (Indonésie 0 -> 4,
 *                        Philippines 1 -> 3, Colombie 0 -> 2, Portugal 0 -> 1)
 *
 * Le résumé ne ment donc pas sur les PRIX — c'est ce que le catalogue
 * affiche. Il est seulement moins complet sur les lignes, et c'est sans
 * conséquence : `getSms1001Offer` rappelle la vue DÉTAILLÉE du seul pays
 * choisi au moment d'acheter, et l'assistant d'achat recalcule le prix avant
 * d'afficher le bouton. Le client voit donc toujours le vrai prix avant de
 * payer, et on achète toujours sur la liste complète.
 */
async function construireCatalogue(serviceCode: string): Promise<CatalogOffer[]> {
  const slugService = SMS1001_SERVICE_SLUG[serviceCode] ?? serviceCode;
  const [lignesPays, reglages] = await Promise.all([
    tarifs(slugService),
    getSettings(),
  ]);

  const out: CatalogOffer[] = [];
  for (const p of lignesPays) {
    const ligne = choisirLigne(p.operators ?? []);
    if (!ligne) continue;
    out.push(
      offreDepuisLigne(
        serviceCode,
        p.countrySlug,
        p.country,
        p.countryCode || null,
        ligne,
        reglages,
      ),
    );
  }

  out.sort((a, b) => a.priceXof - b.priceXof);
  return out;
}

/* QUINZE MINUTES, contre une heure chez AccKit — et on peut se le permettre
   puisque c'est un seul appel. Leurs prix BOUGENT dans la journée : mesuré le
   29 octobre, Philippines MAIN/Charlie relevé deux fois à quelques minutes
   d'intervalle, 0,97 $ puis 1,75 $, soit +80 %. Un cache long afficherait un
   tarif franchement faux.
   Le client ne paie jamais ce prix périmé : `getSms1001Offer` rappelle l'API
   sans cache au moment de l'achat, et l'assistant d'achat recalcule le prix
   du pays choisi avant d'afficher le bouton. Le cache ne sert qu'au
   classement de la liste. */
const catalogueCache = unstable_cache(construireCatalogue, ["sms1001:catalog"], {
  revalidate: 900,
});

/** Catalogue d'un service, trié par prix croissant (cache 1 h). */
export function getSms1001Catalog(serviceCode: string): Promise<CatalogOffer[]> {
  return catalogueCache(serviceCode);
}

/**
 * Offre exacte au moment de l'achat — appel FRAIS, jamais de cache : c'est
 * elle qui choisit la ligne réellement achetée, et le prix réellement payé.
 */
export async function getSms1001Offer(
  serviceCode: string,
  countrySlug: string,
): Promise<CatalogOffer | null> {
  const slugService = SMS1001_SERVICE_SLUG[serviceCode] ?? serviceCode;
  const [ops, reglages, liste] = await Promise.all([
    detailPays(countrySlug, slugService),
    getSettings(),
    listePays().catch(() => []),
  ]);
  const ligne = choisirLigne(ops);
  if (!ligne) return null;
  const p = liste.find((x) => x.slug === countrySlug);
  return offreDepuisLigne(
    serviceCode,
    countrySlug,
    p?.name ?? countrySlug,
    p?.code ?? null,
    ligne,
    reglages,
  );
}
