/**
 * Plan de fond animé du héros.
 *
 * COMPOSANT SERVEUR, volontairement. Il n'a aucune interactivité : c'est une
 * balise `<video>` et rien d'autre. En composant client, il n'aurait été
 * monté qu'après l'hydratation — donc un héros figé pendant les premières
 * secondes, précisément sur les téléphones lents qu'on cherche à ménager.
 * Ici, la balise part dans le HTML et le navigateur commence à charger les
 * 58 Ko en parallèle du reste.
 *
 * ── Pourquoi ce n'est pas le film de marque ─────────────────────────────
 * Le film est noir avec de grandes écritures blanches, et le titre du site
 * est blanc : on aurait eu du texte sur du texte. Ce plan-ci est fabriqué
 * pour vivre DERRIÈRE quelque chose — aucune typographie, aucune coupe, tout
 * assombri, et le sujet décalé à droite pour laisser la moitié gauche au
 * texte. Sa boucle est exacte : l'image de fin est identique à celle de
 * départ, le raccord ne se voit pas.
 *
 * ── Le poids, mesuré ────────────────────────────────────────────────────
 * 58 Ko pour 8 s en 1280×720 — moins qu'une photo, parce que l'image est
 * sombre, lente et sans détail. C'est ce chiffre qui a levé l'objection du
 * coût en 3G : il est donc servi à tout le monde, téléphone compris, sans
 * aucune détection de connexion.
 *
 * `ne-fond-anime` est neutralisée dans globals.css quand le visiteur demande
 * moins de mouvement : l'aplat de fond reste alors seul.
 */
export function HeroFond() {
  return (
    <video
      className="ne-fond-anime absolute inset-0 h-full w-full object-cover"
      /* Sur téléphone l'image est recadrée en hauteur : on vise la droite
         pour garder le téléphone dans le cadre plutôt que du vide. */
      style={{ objectPosition: "72% 50%" }}
      src="/film/fond-hero.mp4"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
