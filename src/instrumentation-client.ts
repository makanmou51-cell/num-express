import * as Sentry from "@sentry/nextjs";

/**
 * Instrumentation navigateur. Chargée automatiquement par Next.js côté client.
 * Comme pour le serveur, INACTIVE tant que `NEXT_PUBLIC_SENTRY_DSN` est vide.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Pas de « session replay » pour l'instant (vie privée + poids).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    enabled: process.env.NODE_ENV === "production",
  });
}

// Capture les erreurs lors des changements de page (navigation App Router).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
