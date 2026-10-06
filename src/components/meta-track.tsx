"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Partie CLIENT du pixel Meta : déclenchement des événements et suivi des
 * changements de page.
 *
 * Séparée du chargement du script, et ce n'est pas un détail d'organisation.
 * Un `<Script strategy="lazyOnload">` placé dans un composant « use client »
 * n'est injecté qu'APRÈS l'hydratation : il n'apparaît jamais dans le HTML
 * servi. Vérifié en production — l'identifiant du pixel était introuvable
 * dans la page, alors que Clarity, qui est un composant serveur, y figurait.
 * Le script vit donc dans `meta-pixel.tsx` (serveur) ; tout ce qui a besoin
 * de hooks vit ici.
 */

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown };
    _fbq?: unknown;
  }
}

/** Déclenche un événement standard Meta. Sans effet si le pixel est absent. */
export function trackMeta(
  event: string,
  params?: Record<string, string | number>,
) {
  try {
    window.fbq?.("track", event, params);
  } catch {
    /* bloqueur de publicité, navigation privée… : sans conséquence */
  }
}

/** Suit les changements de page d'une navigation côté client. */
export function MetaPageViews() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    /* Next.js ne recharge pas la page entre deux écrans : sans ce rappel,
       Meta ne verrait que la toute première page de chaque visite. */
    trackMeta("PageView");
  }, [pathname, search]);
  return null;
}
