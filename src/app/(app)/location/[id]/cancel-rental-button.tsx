"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { cancelRentalAction } from "../actions";

/* Doit rester EGAL au seuil du serveur (src/lib/rentals.ts). HeroSMS
   n'accepte une annulation qu'a partir de ~120 s ; a 110 s le client
   declenchait un remboursement que le fournisseur refusait, et num express
   restait avec un numero facture sur les bras. */
const MIN_CANCEL_MS = 125_000; // 2 min 05 s
/* Fenetre HAUTE, alignee sur HeroSMS : « Vous pouvez annuler la location dans
   les 20 minutes si le code n'est pas recu. Passe ce delai, aucun
   remboursement ne sera possible. » On affiche la verite au client plutot que
   de lui proposer un bouton qui echouera. */
const MAX_CANCEL_MS = 20 * 60_000;

/**
 * Annulation + remboursement d'une location.
 *
 * Trois défauts corrigés :
 *
 * 1. Le bouton était `variant="outline"` — blanc et discret — alors que le
 *    même geste sur une activation est un bouton rouge. Deux écrans du même
 *    site, deux apparences pour la même action.
 * 2. Pendant le verrouillage il affichait des secondes brutes
 *    (« Annulation possible dans 97 s ») et l'explication était reléguée
 *    SOUS le bouton, souvent hors de l'écran.
 * 3. Il déclenchait un `confirm()` natif : une fenêtre système hors marque,
 *    souvent en anglais sur les Android d'entrée de gamme — pour un geste qui
 *    rembourse de l'argent. Remplacé par un panneau dans la page dont
 *    l'action par défaut est de NE PAS annuler.
 */
export function CancelRentalButton({
  id,
  createdAt,
}: {
  id: string;
  createdAt: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const secondsLeft = () => {
    const ms = MIN_CANCEL_MS - (Date.now() - new Date(createdAt).getTime());
    return Math.max(0, Math.ceil(ms / 1000));
  };
  const [wait, setWait] = useState<number>(secondsLeft);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setInterval(() => setWait(secondsLeft()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wait]);

  const locked = wait > 0;
  const expired = Date.now() - new Date(createdAt).getTime() > MAX_CANCEL_MS;
  // Part de l'attente déjà écoulée : la barre se remplit sous ses yeux.
  const progress = locked
    ? Math.min(100, 100 - (wait * 1000 * 100) / MIN_CANCEL_MS)
    : 100;
  const mmss = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, "0")}`;

  if (confirming) {
    return (
      <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="font-semibold">Annuler cette location&nbsp;?</p>
        <p className="text-sm text-muted">
          Le montant payé revient immédiatement sur votre solde et le numéro est
          rendu au fournisseur. C&apos;est définitif&nbsp;: vous ne pourrez plus
          recevoir de SMS sur ce numéro.
        </p>
        {msg && <Alert variant="error">{msg}</Alert>}
        <div className="space-y-2">
          {/* L'action la moins risquée reste la plus facile à atteindre. */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            Non, garder le numéro
          </Button>
          <Button
            type="button"
            variant="danger"
            className="w-full"
            disabled={pending}
            onClick={() => {
              setMsg(null);
              start(async () => {
                const r = await cancelRentalAction(id);
                if (r.ok) {
                  router.push("/numbers");
                  router.refresh();
                } else {
                  setMsg(r.message ?? "Annulation impossible.");
                }
              });
            }}
          >
            {pending ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
                Annulation…
              </>
            ) : (
              "Oui, annuler et me rembourser"
            )}
          </Button>
        </div>
      </div>
    );
  }

  /* Au-dela de 20 min, le fournisseur ne rembourse plus : proposer le bouton
     reviendrait a promettre un remboursement qu'on ne peut pas tenir. On dit
     ce que le client PEUT encore faire — garder son numero et reessayer. */
  if (expired) {
    return (
      <div className="rounded-2xl border border-border bg-gray-50 p-4">
        <p className="text-sm font-semibold">
          Le délai d&apos;annulation est passé
        </p>
        <p className="mt-1 text-sm text-muted">
          Ce numéro reste à vous pour toute la durée achetée. Vous pouvez
          continuer à demander votre code dessus, autant de fois qu&apos;il le
          faut — c&apos;est tout l&apos;intérêt d&apos;un numéro dédié.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* L'explication passe AU-DESSUS du bouton : en dessous, elle tombait
          souvent hors de l'écran sur un téléphone. */}
      <p className="text-sm text-muted">
        Pas de code reçu&nbsp;? Vous pouvez annuler <strong>2 minutes</strong>{" "}
        après l&apos;achat et être remboursé immédiatement — vous avez{" "}
        <strong>20 minutes</strong> pour le faire.
      </p>

      {locked && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-label="Délai avant annulation"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <Button
        type="button"
        variant="danger"
        className="w-full"
        disabled={locked}
        onClick={() => setConfirming(true)}
      >
        {locked ? (
          <>
            Annulation possible dans{" "}
            <span className="tabular-nums">{mmss}</span>
          </>
        ) : (
          "Annuler & être remboursé"
        )}
      </Button>

      {msg && <Alert variant="error">{msg}</Alert>}
    </div>
  );
}
