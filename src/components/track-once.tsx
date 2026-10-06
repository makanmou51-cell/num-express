"use client";

import { useEffect, useRef } from "react";
import { trackMeta } from "@/components/meta-track";

/**
 * Déclenche UNE SEULE FOIS un événement de conversion Meta.
 *
 * Pourquoi « une seule fois » mérite un composant à part : ces écrans sont
 * rendus à nouveau au moindre rafraîchissement, et React ré-exécute les
 * effets en développement. Sans garde, une inscription compterait deux ou
 * trois fois — Meta apprendrait sur des chiffres faux et irait chercher les
 * mauvais profils. On paierait de la publicité pour du bruit.
 *
 * Ne transmet jamais de donnée personnelle : seulement le nom de l'événement
 * et, pour un paiement, le montant et la devise.
 */
export function TrackOnce({
  event,
  value,
  currency,
}: {
  event: "CompleteRegistration" | "Purchase" | "InitiateCheckout";
  value?: number;
  currency?: string;
}) {
  const envoye = useRef(false);
  useEffect(() => {
    if (envoye.current) return;
    envoye.current = true;
    trackMeta(
      event,
      value !== undefined ? { value, currency: currency ?? "XOF" } : undefined,
    );
  }, [event, value, currency]);
  return null;
}
