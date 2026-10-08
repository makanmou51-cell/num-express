"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Le film de marque dans le héros, sans le faire payer aux clients en 3G.
 *
 * ── Le poids, mesuré et non supposé ─────────────────────────────────────
 * La page d'accueil pèse 230 Ko compressés. Le film encodé pour le web en
 * pèse 1,32 Mo (1280 x 720, 243 kb/s) : il est fait d'aplats et de texte,
 * donc il se compresse très bien. C'est six fois la page, pas soixante comme
 * je l'avais d'abord estimé — mais ça reste de loin l'élément le plus lourd,
 * sur une audience béninoise souvent en 3G et un trafic désormais PAYANT.
 * Un visiteur qui attend est un visiteur perdu, et ce clic a été acheté.
 *
 * ── La règle appliquée ──────────────────────────────────────────────────
 * Le film ne se télécharge JAMAIS tout seul sur une connexion lente ou un
 * petit écran. Par défaut, le héros affiche la maquette de téléphone animée
 * en CSS : elle ne coûte pas un octet de réseau et elle raconte déjà la même
 * chose. Le film ne la remplace que si les trois conditions sont réunies :
 *
 *   1. écran large (≥ 1024 px) — en 16:9 dans une colonne étroite le film
 *      devient minuscule, alors que la maquette occupe bien la hauteur ;
 *   2. connexion déclarée rapide, et mode économie de données désactivé ;
 *   3. l'utilisateur ne demande pas moins d'animations.
 *
 * Et dans tous les cas, un bouton « Voir le film » reste disponible : le
 * visiteur qui le VEUT peut le charger, c'est son choix et son forfait.
 * `preload="none"` garantit que rien ne part avant ce clic.
 *
 * Les sous-titres sont fournis (`<track>`) : le film se comprend sans le son,
 * ce qui est le cas le plus fréquent.
 */

const FILM = "/film/num-express.mp4";
const AFFICHE = "/film/affiche.jpg";
const SOUS_TITRES = "/film/num-express.vtt";

type Connexion = { effectiveType?: string; saveData?: boolean };

/** Vrai si on peut charger 1,3 Mo sans punir le visiteur. */
function connexionConfortable(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: Connexion }).connection;
  // Pas d'information : on reste prudent et on ne charge pas tout seul.
  if (!c) return false;
  if (c.saveData) return false;
  return c.effectiveType === "4g";
}

export function HeroVideo({ maquette }: { maquette: React.ReactNode }) {
  const [auto, setAuto] = useState(false);
  const [plein, setPlein] = useState(false);

  useEffect(() => {
    const large = window.matchMedia("(min-width: 1024px)").matches;
    const sobre = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (large && !sobre && connexionConfortable()) setAuto(true);
  }, []);

  return (
    /* Un seul noeud : ce composant est enfant direct d une grille a deux
       colonnes. Un fragment y placerait le bouton dans une cellule a part. */
    <div className="w-full">
      <div className="relative flex w-full justify-center lg:justify-end">
        {auto ? <Lecteur /> : maquette}
      </div>

      {/* Toujours proposé, y compris en 3G : le visiteur décide. */}
      <button
        type="button"
        onClick={() => setPlein(true)}
        className="mx-auto mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 lg:mx-0"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        Voir le film
        <span className="font-normal text-white/60">30 s</span>
      </button>

      {plein && <PleinEcran onFermer={() => setPlein(false)} />}
    </div>
  );
}

/** Le film en boucle muette, dans le cadre du héros. */
function Lecteur() {
  return (
    <div className="relative w-full max-w-[520px]">
      <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-primary/25 blur-2xl" />
      <video
        className="w-full rounded-3xl border border-white/15 shadow-2xl"
        poster={AFFICHE}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        /* 1,32 Mo : l'en-tête du fichier est placé au début (faststart),
           la lecture démarre donc avant la fin du téléchargement. */
        aria-label="Film de présentation de num express"
      >
        <source src={FILM} type="video/mp4" />
      </video>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onFermer}
    >
      <div
        className="w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <video
          className="w-full rounded-2xl shadow-2xl"
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
          className="mx-auto mt-4 block min-h-11 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-gray-900"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
