import { ImageResponse } from "next/og";

/**
 * Image de partage (Open Graph) — l'aperçu qui s'affiche quand on colle le
 * lien num-express.com dans WhatsApp, Facebook, Telegram, etc.
 *
 * Elle est GÉNÉRÉE par le code (pas un fichier .jpg à fournir) : Next l'évalue
 * au build et ajoute tout seul les balises <meta property="og:image"> dans le
 * <head>. Avantage : pas de photo à préparer, et elle reste cohérente avec la
 * marque si les couleurs changent.
 *
 * Contraintes volontaires pour ne JAMAIS casser le déploiement :
 *  - aucune police externe, aucun accès réseau, aucun accès disque. Si cette
 *    fonction lançait une erreur au build, tout le site ne se déploierait plus.
 *    On s'appuie donc sur la police intégrée de `next/og`.
 *  - le logo est dessiné en SVG inline (data URI), sans lire de fichier.
 *
 * Rappel satori (le moteur de rendu) : tout conteneur qui a PLUSIEURS enfants
 * doit porter `display: "flex"`, sinon le rendu échoue.
 */

export const alt =
  "num express — numéros virtuels pour recevoir vos codes SMS, payés en Mobile Money";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Logo : carré vert arrondi, bulle de message blanche + éclair (même marque
// que l'icône du site). Encodé en data URI, sans lecture de fichier.
const LOGO_SVG = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#22c55e"/><stop offset="1" stop-color="#15803d"/>
</linearGradient></defs>
<rect x="16" y="16" width="480" height="480" rx="116" fill="url(#g)"/>
<path d="M152 176 C152 154 170 136 192 136 H356 C378 136 396 154 396 176 V300 C396 322 378 340 356 340 H250 L214 384 L208 340 H192 C170 340 152 322 152 300 Z" fill="none" stroke="#ffffff" stroke-width="30" stroke-linejoin="round" stroke-linecap="round"/>
<path fill="#ffffff" transform="translate(176 112) scale(11)" d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>
</svg>`;

// base64 plutôt qu'URL-encodé : le moteur d'images de `next/og` (resvg) lit le
// base64 de façon fiable. `opengraph-image` s'exécute sur le runtime Node par
// défaut, donc `Buffer` est disponible.
const LOGO_SRC = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;

function Chip({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 22px",
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.14)",
        color: "#86efac",
        fontSize: 26,
      }}
    >
      {children}
    </div>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 76,
          backgroundColor: "#06241A",
          backgroundImage:
            "radial-gradient(900px 480px at 88% -12%, rgba(34,197,94,0.22), transparent 62%)",
          color: "#ffffff",
        }}
      >
        {/* En-tête : logo + nom */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} width={92} height={92} alt="" />
          <div
            style={{
              display: "flex",
              marginLeft: 22,
              fontSize: 42,
              letterSpacing: "-0.5px",
            }}
          >
            num express
          </div>
        </div>

        {/* Message principal */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              lineHeight: 1.05,
              letterSpacing: "-1.5px",
              maxWidth: 940,
            }}
          >
            Recevez vos codes SMS en quelques secondes.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 31,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.74)",
              maxWidth: 880,
            }}
          >
            Numéros virtuels pour Telegram, WhatsApp, Google et 2 000 services —
            payés en Mobile Money.
          </div>
        </div>

        {/* Pied : preuves + domaine */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 14 }}>
            <Chip>200 pays</Chip>
            <Chip>2 000 services</Chip>
            <Chip>Mobile Money</Chip>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            num-express.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
