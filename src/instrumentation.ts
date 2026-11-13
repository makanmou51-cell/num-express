import * as Sentry from "@sentry/nextjs";

/**
 * Instrumentation serveur (runtimes Node et Edge). Next.js appelle `register()`
 * une fois au démarrage de chaque runtime.
 *
 * Sentry reste INACTIF tant que `NEXT_PUBLIC_SENTRY_DSN` n'est pas défini : on
 * peut donc déployer ce code sans risque — il ne fait rien tant que la clé
 * Sentry n'est pas renseignée (ni en local, ni sur Vercel). Dès qu'on ajoute le
 * DSN, le suivi des erreurs s'active tout seul.
 */
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    // Les ERREURS sont toujours capturées ; on n'échantillonne que les traces
    // de performance (10 %), pour ne pas saturer le quota gratuit.
    tracesSampleRate: 0.1,
    // On n'envoie rien depuis une machine de développement.
    enabled: process.env.NODE_ENV === "production",
  });
}

// Remonte à Sentry les erreurs survenues pendant le rendu serveur et les route
// handlers (hook officiel de Next.js). Sans DSN, cet appel ne fait rien.
export const onRequestError = Sentry.captureRequestError;
