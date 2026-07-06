/**
 * Logo/icône de marque num express : carré vert arrondi + bulle SMS + éclair.
 * Vectoriel (net à toutes les tailles), sans image externe.
 */
export function BrandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="num express"
    >
      <defs>
        <linearGradient id="ne-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22c55e" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      {/* Carré arrondi (squircle) */}
      <rect x="16" y="16" width="480" height="480" rx="116" fill="url(#ne-grad)" />
      {/* Bulle de message (contour) */}
      <path
        d="M152 176 C152 154 170 136 192 136 H356 C378 136 396 154 396 176 V300 C396 322 378 340 356 340 H250 L214 384 L208 340 H192 C170 340 152 322 152 300 Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="30"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Éclair (rapidité) */}
      <path
        fill="#ffffff"
        transform="translate(176 112) scale(11)"
        d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"
      />
    </svg>
  );
}
