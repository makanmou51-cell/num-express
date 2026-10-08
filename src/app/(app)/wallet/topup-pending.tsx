"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/**
 * Attente de confirmation juste après le retour de Mobile Money.
 *
 * Avant, on écrivait au client « patientez quelques instants puis
 * rafraîchissez » : au moment le plus anxieux du parcours — il vient de payer
 * et son solde n'a pas bougé — on lui demandait de faire le travail lui-même.
 *
 * Plafond volontaire à 4 vérifications espacées de 5 s. `/wallet` lance
 * `reconcilePendingTopups` à CHAQUE rendu serveur : une boucle non bornée
 * enverrait autant d'appels chez LeekPay, sur une page où `maxDuration = 60`.
 * Au-delà, on repasse la main au client avec un bouton explicite.
 *
 * Le compteur est rangé sous l'identifiant de la recharge en attente : une
 * nouvelle recharge repart donc de zéro, sans quoi un deuxième paiement dans
 * la même session n'aurait droit à aucune vérification automatique.
 */

const MAX_CHECKS = 4;
const DELAY_MS = 5000;

export function TopupPending({ pendingId }: { pendingId: string | null }) {
  const router = useRouter();
  const key = pendingId ? `ne_topup_checks:${pendingId}` : null;
  // null = compteur pas encore lu (on ne touche pas au stockage pendant le
  // rendu serveur, ça planterait).
  const [tries, setTries] = useState<number | null>(null);

  useEffect(() => {
    let n = 0;
    try {
      if (key) n = Number(sessionStorage.getItem(key) ?? 0) || 0;
    } catch {
      /* navigation privée : on repart de zéro, sans casser */
    }
    setTries(n);
  }, [key]);

  useEffect(() => {
    if (tries === null || tries >= MAX_CHECKS) return;
    const t = setTimeout(() => {
      const next = tries + 1;
      try {
        if (key) sessionStorage.setItem(key, String(next));
      } catch {
        /* ignore */
      }
      setTries(next);
      router.refresh();
    }, DELAY_MS);
    return () => clearTimeout(t);
  }, [tries, key, router]);

  const exhausted = tries !== null && tries >= MAX_CHECKS;

  function checkNow() {
    try {
      if (key) sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setTries(0);
    router.refresh();
  }

  if (exhausted) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Paiement pas encore confirmé</p>
        <p className="mt-1">
          Mobile Money met parfois quelques minutes. Votre argent n&apos;est pas
          perdu&nbsp;: dès que le prestataire confirme, votre solde est crédité
          automatiquement.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full sm:w-auto"
          onClick={checkNow}
        >
          Vérifier maintenant
        </Button>
        <p className="mt-2 text-xs text-blue-900/80">
          Toujours rien après 10 minutes&nbsp;? Écrivez-nous par le chat en bas
          à droite, avec l&apos;heure de votre paiement.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
      role="status"
      aria-live="polite"
    >
      <span
        className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
        aria-hidden="true"
      />
      <div>
        <p className="font-semibold">Vérification de votre paiement…</p>
        <p className="mt-0.5">
          Votre solde se mettra à jour tout seul. Ne fermez pas cette page.
          {tries !== null && tries > 0 && (
            <span className="tabular-nums">
              {" "}
              ({tries}/{MAX_CHECKS})
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
