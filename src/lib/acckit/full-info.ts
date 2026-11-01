/**
 * Lecture d'une ligne « full_info » livrée par AccKit.
 *
 * AccKit rend chaque compte sur UNE ligne, champs séparés par « | », et un
 * éventuel bloc de cookies séparé par « ; ». L'API ne documente NULLE PART
 * l'ordre ni le nom des champs — vérifié le 1er novembre, la description
 * produit est vide. On ne peut donc pas s'y fier : on étiquette ce qu'on
 * reconnaît avec CERTITUDE (adresses e-mail, secret 2FA, cookies, identifiant
 * numérique), et le reste reste visible, numéroté, jamais perdu.
 *
 * Pourquoi ne pas deviner les étiquettes manquantes : un champ mal nommé
 * (« mot de passe » affiché sur un jeton) ferait échouer la connexion du
 * client et nous vaudrait une réclamation. Mieux vaut « Donnée 2 » honnête
 * qu'une étiquette fausse.
 *
 * Fonction PURE, sans accès réseau ni secret : elle tourne aussi bien au rendu
 * serveur que dans un composant client.
 */

export interface AccountField {
  label: string;
  value: string;
  /** Mot de passe, 2FA, cookie, jeton : masqué par défaut à l'écran. */
  secret: boolean;
}

export interface ParsedAccount {
  fields: AccountField[];
  /** La ligne d'origine, pour un « tout copier » sans rien perdre. */
  raw: string;
}

const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const RE_UID = /^\d{8,}$/;
const RE_2FA = /^[A-Z2-7]{16,32}$/;
const RE_TOKEN = /^(EAA[A-Za-z0-9]+|[0-9a-f]{30,})$/i;
const RE_COOKIE = /c_user=|xs=|datr=|sb=/;

function classer(valeur: string, rangEmail: { n: number }): AccountField {
  const v = valeur.trim();

  if (RE_EMAIL.test(v)) {
    rangEmail.n += 1;
    return {
      label: rangEmail.n === 1 ? "E-mail du compte" : "E-mail de secours",
      value: v,
      secret: false,
    };
  }
  if (RE_COOKIE.test(v) || (v.includes(";") && v.length > 60)) {
    return { label: "Cookies de session", value: v, secret: true };
  }
  if (RE_UID.test(v)) {
    return { label: "Identifiant (UID)", value: v, secret: false };
  }
  if (RE_2FA.test(v)) {
    return { label: "Clé 2FA (code à deux facteurs)", value: v, secret: true };
  }
  if (RE_TOKEN.test(v)) {
    return { label: "Jeton d'accès", value: v, secret: true };
  }
  /* Reconnu par rien : on le garde tel quel, étiqueté plus bas par position. */
  return { label: "", value: v, secret: false };
}

/**
 * Découpe une ligne de compte en champs étiquetés.
 *
 * Les champs sans étiquette sûre (souvent un mot de passe de compte puis un
 * mot de passe d'e-mail, dans cet ordre chez AccKit) sont nommés « Donnée N »
 * pour ne rien affirmer de faux. Le premier champ court non reconnu qui suit
 * l'UID est le plus souvent le mot de passe : on le signale comme tel, mais
 * avec un point d'interrogation, pour aider sans tromper.
 */
export function parseAccountLine(line: string): ParsedAccount {
  const brut = line.trim();
  const rangEmail = { n: 0 };
  const champs = brut.split("|").map((c) => classer(c, rangEmail));

  let premierCourtApresUid = -1;
  for (let i = 0; i < champs.length; i++) {
    if (champs[i].label) continue;
    const suitUid = i > 0 && champs[i - 1].label === "Identifiant (UID)";
    if (suitUid && premierCourtApresUid === -1 && champs[i].value.length <= 24) {
      premierCourtApresUid = i;
    }
  }

  let n = 0;
  for (let i = 0; i < champs.length; i++) {
    if (champs[i].label) continue;
    n += 1;
    if (i === premierCourtApresUid) {
      champs[i] = { ...champs[i], label: "Mot de passe (à vérifier)", secret: true };
    } else {
      champs[i] = { ...champs[i], label: `Donnée ${n}` };
    }
  }

  return { fields: champs.filter((f) => f.value !== ""), raw: brut };
}

/** Une commande peut livrer plusieurs comptes : une ligne chacun. */
export function parseAccounts(accounts: string): ParsedAccount[] {
  return accounts
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseAccountLine);
}
