"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Pixel Meta (Facebook / Instagram).
 *
 * Sans lui, une campagne Facebook ne peut optimiser que sur le CLIC : Meta
 * ignore qui, parmi les gens qu'il envoie, s'inscrit réellement. C'est ce
 * qu'on a vécu sur TikTok — 2 755 vues pour 43 inscriptions. Avec le pixel et
 * l'événement « inscription terminée », Meta va chercher des profils qui
 * ressemblent à ceux qui s'inscrivent vraiment.
 *
 * ── Ce qu'on NE laisse PAS faire ────────────────────────────────────────
 * `autoConfig: false` coupe la collecte automatique des clics de boutons et
 * des champs de formulaire. Ce n'est pas une précaution de principe : nos
 * écrans affichent des numéros virtuels et des codes de vérification, et la
 * page d'attente met même le code dans le TITRE de l'onglet. Rien de tout
 * cela ne doit partir chez Meta. Tous les événements sont donc déclenchés
 * explicitement par nous, avec un contenu que nous choisissons.
 *
 * Aucune donnée personnelle n'est transmise : ni e-mail, ni téléphone, ni
 * identifiant client.
 */

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

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
    /* un bloqueur de publicité, une navigation privée… : sans conséquence */
  }
}

/**
 * Suit les changements de page d'une navigation côté client.
 *
 * SÉPARÉ du chargement du pixel, et ce n'est pas cosmétique : `useSearchParams`
 * fait sortir tout son sous-arbre du rendu serveur. Tant que ce composant
 * enveloppait aussi le <Script>, celui-ci n'apparaissait PAS dans le HTML —
 * vérifié en production, l'identifiant du pixel était introuvable dans la
 * page alors que Clarity, lui, y figurait. Le script doit rester hors de
 * cette frontière ; seul le suivi de navigation la franchit.
 */
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

export function MetaPixel() {
  // Pas de pixel configuré, ou développement : on ne charge rien.
  if (!PIXEL_ID || process.env.NODE_ENV !== "production") return null;

  return (
    <Script id="meta-pixel" strategy="lazyOnload">
      {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('set','autoConfig',false,'${PIXEL_ID}');
fbq('init','${PIXEL_ID}');
fbq('track','PageView');`}
    </Script>
  );
}
