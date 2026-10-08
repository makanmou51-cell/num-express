import { ImageResponse } from "next/og";

export const runtime = "nodejs";

// Tailles autorisées pour les icônes PWA.
const SIZES: Record<string, number> = { "192": 192, "512": 512 };

// Icône « maskable » : fond vert PLEIN (bord à bord) + logo centré dans la zone
// de sécurité, pour un rendu net sur l'écran d'accueil Android/iOS.
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#0B3D24"/>
<path d="M152 176 C152 154 170 136 192 136 H356 C378 136 396 154 396 176 V300 C396 322 378 340 356 340 H250 L214 384 L208 340 H192 C170 340 152 322 152 300 Z" fill="none" stroke="#ffffff" stroke-width="30" stroke-linejoin="round" stroke-linecap="round"/>
<path fill="#ffffff" transform="translate(176 112) scale(11)" d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>
</svg>`;

const ICON_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(ICON_SVG).toString("base64")}`;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size } = await params;
  const px = SIZES[size] ?? 512;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ICON_DATA_URI} width={px} height={px} alt="num express" />
      </div>
    ),
    { width: px, height: px },
  );
}
