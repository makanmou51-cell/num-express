import type { NextConfig } from "next";

/**
 * Content-Security-Policy — posée en mode RAPPORT SEUL (Report-Only).
 *
 * Pourquoi « rapport seul » d'abord : une CSP stricte peut casser en silence
 * un script tiers (chat, pixel, mesure d'audience) si on oublie un domaine. En
 * mode rapport, le navigateur NE BLOQUE RIEN — il se contente de SIGNALER ce
 * qui aurait été bloqué. On observe quelques jours de trafic réel, puis on
 * passe la règle en mode bloquant en renommant simplement l'en-tête
 * `Content-Security-Policy-Report-Only` → `Content-Security-Policy`.
 *
 * Les rapports de violation partent vers Sentry (déjà en place) via
 * `report-uri`, construit à partir du DSN public. Si le DSN n'est pas défini,
 * la directive est omise sans erreur.
 *
 * Domaines tiers autorisés, repérés dans le code :
 *  - Tawk.to (chat)      embed.tawk.to, *.tawk.to (+ websocket wss)
 *  - Meta Pixel          connect.facebook.net, *.facebook.com
 *  - Microsoft Clarity   www.clarity.ms, *.clarity.ms, c.bing.com
 *  - Sentry (ingest)     *.ingest.*.sentry.io
 *  - Drapeaux des pays   flagcdn.com (images)
 *
 * `'unsafe-inline'` sur script/style est assumé : l'app charge ses tiers via
 * de petits scripts en ligne (chat, pixel, Clarity) et Next injecte des styles
 * en ligne. On ne passe PAS aux « nonces » : cela imposerait un rendu
 * dynamique sur toutes les pages — plus lent et plus cher (cf. doc Next CSP).
 */

/** Construit l'URL de rapport CSP de Sentry à partir du DSN public. */
function sentryCspReportUri(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const publicKey = u.username;
    const projectId = u.pathname.replace(/^\/+/, "");
    if (!publicKey || !projectId) return null;
    return `${u.protocol}//${u.host}/api/${projectId}/security/?sentry_key=${publicKey}`;
  } catch {
    return null;
  }
}

const reportUri = sentryCspReportUri();

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://www.clarity.ms https://connect.facebook.net https://embed.tawk.to https://*.tawk.to",
  "style-src 'self' 'unsafe-inline' https://*.tawk.to",
  "img-src 'self' data: blob: https://flagcdn.com https://www.clarity.ms https://*.clarity.ms https://www.facebook.com https://*.facebook.com https://*.tawk.to",
  "font-src 'self' data: https://embed.tawk.to https://*.tawk.to",
  "connect-src 'self' https://www.clarity.ms https://*.clarity.ms https://c.bing.com https://www.facebook.com https://*.facebook.com https://*.tawk.to wss://*.tawk.to https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io",
  "frame-src 'self' https://*.tawk.to https://www.facebook.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self'",
  // `upgrade-insecure-requests` est volontairement omis : il est ignoré en
  // mode rapport seul (et provoque un avertissement console), et le site n'a
  // de toute façon aucune ressource en http. À ajouter au passage en bloquant.
  ...(reportUri ? [`report-uri ${reportUri}`] : []),
].join("; ");

// En-têtes de sécurité appliqués à toutes les réponses.
const securityHeaders = [
  // Force HTTPS (2 ans, sous-domaines inclus).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Empêche le sniffing de type MIME.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Interdit l'affichage du site dans une iframe (anti-clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Limite les infos de référent envoyées.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Désactive des API navigateur sensibles par défaut.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Isole l'origine (anti-Spectre / fenêtres croisées).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // CSP en mode RAPPORT SEUL : ne bloque rien, signale seulement (voir plus
  // haut). À passer en `Content-Security-Policy` une fois les rapports Sentry
  // vérifiés sur quelques jours.
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // N'expose pas la stack technique.
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
