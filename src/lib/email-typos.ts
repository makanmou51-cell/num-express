/**
 * Fautes de frappe dans le domaine d'un e-mail.
 *
 * Pourquoi ce fichier : un client s'est inscrit avec `…@gmil.com`. Le lien de
 * confirmation est parti vers une adresse qui n'existe pas, il n'a jamais rien
 * reçu, et son compte est resté bloqué jusqu'à ce qu'on le confirme à la main.
 * Rien sur le site ne l'avait averti. Sur 532 comptes, 23 attendaient une
 * confirmation qui, pour certains, ne pouvait pas arriver.
 *
 * On ne REFUSE jamais l'inscription : un domaine inconnu de cette liste peut
 * être parfaitement valide, et bloquer quelqu'un sur une adresse correcte
 * coûterait bien plus cher qu'une faute de frappe. On se contente de proposer
 * la correction, le client décide.
 */

/** Domaine mal tapé -> domaine probablement voulu. */
const CORRECTIONS: Record<string, string> = {
  // gmail — de loin le plus fréquent chez nos clients
  "gmil.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmails.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.fr": "gmail.com",
  "gmaul.com": "gmail.com",
  "gmall.com": "gmail.com",
  // yahoo
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  // hotmail / outlook
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  // icloud
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
};

/**
 * Renvoie l'adresse corrigée si le domaine ressemble à une faute connue,
 * sinon `null`. Ne modifie jamais la partie avant le `@`.
 */
export function suggestEmailFix(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domaine = email
    .slice(at + 1)
    .toLowerCase()
    .trim();
  const bon = CORRECTIONS[domaine];
  return bon ? `${local}@${bon}` : null;
}
