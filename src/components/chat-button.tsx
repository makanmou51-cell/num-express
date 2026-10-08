"use client";

import { useCallback, useEffect, useState } from "react";
import { IconChat } from "@/components/icons";

/**
 * Lanceur de chat maison.
 *
 * Pourquoi ne pas garder la bulle de Tidio : elle est ancrée en bas à droite
 * et recouvrait les onglets « Boost » et « Solde » de la barre de navigation.
 * Une règle CSS sur `#tidio-chat-iframe` n'a eu aucun effet — le widget est
 * injecté depuis une iframe dont l'URL est versionnée et hachée, on ne peut
 * pas compter sur son arborescence.
 *
 * On passe donc par l'API publique (vérifiée dans le loader Tidio : `show`,
 * `hide`, `open`, `close`, `on`, préfixe d'événements `tidioChat-`) : on masque
 * leur bulle et on affiche la nôtre, positionnée par rapport à la barre
 * d'onglets réellement présente sur la page.
 *
 * Dégradation volontaire : `hide()` n'est appelé QUE si l'API répond. Si Tidio
 * ne charge pas (réseau coupé, bloqueur), ce composant ne rend rien et la
 * bulle d'origine reste — le chat est alors mal placé, mais joignable. Jamais
 * l'inverse : on ne masque pas leur bulle sans avoir la nôtre.
 */

type TidioApi = {
  show(): void;
  hide(): void;
  open(): void;
  close(): void;
  on(event: string, callback: () => void): void;
};

declare global {
  interface Window {
    tidioChatApi?: TidioApi;
  }
}

/** Marge sous le bouton quand il n'y a pas de barre d'onglets. */
const BASE_GAP = 20;

export function ChatButton() {
  const [api, setApi] = useState<TidioApi | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [bottom, setBottom] = useState(BASE_GAP);

  useEffect(() => {
    let done = false;
    const init = () => {
      const a = window.tidioChatApi;
      if (!a || done) return;
      done = true;
      a.hide();
      setApi(a);
      // Quand le client ferme la conversation, on remasque leur bulle et on
      // réaffiche la nôtre.
      a.on("close", () => {
        a.hide();
        setChatOpen(false);
      });
    };

    init(); // l'API peut déjà être prête quand ce composant monte
    document.addEventListener("tidioChat-ready", init);
    return () => document.removeEventListener("tidioChat-ready", init);
  }, []);

  /* Position calculée sur la barre d'onglets RÉELLE plutôt que sur une
     constante : la barre n'existe que dans l'espace connecté, et sa hauteur
     varie avec la zone sûre de l'iPhone. */
  useEffect(() => {
    const measure = () => {
      const nav = document.querySelector<HTMLElement>(
        'nav[aria-label="Navigation principale"]',
      );
      const visible = nav && nav.offsetParent !== null;
      setBottom(
        visible ? nav.getBoundingClientRect().height + 12 : BASE_GAP,
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const openChat = useCallback(() => {
    if (!api) return;
    api.show();
    api.open();
    setChatOpen(true);
  }, [api]);

  if (!api || chatOpen) return null;

  return (
    <button
      type="button"
      onClick={openChat}
      aria-label="Ouvrir le chat d'assistance"
      style={{ bottom }}
      className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
    >
      <IconChat className="h-6 w-6" />
    </button>
  );
}
