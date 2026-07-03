import type { NextConfig } from "next";

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
