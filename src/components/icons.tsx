/**
 * Jeu d'icônes partagé.
 *
 * Pourquoi un fichier unique : chaque écran redessinait ses propres SVG dans
 * son coin, avec des épaisseurs de trait et des tailles différentes — c'est le
 * défaut que le référentiel UI appelle « Stroke Consistency » / « Consistent
 * Icon Sizing », et ça se voit immédiatement quand deux icônes se retrouvent
 * côte à côte.
 *
 * Règles tenues ici :
 *  - jamais d'emoji comme icône (dépend de la police du téléphone, impossible
 *    à colorer avec les tokens, rendu différent sur chaque Android) ;
 *  - viewBox 24×24, trait `currentColor` d'épaisseur 2 pour tout le jeu
 *    (seule la coche monte à 2,5 : sinon elle paraît plus fine que le reste) ;
 *  - `aria-hidden` par défaut — ces icônes accompagnent toujours un texte
 *    visible. Une icône SEULE porteuse de sens doit recevoir un `title` via
 *    la prop `label`, qui lève alors le `aria-hidden`.
 *  - taille pilotée par `className` (h-4/h-5/h-6), jamais en dur.
 */

type IconProps = {
  className?: string;
  /** Nom accessible : à ne remplir que si l'icône est seule et porte du sens. */
  label?: string;
};

function Svg({
  className = "h-5 w-5",
  label,
  strokeWidth = 2,
  children,
}: IconProps & { strokeWidth?: number; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      {children}
    </svg>
  );
}

/* ───────────────────────────── Action ───────────────────────────── */

export function IconCopy(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </Svg>
  );
}

export function IconRefresh(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </Svg>
  );
}

export function IconShare(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3v13" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </Svg>
  );
}

/** Flèche qui descend dans un bac : de l'argent qui rentre (recharge). */
export function IconTopup(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3v10" />
      <path d="m7.5 9 4.5 4 4.5-4" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </Svg>
  );
}

/** Deux flèches opposées : correction manuelle du solde. */
export function IconAdjust(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 8h13" />
      <path d="m14 5 3 3-3 3" />
      <path d="M20 16H7" />
      <path d="m10 13-3 3 3 3" />
    </Svg>
  );
}

export function IconCart(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h2.5l2.2 11.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 7H6" />
    </Svg>
  );
}

/** Œil : relire le mot de passe qu'on vient de taper. */
export function IconEye(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconEyeOff(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10.7 6.1A8.6 8.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.6" />
      <path d="M6.4 7.9A16 16 0 0 0 2.5 12S6 18 12 18a8.9 8.9 0 0 0 3.6-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </Svg>
  );
}

/* ───────────────────────────── Statut ───────────────────────────── */

export function IconCheck(p: IconProps) {
  return (
    <Svg strokeWidth={2.5} {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function IconCheckCircle(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </Svg>
  );
}

export function IconWarnCircle(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5M12 16.5h.01" />
    </Svg>
  );
}

export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Svg>
  );
}

/** Flèche qui revient en arrière dans un cercle : remboursement. */
export function IconRefund(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H9.5" />
      <path d="m11.5 7.5-1.5 2 1.5 2" />
    </Svg>
  );
}

/* ─────────────────────────── Communication ─────────────────────────── */

/** Cloche : notifications navigateur. */
export function IconBell(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </Svg>
  );
}

/** Bulle de discussion : lanceur du chat d'assistance. */
export function IconChat(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.4-.6L3 21l1.7-5a8.2 8.2 0 0 1-.7-3.4 8.4 8.4 0 0 1 8.5-8.5 8.4 8.4 0 0 1 8.5 8.4z" />
    </Svg>
  );
}

export function IconSms(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

export function IconCall(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l4 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </Svg>
  );
}

/** Globe : repli quand le drapeau d'un pays n'est pas disponible. */
export function IconGlobe(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
    </Svg>
  );
}

/** Carte SIM : état vide d'une liste de numéros. */
export function IconSim(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 2h8l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <rect x="8.5" y="11" width="7" height="7" rx="1" />
    </Svg>
  );
}

/* ───────────────────────────── Navigation ───────────────────────────── */

export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m3 10.5 9-7.5 9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </Svg>
  );
}

/** Courbe qui monte : le boost de réseaux sociaux. */
export function IconBoost(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 17.5 9 11l4 4 8-8.5" />
      <path d="M15 6.5h6v6" />
    </Svg>
  );
}

export function IconArrowLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Svg>
  );
}

export function IconWallet(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
      <path d="M21 10h-4a2 2 0 0 0 0 4h4z" />
    </Svg>
  );
}
