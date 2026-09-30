/**
 * Opérateurs mobiles RÉELS à privilégier à l'achat, par pays.
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────
 * L'achat n'envoyait que `maxPrice`, c'est-à-dire un simple PLAFOND. HeroSMS
 * sert alors le numéro le moins cher du moment : des plages recyclées que
 * WhatsApp refuse en masse.
 *
 * Vérifié en direct sur l'API HeroSMS : le paramètre `operator` EST honoré,
 * et il change la plage de numéros servie :
 *
 *     operator=three  → 44 7401 833020   (074xx = plage Three)
 *     operator=o2     → 44 7892 921264   (078xx = plage O2)
 *     sans opérateur  → 44 7594 442123   (075xx, au hasard)
 *
 * ── Ordre des essais ────────────────────────────────────────────────────
 * Vrais réseaux d'abord (ceux qui possèdent les fréquences), puis les
 * opérateurs virtuels qui roulent sur ces mêmes réseaux et reçoivent donc de
 * vraies plages mobiles. L'intérêt de la deuxième partie est le STOCK : quand
 * Telekom n'a plus rien, Fonic — qui est sur le réseau o2 — dépanne.
 *
 * ── Ce qu'on écarte volontairement ──────────────────────────────────────
 * `getOperators` mélange de vrais réseaux et des grossistes dont les plages
 * sont justement celles que WhatsApp bloque. Ne figurent donc PAS ci-dessous :
 *   · agrégateurs / VoIP : `generic_mobile`, `ezmobile`, `talk_telecom`,
 *     `teleena`, `plintron`, `tata_communications`, `textnow` (USA),
 *     `bandwidth` (Belgique — c'est un fournisseur CPaaS, pas un opérateur) ;
 *   · faux positifs de leur catalogue : `ose` (Grèce = les chemins de fer),
 *     `infrabel` (Belgique = l'infrastructure ferroviaire), `netmore`
 *     (Suède = IoT), `pivotel` (Australie = satellite), `travelsim`,
 *     `redteago` (eSIM de voyage) ;
 *   · micro-revendeurs obscurs dont on ne sait pas sur quel réseau ils sont.
 *
 * ── Ce que ce fichier NE règle PAS ──────────────────────────────────────
 * Mesuré sur 206 ventes après la mise en service du paramètre `operator` :
 * la réussite WhatsApp est passée de 8 % à 10 %. Les numéros servis sont bien
 * devenus de vraies plages (Vodafone 0174/0152 en Allemagne, 073x au
 * Royaume-Uni) et WhatsApp les refuse quand même. La cause principale est
 * ailleurs — pays vendu et antifraude WhatsApp sur l'IP du client. Ce fichier
 * améliore la QUALITÉ et la DISPONIBILITÉ du numéro, pas le taux WhatsApp.
 */

/** Identifiants pays HeroSMS (protocole sms-activate). */
const PREFERRED: Record<string, readonly string[]> = {
  // ── Royaume-Uni ──
  "16": [
    "three",
    "o2",
    "ee",
    "vodafone",
    "giffgaff",
    "tesco",
    "lebara",
    "lycamobile",
  ],
  // ── Pologne ──
  "15": [
    "plus",
    "play",
    "orange",
    "tmobile",
    "nju",
    "heyah",
    "plush",
    "virgin",
  ],
  // ── Irlande ──
  "23": ["three", "vodafone", "eir", "48mobile", "tesco"],
  // ── Roumanie ──
  "32": ["orange", "vodafone", "telekom", "digi"],
  // ── Canada ── (at_t/verizon sont américains : écartés)
  "36": ["rogers", "telus", "fido", "chatrmobile"],
  // ── Allemagne ── fonic/ortel/lebara/lyca roulent sur o2
  "43": [
    "telekom",
    "vodafone",
    "o2",
    "fonic",
    "ortel_mobile",
    "lebara",
    "lycamobile",
  ],
  // ── Croatie ──
  "45": ["a1", "tele2", "telemach", "tmobile", "bonbon", "tomato"],
  // ── Suède ──
  "46": ["telia", "tele2", "telenor", "three", "comviq", "lycamobile"],
  // ── Pays-Bas ── odido = ex T-Mobile NL
  "48": [
    "kpn",
    "odido",
    "vodafone",
    "tmobile",
    "lebara",
    "lycamobile",
    "l_mobi",
  ],
  // ── Autriche ──
  "50": [
    "a1",
    "magenta",
    "three",
    "tmobile",
    "telering",
    "yesss",
    "hot_mobile",
    "lidl",
  ],
  // ── Espagne ──
  "56": [
    "movistar",
    "orange",
    "vodafone",
    "yoigo",
    "masmovil",
    "digi",
    "finetwork",
    "euskaltel",
    "lebara",
    "lycamobile",
  ],
  // ── Slovénie ──
  "59": ["telekom", "a1", "telemach", "hot_mobile"],
  // ── France ── lebara/lyca sur Bouygues, syma sur SFR
  "78": [
    "orange",
    "sfr",
    "bouygues",
    "free",
    "lebara",
    "lycamobile",
    "syma_mobile",
  ],
  // ── Belgique ── (bandwidth et infrabel écartés : pas des opérateurs mobiles)
  "82": ["proximus", "orange", "base", "lycamobile", "vectone"],
  // ── Italie ── ho = Vodafone, kena = TIM
  "86": [
    "tim",
    "vodafone",
    "iliad",
    "wind",
    "ho",
    "kena_mobile",
    "digi",
    "lycamobile",
  ],
  // ── Portugal ──
  "117": ["nos", "vodafone", "lebara", "lycamobile"],
  // ── Géorgie ──
  "128": ["magticom", "geocell", "beeline"],
  // ── Grèce ── (ose écarté : chemins de fer grecs)
  "129": ["cosmote", "vodafone", "wind", "q_telecom"],
  // ── Finlande ──
  "163": ["elisa", "telia", "dna"],
  // ── Danemark ──
  "172": ["telenor", "lebara", "lycamobile"],
  // ── Suisse ── aucun réseau national proposé, seulement des virtuels
  "173": ["lycamobile", "lebara", "lidl"],
  // ── Norvège ── my_call roule sur Telia
  "174": ["telia", "my_call", "lycamobile"],
  // ── Australie ──
  "175": ["telstra", "optus", "vodafone", "lebara"],
  // ── USA ── surtout PAS textnow (VoIP pur)
  "187": [
    "tmobile",
    "verizon",
    "at_t",
    "mint_mobile",
    "ultra_mobile",
    "cricket_wireless",
    "boost_mobile",
    "us_mobile",
    "h2o_wireless",
    "lycamobile",
  ],
};

/**
 * Opérateurs à essayer pour ce pays, du meilleur au moins bon.
 * Renvoie un tableau vide si aucun n'est connu — l'achat se fait alors comme
 * avant, sans contrainte.
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
