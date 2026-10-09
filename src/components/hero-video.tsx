"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Le film de marque complet, ouvert a la demande.
 *
 * Il ne joue PAS dans le heros : le plan de fond s en charge (hero-fond.tsx).
 * Ici on ne charge rien tant que le visiteur n a pas clique — `preload="none"`
 * sur une balise montee seulement a l ouverture. Les 1,32 Mo du film ne
 * partent donc jamais tout seuls, ce qui compte sur une audience en 3G et un
 * trafic achete en publicite.
 *
 * La fenetre fournit le son, les commandes et les sous-titres francais : le
 * film reste comprehensible sans le son, ce qui est le cas le plus frequent.
 */

const FILM = "/film/num-express.mp4";
const AFFICHE = "/film/affiche.jpg";
const SOUS_TITRES = "/film/num-express.vtt";

/** Lien discret qui ouvre le film complet, avec le son et les sous-titres. */
export function LienFilm() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="group inline-flex min-h-11 items-center gap-3 text-[15px] font-semibold text-white/70 transition-colors duration-200 hover:text-white"
      >
        <span className="flex h-9 w-9 items-center justify-center border border-white/30 transition-colors duration-200 group-hover:border-white group-hover:bg-white">
          <svg
            viewBox="0 0 24 24"
            className="ml-0.5 h-3.5 w-3.5 fill-current transition-colors group-hover:fill-[#06241A]"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        Voir le film
        <span className="font-normal text-white/40">30 s</span>
      </button>
      {ouvert && <PleinEcran onFermer={() => setOuvert(false)} />}
    </>
  );
}

/** Lecture plein écran, avec le son et les sous-titres. */
function PleinEcran({ onFermer }: { onFermer: () => void }) {
  const fermeture = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fermeture.current?.focus();
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", touche);
    /* On bloque le défilement de la page derrière la fenêtre. */
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", touche);
      document.body.style.overflow = avant;
    };
  }, [onFermer]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Film de présentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
      onClick={onFermer}
    >
      <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <video
          className="w-full"
          poster={AFFICHE}
          controls
          autoPlay
          playsInline
          preload="none"
        >
          <source src={FILM} type="video/mp4" />
          <track
            src={SOUS_TITRES}
            kind="subtitles"
            srcLang="fr"
            label="Français"
            default
          />
          Votre navigateur ne sait pas lire cette vidéo.
        </video>
        <button
          ref={fermeture}
          type="button"
          onClick={onFermer}
          className="mx-auto mt-5 block min-h-11 bg-white px-7 py-2.5 text-sm font-semibold uppercase tracking-wider text-black"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
