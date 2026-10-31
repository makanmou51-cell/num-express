"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Le film de marque, qui démarre quand le visiteur arrive dessus.
 *
 * ── Ce qui ne marchait pas ──────────────────────────────────────────────
 * Le film n'était accessible que par un lien « Voir le film » ouvrant une
 * fenêtre. Autrement dit : il fallait une décision. Or personne ne décide de
 * regarder la publicité d'un service qu'il ne connaît pas encore — le film
 * racontait num express à des gens qui ne le verraient jamais.
 *
 * Ici il se lance tout seul dès qu'il entre dans l'écran, et s'arrête dès
 * qu'il en sort. Le visiteur n'a rien à décider : il fait défiler, le film
 * joue.
 *
 * ── Les trois règles qu'on ne peut pas enfreindre ───────────────────────
 * 1. MUET AU DÉPART. Un son qui part tout seul fait fermer l'onglet, et les
 *    navigateurs refusent purement et simplement la lecture automatique avec
 *    du son. Le bouton de son est donc bien visible, et c'est le visiteur qui
 *    l'allume.
 * 2. RIEN N'EST CHARGÉ AVANT. `preload="none"` : les 1,3 Mo du film ne
 *    partent que lorsqu'il approche de l'écran. Sur une audience en 3G et un
 *    trafic acheté en publicité, charger 1,3 Mo pour rien coûte des visiteurs.
 * 3. COMPRÉHENSIBLE SANS LE SON. Les sous-titres français sont activés par
 *    défaut — c'est le cas d'usage le plus fréquent, pas une option.
 *
 * Le respect de « moins de mouvement » n'est pas décoratif ici : si le
 * système du visiteur le demande, le film ne démarre jamais seul et garde
 * ses commandes.
 */

const FILM = "/film/num-express.mp4";
const AFFICHE = "/film/affiche.jpg";
const SOUS_TITRES = "/film/num-express.vtt";

export function FilmAuDefilement() {
  const video = useRef<HTMLVideoElement>(null);
  const [son, setSon] = useState(false);
  const [aDemarre, setADemarre] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;

    /* Le visiteur a demandé moins de mouvement : on ne lance rien. */
    const sobre = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (sobre?.matches) return;

    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          /* La promesse peut être rejetée (onglet en arrière-plan, économie
             de données). Ce n'est pas une erreur : l'affiche reste, et les
             commandes permettent de lancer à la main. */
          v.play().then(
            () => setADemarre(true),
            () => {},
          );
        } else {
          v.pause();
        }
      },
      /* 55 % visible : le film occupe vraiment l'écran avant de démarrer,
         plutôt que de commencer alors qu'on ne voit qu'un liseré. */
      { threshold: 0.55 },
    );
    obs.observe(v);
    return () => obs.disconnect();
  }, []);

  function basculerSon() {
    const v = video.current;
    if (!v) return;
    const nouveau = !son;
    v.muted = !nouveau;
    setSon(nouveau);
    if (nouveau) v.play().catch(() => {});
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
      <video
        ref={video}
        className="block w-full"
        poster={AFFICHE}
        muted
        loop
        playsInline
        preload="none"
        controls={false}
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

      {/* Le bouton de son. Seule commande visible : le film tourne en boucle
          et dure trente secondes, une barre de progression n'apporterait
          rien. 44 px de côté, la cible tactile minimale. */}
      <button
        type="button"
        onClick={basculerSon}
        aria-pressed={son}
        className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <span className="sr-only">
          {son ? "Couper le son" : "Activer le son"}
        </span>
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 fill-current"
          aria-hidden="true"
        >
          <path d="M4 9v6h4l5 4V5L8 9H4z" />
          {son ? (
            <path
              d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M16.5 9.5l5 5m0-5l-5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {/* Tant que la lecture n'a pas démarré, l'affiche pourrait passer pour
          une image figée. Cette pastille dit que c'est un film — et qu'il
          est muet, ce qui évite de chercher le son. */}
      {!aDemarre && (
        <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          Film · 30 s · muet
        </span>
      )}
    </div>
  );
}
