import "server-only";
import { operateursMesures } from "@/lib/grizzly/deliverability";
import { operateursEcartes } from "@/lib/grizzly/mesures-maison";

/**
 * Opérateurs à imposer à l'achat — désormais MESURÉS, non plus devinés.
 *
 * ── Ce que contenait ce fichier avant, et pourquoi ça a échoué ──────────
 * Une carte écrite à la main : « Allemagne → telekom, vodafone, o2 », etc.,
 * déduite du nom des opérateurs en supposant qu'un réseau national valait
 * mieux qu'un opérateur virtuel. Résultat mesuré sur 206 ventes : la
 * réussite WhatsApp est passée de 8 % à 10 %, puis a CHUTÉ quand j'ai
 * élargi la liste à 143 opérateurs — parce que j'y avais ajouté lebara,
 * lycamobile, ortel_mobile, précisément les plages que WhatsApp refuse.
 * Michael a demandé le retour à « au hasard », à juste titre.
 *
 * ── Ce qui change ──────────────────────────────────────────────────────
 * HeroSMS publie `GET /stats/deliverability` avec, par pays, le taux de
 * réussite de CHAQUE opérateur et sa part dans les achats réussis :
 *
 *     Tchéquie   vodafone 40 % (11 % du stock)  ·  tmobile 7 % (22 %)
 *     Croatie    bonbon   20 % (25 %)           ·  telemach 3 % (75 %)
 *
 * Deux faits qui justifient de reprendre ce levier :
 *   · l'écart entre opérateurs d'un même pays va du simple au quintuple ;
 *   · le meilleur ne pèse souvent que 5 à 25 % du stock, donc on ne tombe
 *     jamais dessus sans le demander.
 *
 * Trois garde-fous, pour ne pas refaire la même erreur :
 *   1. aucun opérateur n'est imposé sans mesure — pas de mesure, achat
 *      libre, exactement comme aujourd'hui ;
 *   2. un opérateur qui ne fait pas mieux que la moyenne de son pays est
 *      écarté : l'imposer réduirait le stock sans rien gagner ;
 *   3. l'opérateur réellement servi est enregistré sur l'activation, pour
 *      qu'on puisse VÉRIFIER. C'est ce qui manquait en septembre.
 *
 * L'interrupteur `OPERATOR_SELECTION` reste la commande maîtresse.
 */

/**
 * Désactivé par défaut depuis le 2026-10-03, à la demande de Michael.
 * Poser `OPERATOR_SELECTION=on` dans l'environnement pour réactiver.
 */
const SELECTION_ACTIVE = process.env.OPERATOR_SELECTION?.trim() === "on";

/** Vrai si la sélection par opérateur est armée (affiché dans le diagnostic). */
export const operatorSelectionActive = SELECTION_ACTIVE;

/**
 * Opérateurs à essayer pour ce couple service/pays, du meilleur au moins bon.
 * Tableau vide = achat sans contrainte (comportement par défaut).
 */
export async function preferredOperators(
  serviceCode: string,
  countryCode: string,
): Promise<readonly string[]> {
  if (!SELECTION_ACTIVE) return [];
  try {
    const proposes = await operateursMesures(serviceCode, countryCode);
    if (proposes.length === 0) return [];

    /* Dernier filtre, et il prime sur la recommandation du fournisseur : ses
       taux sont un agregat mondial, les notres viennent de NOS clients. Un
       operateur ecarte n est pas remplace de force — s il ne reste rien, on
       achete librement, ce qui est exactement le comportement par defaut et
       ne fait perdre aucune vente. */
    const ecartes = await operateursEcartes(serviceCode);
    const retenus = proposes.filter(
      (o) => !ecartes.has(`${countryCode}:${o}`),
    );
    if (retenus.length === 0 && proposes.length > 0) {
      console.warn(
        `[operateurs] tous ecartes pour ${serviceCode}/${countryCode} ` +
          `(${proposes.join(", ")}) — achat libre`,
      );
    }
    return retenus;
  } catch {
    // Une statistique indisponible ne doit JAMAIS empêcher une vente.
    return [];
  }
}
