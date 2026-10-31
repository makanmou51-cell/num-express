"use client";

import { useCallback, useEffect, useState } from "react";
import { IconChat } from "@/components/icons";

/**
 * Lanceur de chat maison.
 *
 * ── Pourquoi on ne garde pas la bulle du prestataire ────────────────────
 * Elle est ancrée en bas à droite et recouvre les onglets « Boost » et
 * « Solde » de la barre de navigation. Aucune règle CSS n'en vient à bout :
 * le widget vit dans une iframe dont l'URL est versionnée et hachée, on ne
 * peut pas compter sur son arborescence.
 *
 * On passe donc par leur API publique : on masque leur bulle et on affiche
 * la nôtre, positionnée par rapport à la barre d'onglets réellement
 * présente.
 *
 * ── Tawk.to, et ses deux pièges ─────────────────────────────────────────
 * On est revenu de Tidio à Tawk le 31 octobre (Tidio coupe à 50
 * conversations par mois). Leur API ne se manipule pas de la même façon :
 *
 * 1. `hideWidget()` AVANT le chargement est ignoré en silence. Tawk impose
 *    de passer par `Tawk_API.onLoad`, qu'il appelle lui-même une fois prêt.
 *    On pose donc le rappel, et on gère aussi le cas où le script a fini
 *    avant que ce composant monte.
 * 2. Il n'y a pas d'événement sur `document` comme chez Tidio. Tout passe
 *    par des propriétés qu'on assigne sur l'objet `Tawk_API`.
 *
 * ── Dégradation volontaire ──────────────────────────────────────────────
 * `hideWidget()` n'est appelé QUE si l'API répond. Si Tawk ne charge pas
 * (réseau coupé, bloqueur de publicité), ce composant ne rend rien et la
 * bulle d'origine reste : le chat est alors mal placé, mais joignable.
 * Jamais l'inverse — on ne masque pas leur bulle sans avoir la nôtre.
 */

type TawkApi = {
  showWidget?(): void;
  hideWidget?(): void;
  maximize?(): void;
  minimize?(): void;
  onLoad?: () => void;
  onChatMinimized?: () => void;
  onChatMaximized?: () => void;
};

declare global {
  interface Window {
    Tawk_API?: TawkApi;
  }
}

/** Marge sous le bouton quand il n'y a pas de barre d'onglets. */
const BASE_GAP = 20;

export function ChatButton() {
  const [api, setApi] = useState<TawkApi | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [bottom, setBottom] = useState(BASE_GAP);

  useEffect(() => {
    let fini = false;

    const prendreLaMain = () => {
      const a = window.Tawk_API;
      /* `hideWidget` n'existe qu'une fois le widget réellement monté : sa
         présence est le seul signal fiable que l'API est utilisable. */
      if (!a || typeof a.hideWidget !== "function" || fini) return;
      fini = true;
      a.hideWidget();
      setApi(a);
      /* Quand le client ferme la conversation, on remasque leur bulle et on
         réaffiche la nôtre. */
      a.onChatMinimized = () => {
        a.hideWidget?.();
        setChatOpen(false);
      };
    };

    /* Le script a pu finir avant ce montage : on tente tout de suite. */
    prendreLaMain();

    if (!fini) {
      /* Sinon on se branche sur leur rappel. On préserve celui qui existe
         déjà plutôt que de l'écraser — un autre script pourrait l'utiliser. */
      const existant = window.Tawk_API?.onLoad;
      window.Tawk_API = window.Tawk_API || {};
      window.Tawk_API.onLoad = () => {
        existant?.();
        prendreLaMain();
      };
    }

    /* Filet : `onLoad` peut ne jamais être appelé si le script est bloqué.
       On sonde brièvement, puis on abandonne — pas de minuterie éternelle. */
    const sonde = setInterval(() => {
      if (fini) clearInterval(sonde);
      else prendreLaMain();
    }, 1000);
    const arret = setTimeout(() => clearInterval(sonde), 20_000);

    return () => {
      clearInterval(sonde);
      clearTimeout(arret);
    };
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
      setBottom(visible ? nav.getBoundingClientRect().height + 12 : BASE_GAP);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const openChat = useCallback(() => {
    if (!api) return;
    api.showWidget?.();
    api.maximize?.();
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
