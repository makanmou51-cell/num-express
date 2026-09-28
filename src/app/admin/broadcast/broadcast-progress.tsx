"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, Card } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import {
  sendNextBatchAction,
  stopBroadcastAction,
  type BroadcastState,
} from "./actions";

/** Message clair pour chaque façon dont un lot peut s'arrêter. */
function messageDeLot(
  r: Exclude<BroadcastState, undefined | { error: string }>,
) {
  if (r.done) {
    return `Diffusion terminée : tous les clients ont été servis.`;
  }
  const pars = `${r.sent} e-mail${r.sent > 1 ? "s" : ""} parti${r.sent > 1 ? "s" : ""}`;
  switch (r.reason) {
    case "lot-plein":
      return `${pars}. Quota du jour atteint — la suite part demain toute seule.`;
    case "quota-fournisseur":
      return `${pars}. Resend a refusé la suite (quota journalier). Les clients non servis restent dans la file, rien n'est perdu.`;
    case "temps":
      return `${pars}. Le lot a été coupé par la limite de temps — clique à nouveau pour continuer.`;
    default:
      return `${pars}.`;
  }
}

function BoutonLot({ quota }: { quota: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || quota <= 0}>
      {pending
        ? "Envoi en cours…"
        : quota <= 0
          ? "Quota du jour épuisé"
          : `Envoyer les ${quota} suivants`}
    </Button>
  );
}

function BoutonArret() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" disabled={pending}>
      {pending ? "…" : "Arrêter la diffusion"}
    </Button>
  );
}

export function BroadcastProgress({
  id,
  subject,
  total,
  done,
  ok,
  failed,
  remaining,
  quotaRestant,
}: {
  id: string;
  subject: string;
  total: number;
  done: number;
  ok: number;
  failed: number;
  remaining: number;
  quotaRestant: number;
}) {
  const [lot, envoyerLot] = useActionState<BroadcastState, FormData>(
    sendNextBatchAction,
    undefined,
  );
  const [arret, arreter] = useActionState<ActionState, FormData>(
    stopBroadcastAction,
    undefined,
  );

  const pct = total ? Math.round((done / total) * 100) : 0;
  const jours = Math.ceil(remaining / 80);

  return (
    <Card className="max-w-2xl space-y-5 p-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <h2 className="text-lg font-bold">Diffusion en cours</h2>
        </div>
        <p className="mt-1 truncate text-sm text-muted">« {subject} »</p>
      </div>

      {lot && "error" in lot && <Alert variant="error">{lot.error}</Alert>}
      {lot && !("error" in lot) && (
        <Alert variant={lot.done ? "success" : "info"}>
          {messageDeLot(lot)}
        </Alert>
      )}
      {arret?.error && <Alert variant="error">{arret.error}</Alert>}
      {arret?.success && <Alert variant="success">{arret.success}</Alert>}

      {/* La barre est le vrai indicateur : on voit d'un coup d'œil où en est
          la file, sans avoir à lire des chiffres. */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums">
            {done}
            <span className="text-base font-medium text-muted"> / {total}</span>
          </span>
          <span className="text-sm font-semibold text-muted tabular-nums">
            {pct} %
          </span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Avancement de la diffusion"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted">
          <strong className="text-foreground">{ok}</strong> reçu
          {ok > 1 ? "s" : ""}
          {failed > 0 && (
            <>
              {" · "}
              <strong className="text-destructive">{failed}</strong> adresse
              {failed > 1 ? "s" : ""} invalide{failed > 1 ? "s" : ""}
            </>
          )}
          {" · "}
          <strong className="text-foreground">{remaining}</strong> en attente
        </p>
      </div>

      {remaining > 0 && (
        <p className="rounded-lg bg-primary/5 px-3 py-2.5 text-sm">
          {quotaRestant > 0 ? (
            <>
              Il reste <strong>{quotaRestant}</strong> e-mail
              {quotaRestant > 1 ? "s" : ""} autorisé
              {quotaRestant > 1 ? "s" : ""} aujourd&apos;hui.
            </>
          ) : (
            <>
              Quota du jour épuisé. <strong>Tu n&apos;as rien à faire</strong> :
              le prochain lot part automatiquement cette nuit à 3 h.
            </>
          )}{" "}
          Encore ~
          <strong>
            {jours} jour{jours > 1 ? "s" : ""}
          </strong>{" "}
          pour terminer.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <form action={envoyerLot}>
          <input type="hidden" name="broadcastId" value={id} />
          <BoutonLot quota={quotaRestant} />
        </form>
        <form action={arreter}>
          <input type="hidden" name="broadcastId" value={id} />
          <BoutonArret />
        </form>
      </div>
    </Card>
  );
}
