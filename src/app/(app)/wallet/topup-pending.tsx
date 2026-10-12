"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/**
 * Attente de confirmation juste après le retour de Mobile Money.
 *
 * ── Ce qui ne marchait pas ──────────────────────────────────────────────
 * La première version vérifiait quatre fois, espacées de cinq secondes, en
 * rafraîchissant la page entière. Vingt secondes au total.
 *
 * C'est trop court. Un paiement Mobile Money met couramment une à cinq
 * minutes à être confirmé. Passé vingt secondes, le client était abandonné
 * avec un bouton — et s'il quittait la page, plus rien ne se passait jusqu'à
 * son retour. Mesuré en production : un dépôt de 900 F lancé à 10 h 18 n'a
 * été crédité qu'à 11 h 21. Soixante-trois minutes pendant lesquelles le
 * client a cru avoir perdu son argent.
 *
 * ── Ce qui change ───────────────────────────────────────────────────────
 * On interroge désormais un point d'entrée LÉGER (`/api/wallet/pending`) qui
 * ne fait que vérifier la recharge, au lieu de recharger toute la page. Comme
 * c'est léger, on peut tenir CINQ MINUTES au lieu de vingt secondes, avec un
 * espacement qui s'allonge : rapide au début, quand la confirmation a le plus
 * de chances d'arriver, puis plus calme.
 *
 * La page n'est rechargée QUE lorsque l'argent est réellement arrivé.
 */

/* Intervalles en secondes, cumulés : 5 min de surveillance. Serré au debut
   (la plupart des confirmations tombent dans la premiere minute), puis
   espace pour ne pas marteler le prestataire. */
const RYTHME = [3, 3, 4, 5, 5, 5, 8, 8, 10, 10, 15, 15, 20, 20, 30, 30, 30, 30, 30, 30];

export function TopupPending({ pendingId }: { pendingId: string | null }) {
  const router = useRouter();
  /* Le compteur ne survit volontairement PAS a un rafraichissement. La
     version precedente le rangeait dans sessionStorage, ce qui obligeait a
     le lire dans un effet puis a appeler setState — un rendu en cascade a
     chaque montage. Repartir de zero quand la page est rechargee ne coute
     rien : cela redonne simplement cinq minutes de surveillance, ce qui est
     exactement ce qu on veut pour un client qui attend son argent. */
  const [etape, setEtape] = useState(0);
  /* Un booleen d etat plutot qu une ref : une ref ne peut pas etre modifiee
     pendant le rendu, et c est precisement ce qu il faut faire quand une
     nouvelle recharge arrive. */
  const [fini, setFini] = useState(false);

  /* Une NOUVELLE recharge doit repartir avec cinq minutes pleines. On ajuste
     l etat pendant le rendu plutot que dans un effet : c est le motif prevu
     par React pour reagir au changement d une prop, et il evite le rendu
     supplementaire qu un effet provoquerait. */
  const [idSuivi, setIdSuivi] = useState(pendingId);
  if (pendingId !== idSuivi) {
    setIdSuivi(pendingId);
    setEtape(0);
    setFini(false);
  }

  const verifier = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch("/api/wallet/pending", { cache: "no-store" });
      if (!r.ok) return false;
      const d: { credite?: number; enAttente?: number } = await r.json();
      /* Crédité, ou plus rien en attente : dans les deux cas l'écran doit
         disparaître, donc on recharge la page. */
      return (d.credite ?? 0) > 0 || (d.enAttente ?? 1) === 0;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (fini || etape >= RYTHME.length) return;
    const t = setTimeout(async () => {
      if (await verifier()) {
        setFini(true);
        router.refresh();
        return;
      }
      setEtape(etape + 1);
    }, RYTHME[etape] * 1000);
    return () => clearTimeout(t);
  }, [etape, fini, router, verifier]);

  const epuise = etape >= RYTHME.length;

  function verifierMaintenant() {
    setFini(false);
    setEtape(0);
  }

  if (epuise) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Paiement pas encore confirmé</p>
        <p className="mt-1">
          Mobile Money met parfois plusieurs minutes. Votre argent n&apos;est
          pas perdu&nbsp;: dès que le prestataire confirme, votre solde est
          crédité automatiquement, même si vous fermez cette page.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full sm:w-auto"
          onClick={verifierMaintenant}
        >
          Vérifier maintenant
        </Button>
        <p className="mt-2 text-xs text-blue-900/80">
          Toujours rien après 15 minutes&nbsp;? Écrivez-nous par le chat en bas
          à droite, avec l&apos;heure de votre paiement.
        </p>
      </div>
    );
  }

  /* Minutes restantes de surveillance, pour que l'attente soit lisible. */
  const restant = Math.ceil(RYTHME.slice(etape).reduce((s, n) => s + n, 0) / 60);

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
          Votre solde se mettra à jour tout seul. Mobile Money met parfois
          jusqu&apos;à cinq minutes.
          {restant > 0 && (
            <span className="text-blue-900/70">
              {" "}
              Vérification en cours pendant encore {restant} min.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
