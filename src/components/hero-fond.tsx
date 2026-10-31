import Image from "next/image";

/**
 * Plan de fond du héros.
 *
 * ── Pourquoi la vidéo est partie ────────────────────────────────────────
 * Le fond était une boucle vidéo de 58 Ko. Elle marchait, mais elle avait
 * deux défauts qu'aucun réglage ne corrige : sur un téléphone elle démarre
 * en retard et le héros reste figé quelques secondes, et une vidéo décodée
 * en continu derrière du texte consomme de la batterie sans qu'on puisse
 * rien y faire. Michael l'a demandée en photo, et c'est le bon choix : une
 * image fixe est plus nette, plus légère au rendu, et se charge en priorité.
 *
 * ── Ce que ce composant attend ──────────────────────────────────────────
 * Une photo dans `public/fond/hero.jpg` — un téléphone tenu en main, de
 * préférence en lumière naturelle, sujet à DROITE du cadre. Tant qu'elle
 * n'existe pas, le composant rend le fond dessiné ci-dessous : des halos et
 * une grille sur l'aplat de marque. Ce n'est pas un bouche-trou, c'est le
 * fond qui restera visible derrière la photo une fois posée.
 *
 * ── La règle qui ne doit pas bouger ─────────────────────────────────────
 * Le sujet est décalé à DROITE (`objectPosition` à 72 %) : la moitié gauche
 * appartient au titre. Un fond qui empiète sur le texte le rend illisible,
 * et c'est le titre qui vend, pas l'image.
 */

/* Mettre à `true` dès que `public/fond/hero.jpg` existe. Un seul endroit à
   changer, et le fond dessiné reste en dessous comme filet. */
const PHOTO_DISPONIBLE = false;
const PHOTO = "/fond/hero.jpg";

export function HeroFond() {
  return (
    <>
      {/* Fond dessiné : deux halos décentrés sur l'aplat de marque. Du CSS
          pur, donc zéro octet téléchargé et aucun temps de décodage. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 [background:radial-gradient(60%_55%_at_78%_32%,rgba(16,185,129,0.22),transparent_70%),radial-gradient(45%_40%_at_18%_78%,rgba(5,120,87,0.18),transparent_72%)]"
      />
      {PHOTO_DISPONIBLE && (
        <Image
          src={PHOTO}
          alt=""
          fill
          /* `priority` : c'est l'image de la première fenêtre, elle ne doit
             pas attendre le défilement. */
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "72% 50%" }}
        />
      )}
    </>
  );
}
