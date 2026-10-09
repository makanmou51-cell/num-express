"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Le film de marque dans le héros : une affiche fixe, un bouton de lecture.
 *
 * ── Pourquoi pas une lecture automatique ────────────────────────────────
 * La première version lisait le film en boucle, mais seulement sur grand
 * écran et connexion 4G. Trois problèmes constatés :
 *
 *   1. Le film ouvre sur quatre secondes de fond noir. Dans le héros, ça
 *      donnait un grand rectangle noir — la première chose que voyait un
 *      visiteur. Une affiche ne se laisse pas au hasard du montage.
 *   2. Les clients sur téléphone ne voyaient jamais le film. Or ils sont la
 *      majorité, et c'est précisément le trafic qu'on achète en publicité.
 *   3. Deviner la qualité de la connexion pour décider à la place du
 *      visiteur marchait mal et coûtait soixante lignes.
 *
 * Une affiche de 26 Ko s'affiche instantanément, partout, en 3G comme en
 * fibre, sur téléphone comme sur ordinateur. Celui qui veut le film clique :
 * `preload="none"` garantit qu'aucun octet ne part avant ce clic.
 */

const FILM = "/film/num-express.mp4";
const AFFICHE = "/film/affiche.jpg";
const SOUS_TITRES = "/film/num-express.vtt";

export function HeroVideo() {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label="Lire le film de présentation, 30 secondes"
        className="group relative block w-full overflow-hidden border border-white/15 bg-black transition-colors hover:border-white/40"
      >
        {/* L'affiche porte son rapport 16:9 : la place est réservée avant le
            chargement, donc la page ne saute pas sous le doigt du visiteur. */}
        <img
          src={AFFICHE}
          alt="Un téléphone affichant le code de vérification reçu sur num express"
          width={1280}
          height={720}
          className="block aspect-video w-full object-cover"
          loading="eager"
          decoding="async"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/5"
        >
          <span className="flex h-16 w-16 items-center justify-center bg-white transition-transform duration-200 group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-black">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 bg-black px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
        >
          Le film · 30 s
        </span>
      </button>

      {ouvert && <PleinEcran onFermer={() => setOuvert(false)} />}
    </div>
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
