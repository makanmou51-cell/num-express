/**
 * Copie de texte, unique point d'entrée de l'application.
 *
 * `navigator.clipboard.writeText` échoue dans plusieurs cas très courants chez
 * nos clients : navigateur interne de WhatsApp, vieille WebView Android, page
 * servie hors contexte sécurisé. Les appels directs éparpillés dans les écrans
 * soit plantaient (aucun try/catch), soit avalaient l'échec en silence — dans
 * les deux cas le client appuyait sur « Copier » et rien ne se passait, sans
 * la moindre explication.
 *
 * Règle : aucun écran n'appelle `navigator.clipboard` directement ; tout passe
 * par ici, et l'appelant DOIT traiter le retour "selected" (repli) autant que
 * "copied".
 */

export type CopyResult =
  /** Le texte est dans le presse-papiers. */
  | "copied"
  /** Le presse-papiers est refusé : le texte a été sélectionné, l'utilisateur
   *  doit faire un appui long puis « Copier ». */
  | "selected"
  /** Rien n'a fonctionné. */
  | "failed";

export async function copyText(
  value: string,
  node?: HTMLElement | null,
): Promise<CopyResult> {
  // 1. Le chemin normal.
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      // Confirmation tactile : ici on est bien dans un geste utilisateur,
      // donc vibrate() est réellement autorisé (contrairement à un
      // déclenchement automatique en arrière-plan).
      navigator.vibrate?.(30);
      return "copied";
    }
  } catch {
    /* WebView restreinte : on tente le repli ci-dessous. */
  }

  // 2. Repli : sélectionner le texte. Sur les vieilles WebView, execCommand
  //    copie réellement ; sinon la sélection permet l'appui long du système.
  try {
    const sel = window.getSelection();
    if (node && sel) {
      const range = document.createRange();
      range.selectNodeContents(node);
      sel.removeAllRanges();
      sel.addRange(range);
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      if (ok) {
        navigator.vibrate?.(30);
        return "copied";
      }
      return "selected";
    }
  } catch {
    /* dernier recours */
  }

  return "failed";
}
