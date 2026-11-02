"use client";

import { useEffect } from "react";

/**
 * Donne un visage aux conversations Tawk.
 *
 * ── Le problème ─────────────────────────────────────────────────────────
 * Quand un client écrit, Tawk n'affiche que « Visitor 48293 ». Impossible de
 * savoir à qui on parle, ni s'il a du solde, ni de retrouver son compte. Le
 * navigateur, lui, SAIT qui est connecté : on le dit à Tawk.
 *
 * ── Comment, et les deux pièges ─────────────────────────────────────────
 * 1. `Tawk_API.visitor` doit être posé AVANT que le widget démarre une
 *    conversation — c'est lui que Tawk lit à l'ouverture du chat. On l'assigne
 *    donc tout de suite, sans attendre le chargement.
 * 2. `setAttributes` n'existe qu'une fois le widget monté, et il ajoute les
 *    champs libres (ici le solde). On le tente dès qu'il répond, sans écraser
 *    le `onLoad` que pose déjà <ChatButton/> : on sonde plutôt que de brancher
 *    un rappel, pour que les deux composants cohabitent.
 *
 * On ne transmet que ce que le client nous a lui-même confié en s'inscrivant,
 * à l'outil de support que le site charge déjà. Les visiteurs non connectés
 * n'ont pas d'e-mail chez nous : ce composant n'est rendu que dans l'espace
 * connecté, il n'invente jamais d'identité.
 */

/* Les champs de l'API Tawk qu'on touche ici. On ne redéclare PAS
   `window.Tawk_API` globalement : <ChatButton/> le fait déjà avec un autre
   jeu de méthodes, et deux déclarations globales du même nom se contredisent.
   On accède donc à l'objet par un cast local. */
type TawkIdentityApi = {
  visitor?: { name?: string; email?: string };
  setAttributes?: (
    attrs: Record<string, string>,
    cb?: (err?: unknown) => void,
  ) => void;
};

function tawk(): TawkIdentityApi {
  const w = window as unknown as { Tawk_API?: TawkIdentityApi };
  w.Tawk_API = w.Tawk_API || {};
  return w.Tawk_API;
}

export function TawkIdentity({
  email,
  name,
  soldeLabel,
}: {
  email: string;
  name?: string | null;
  soldeLabel: string;
}) {
  useEffect(() => {
    const nom = name?.trim() || email.split("@")[0];

    /* Posé tout de suite : c'est ce que Tawk lit quand la conversation
       s'ouvre, même si le widget n'a pas fini de charger. */
    tawk().visitor = { name: nom, email };

    /* Les champs libres (le solde) ne passent que par setAttributes, qui
       n'existe qu'une fois le widget prêt. On sonde une fois par seconde
       pendant vingt secondes, puis on abandonne — pas de minuterie éternelle
       si un bloqueur empêche le chargement. */
    let fait = false;
    const poser = () => {
      const api = tawk();
      if (fait || typeof api.setAttributes !== "function") return;
      fait = true;
      api.setAttributes(
        { name: nom, email, Solde: soldeLabel },
        () => {
          /* Une erreur ici ne doit rien casser : l'identité de base est déjà
             posée via `visitor`. */
        },
      );
    };

    poser();
    const sonde = setInterval(() => {
      if (fait) clearInterval(sonde);
      else poser();
    }, 1000);
    const arret = setTimeout(() => clearInterval(sonde), 20_000);

    return () => {
      clearInterval(sonde);
      clearTimeout(arret);
    };
  }, [email, name, soldeLabel]);

  return null;
}
