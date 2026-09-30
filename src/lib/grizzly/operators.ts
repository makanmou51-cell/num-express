/**
 * Opérateurs mobiles RÉELS à privilégier à l'achat, par pays.
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────
 * L'achat n'envoyait que `maxPrice`, c'est-à-dire un simple PLAFOND. HeroSMS
 * sert alors le numéro le moins cher du moment : des plages recyclées que
 * WhatsApp refuse en masse. D'où un taux de réussite WhatsApp de 8 % sur
 * 678 ventes réelles.
 *
 * Vérifié en direct sur l'API HeroSMS (4 achats réels, remboursés) : le
 * paramètre `operator` EST honoré, et il change la plage de numéros servie :
 *
 *     operator=three  → 44 7401 833020   (074xx = plage Three)
 *     operator=three  → 44 7454 120634   (074xx)
 *     operator=o2     → 44 7892 921264   (078xx = plage O2)
 *     sans opérateur  → 44 7594 442123   (075xx, au hasard)
 *
 * On impose donc un vrai réseau plutôt que de subir le moins cher.
 *
 * ── Ce qu'on écarte volontairement ──────────────────────────────────────
 * Les listes renvoyées par `getOperators` mélangent de vrais réseaux et des
 * grossistes dont les plages sont justement celles que WhatsApp bloque :
 * `generic_mobile`, `ezmobile`, `talk_telecom`, `teleena`, `plintron`,
 * `tata_communications`, et surtout `textnow` aux USA (du VoIP pur).
 * Aucun d'eux n'apparaît ci-dessous.
 *
 * Ordre = ordre d'essai. Le dernier recours reste TOUJOURS « aucun
 * opérateur » (cf. activations.ts) : un pays sans stock chez l'opérateur
 * demandé ne doit jamais faire échouer une vente.
 */

/** Identifiants pays HeroSMS (protocole sms-activate). */
const PREFERRED: Record<string, readonly string[]> = {
  // Allemagne — les 3 réseaux nationaux.
  "43": ["telekom", "vodafone", "o2"],
  // Royaume-Uni — Three et O2 sont les plages qui passent le mieux.
  "16": ["three", "o2", "ee", "vodafone"],
  // France — les 4 opérateurs de réseau.
  "78": ["orange", "sfr", "bouygues", "free"],
  // Pays-Bas — KPN est l'opérateur historique ; odido = ex T-Mobile NL.
  "48": ["kpn", "odido", "vodafone"],
  // Portugal.
  "117": ["nos", "vodafone"],
  // Grèce.
  "129": ["cosmote", "vodafone", "wind"],
  // Italie.
  "86": ["tim", "vodafone", "iliad", "wind"],
  // Espagne.
  "56": ["movistar", "orange", "vodafone", "yoigo"],
  // Canada.
  "36": ["rogers", "telus", "fido"],
  // USA — surtout PAS textnow (VoIP).
  "187": ["tmobile", "verizon", "at_t"],
};

/**
 * Opérateurs à essayer pour ce pays, du meilleur au moins bon.
 * Renvoie un tableau vide si aucun n'est connu — l'achat se fera alors
 * comme avant, sans contrainte.
 *
 * DÉFAUT CORRIGÉ le 2026-09-30 : un plafond de 2 essais tronquait cette
 * liste, si bien que la moitié était du code mort — o2 en Allemagne, ee et
 * vodafone au Royaume-Uni, bouygues et free en France n'étaient JAMAIS
 * tentés. La liste part maintenant entière ; c'est une limite de TEMPS, côté
 * achat, qui empêche de faire patienter le client (voir `purchaseNumber`).
 */
export function preferredOperators(countryCode: string): readonly string[] {
  return PREFERRED[countryCode] ?? [];
}
