"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { StatusBadge } from "@/components/status-badge";
import { CopyField } from "@/components/copy-field";
import { TimeLeftBar } from "@/components/time-left-bar";
import { PushOptIn } from "@/components/push-optin";
import { stopClarityRecording } from "@/components/clarity";
import {
  IconCall,
  IconCheckCircle,
  IconRefund,
  IconSms,
} from "@/components/icons";
import { formatXof } from "@/lib/pricing";
import {
  cancelActivationAction,
  deliverDemoCodeAction,
  requestNewCodeAction,
} from "@/app/(app)/actions";
import type { ActionState } from "@/lib/forms";

const TERMINAL = ["RECEIVED", "COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"];
/** Statuts où l'argent est revenu chez le client. */
const REFUND_STATES = ["REFUNDED", "EXPIRED", "CANCELLED"];

type Activation = {
  id: string;
  status: string;
  smsCode: string | null;
  phoneNumber: string;
  verifyType?: string; // SMS | CALL
  priceXof: number;
  createdAt: string;
  expiresAt: string | null;
};

// Délai minimum avant de pouvoir annuler manuellement (doit coller au serveur).
const MIN_CANCEL_MIN = 5;
const POLL_MS = 5000;

/** m:ss, toujours sur deux chiffres pour les secondes. */
function mmss(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ActivationLive({
  initial,
  isMock = false,
}: {
  initial: Activation;
  isMock?: boolean;
}) {
  const router = useRouter();
  const [activation, setActivation] = useState<Activation>(initial);
  const [state, formAction] = useActionState<ActionState, FormData>(
    cancelActivationAction,
    undefined,
  );
  const [deliverState, deliverAction] = useActionState<ActionState, FormData>(
    deliverDemoCodeAction,
    undefined,
  );
  const [retryState, retryAction] = useActionState<ActionState, FormData>(
    requestNewCodeAction,
    undefined,
  );

  const isTerminal = TERMINAL.includes(activation.status);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/activations/${activation.id}/status`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as Activation;
      setActivation((prev) => ({ ...prev, ...data }));
    } catch {
      /* on réessaiera */
    }
  }, [activation.id]);

  // Démo : dès que le code est délivré côté serveur, on rafraîchit tout de suite.
  useEffect(() => {
    if (deliverState?.success) poll();
  }, [deliverState?.success, poll]);

  // Polling tant que l'activation n'est pas dans un état terminal.
  useEffect(() => {
    if (isTerminal) {
      router.refresh(); // resynchronise le solde dans la barre
      return;
    }
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [isTerminal, poll, router]);

  /* ── Horloge unique ───────────────────────────────────────────────────
     Une seule source de temps alimente le compte à rebours, le temps
     d'attente écoulé et le déverrouillage de l'annulation — au lieu de deux
     `setInterval` concurrents. Elle démarre à null puis se remplit dans un
     effet : rendre `Date.now()` dès le premier rendu provoquerait un écart
     entre le HTML du serveur et celui du client (erreur d'hydratation). */
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (isTerminal) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isTerminal]);

  const createdMs = new Date(activation.createdAt).getTime();
  const elapsedMs = now !== null ? Math.max(0, now - createdMs) : null;
  const cancelInMs =
    now !== null
      ? Math.max(0, createdMs + MIN_CANCEL_MIN * 60_000 - now)
      : null;
  const canCancel = cancelInMs !== null && cancelInMs <= 0;

  /* Pas de vibration à l'arrivée du code : `navigator.vibrate` est ignoré par
     les navigateurs sans geste utilisateur récent, et ne part pas du tout quand
     l'onglet est en arrière-plan — c'est-à-dire exactement la situation visée
     (le client est dans WhatsApp). À la place : le titre de l'onglet porte le
     code — ça, il le voit depuis WhatsApp en revenant sur son navigateur. */
  useEffect(() => {
    if (!activation.smsCode) return;
    // Le titre va porter le code : plus aucun enregistrement a partir d ici.
    stopClarityRecording();
    const prev = document.title;
    document.title = `Code reçu : ${activation.smsCode}`;
    return () => {
      document.title = prev;
    };
  }, [activation.smsCode]);

  const isCall = activation.verifyType === "CALL";

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={activation.status} />
      </div>

      {/* ── Temps restant ─────────────────────────────────────────────────
          Avant : un « Expire dans 7:42 » de 14 px en gris perdu à droite, qui
          finissait par afficher littéralement « Expire dans expiré ».
          Maintenant : une barre qui se vide, visible d'un coup d'œil, et une
          phrase correcte une fois le délai écoulé. */}
      {!isTerminal && activation.expiresAt && (
        <TimeLeftBar
          startedAt={activation.createdAt}
          endsAt={activation.expiresAt}
          format="short"
          endedLabel="Délai écoulé — remboursement en cours"
        />
      )}

      {/* ── Le numéro ────────────────────────────────────────────────────
          C'est l'élément central de l'écran : pleine largeur, chiffres
          groupés, et tout le bloc est tapable pour copier. */}
      <CopyField
        label="Numéro à saisir"
        value={`+${activation.phoneNumber}`}
        size="lg"
      />

      {/* ── Code SMS / attente / issue ───────────────────────────────── */}
      {activation.smsCode ? (
        /* Le bloc se déplie, un halo vert pulse UNE fois, puis les chiffres
           se posent l'un après l'autre. C'est l'instant qui décide si le
           client repart content : il revient de WhatsApp, il a attendu,
           parfois il a déjà échoué plusieurs fois. Tout est en CSS — aucun
           octet ajouté, et la carte graphique s'en charge. */
        <div className="animate-[neCodeIn_260ms_ease-out]">
          <div className="animate-[neSuccessRing_900ms_ease-out_200ms] rounded-xl">
            <CopyField
              label="Code de vérification reçu"
              value={activation.smsCode}
              tone="success"
              grouped={false}
              size="lg"
              reveal
              hint="Collez-le dans l'application pour terminer la vérification."
            />
          </div>
        </div>
      ) : !isTerminal ? (
        <div className="space-y-3">
          {/* Preuve visible que la page travaille : sans ça, sur 3G, le client
              croit l'écran figé, recharge, puis appelle le support. */}
          <div className="rounded-xl border bg-gray-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              Recherche du {isCall ? "appel" : "SMS"} en cours
              <span className="flex gap-1" aria-hidden="true">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </span>
            </p>
            {/* Pas d'horodatage « dernière vérification à 14:32:10 » : un
                chiffre qui se réécrit toutes les 5 s est du langage
                d'ingénieur et ajoute de l'anxiété au lieu d'en enlever.
                Le temps d'attente, lui, répond à la vraie question. */}
            {elapsedMs !== null && (
              <p className="mt-1 text-sm text-muted">
                Vous attendez depuis{" "}
                <strong className="tabular-nums text-foreground">
                  {mmss(elapsedMs)}
                </strong>{" "}
                — le code arrive généralement en moins de 2 minutes.
              </p>
            )}
          </div>

          {/* Le meilleur moment pour proposer les notifications : le client
              attend, il va partir sur WhatsApp, l'intérêt est évident. */}
          <PushOptIn />

          {/* Consigne : deux lignes maximum, icône SVG (plus d'emoji). */}
          <div className="flex gap-3 rounded-xl border bg-white p-4">
            {isCall ? (
              <IconCall className="mt-0.5 h-5 w-5 text-primary" />
            ) : (
              <IconSms className="mt-0.5 h-5 w-5 text-primary" />
            )}
            <div className="text-sm text-muted">
              <p className="font-medium text-foreground">
                {isCall ? "Réception par appel" : "Réception par SMS"}
              </p>
              <p className="mt-1">
                Saisissez ce numéro sur le service — le code s&apos;affiche ici
                tout seul. Si le SMS tarde, choisissez{" "}
                <strong className="text-foreground">
                  «&nbsp;M&apos;appeler&nbsp;»
                </strong>{" "}
                : le code par appel arrive ici aussi.
              </p>
            </div>
          </div>

          {/* Démo : le code n'arrive qu'après une action explicite. */}
          {isMock && (
            <form action={deliverAction}>
              <input type="hidden" name="id" value={activation.id} />
              <SubmitButton
                size="sm"
                variant="outline"
                pendingLabel="Réception…"
              >
                <IconSms className="h-4 w-4" />
                J&apos;ai utilisé le numéro — recevoir le SMS (démo)
              </SubmitButton>
              {deliverState?.error && (
                <p className="mt-2 text-sm text-red-600">
                  {deliverState.error}
                </p>
              )}
            </form>
          )}
        </div>
      ) : (
        /* ── Issue terminale ───────────────────────────────────────────
           Avant : ce bloc valait `null`. L'écran se vidait, il ne restait
           qu'une pastille grise — le client qui venait de payer sans rien
           recevoir n'avait AUCUNE confirmation d'être remboursé, ni aucune
           porte de sortie. C'est précisément là qu'il écrivait au support. */
        <TerminalPanel
          status={activation.status}
          priceXof={activation.priceXof}
        />
      )}

      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      {retryState?.error && <Alert variant="error">{retryState.error}</Alert>}
      {retryState?.success && (
        <Alert variant="success">{retryState.success}</Alert>
      )}

      {/* Redemander un code (uniquement en attente) */}
      {activation.status === "WAITING_CODE" && (
        <form action={retryAction} className="pt-2">
          <input type="hidden" name="id" value={activation.id} />
          <SubmitButton variant="outline" size="sm" pendingLabel="Demande…">
            Redemander un code
          </SubmitButton>
          <p className="mt-2 text-xs text-muted">
            Le SMS tarde ? Demandez un nouveau code — c&apos;est gratuit et vous
            gardez le même numéro.
          </p>
        </form>
      )}

      {/* Annulation (uniquement en attente) */}
      {activation.status === "WAITING_CODE" &&
        (canCancel ? (
          <form action={formAction} className="pt-2">
            <input type="hidden" name="id" value={activation.id} />
            <p className="mb-2 text-sm text-muted">
              Pas de code ? Annulez pour être remboursé tout de suite. Sinon, le
              remboursement est <strong>automatique</strong> à
              l&apos;expiration.
            </p>
            <SubmitButton
              variant="danger"
              className="w-full"
              pendingLabel="Annulation…"
            >
              Annuler &amp; être remboursé
            </SubmitButton>
          </form>
        ) : (
          <div className="pt-2">
            {/* L'explication passe AU-DESSUS du bouton : sous le bouton, elle
                tombait souvent hors de l'écran. */}
            <p className="mb-2 text-sm text-muted">
              Le code peut encore arriver — l&apos;annulation s&apos;ouvre dans
              un instant.
            </p>
            <Button type="button" variant="danger" className="w-full" disabled>
              Annulation possible dans{" "}
              <span className="tabular-nums">
                {cancelInMs !== null ? mmss(cancelInMs) : "—"}
              </span>
            </Button>
          </div>
        ))}
    </Card>
  );
}

/** Ce qu'on affiche une fois l'activation close, selon l'issue. */
function TerminalPanel({
  status,
  priceXof,
}: {
  status: string;
  priceXof: number;
}) {
  if (!REFUND_STATES.includes(status)) {
    return (
      <div className="flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <IconCheckCircle className="mt-0.5 h-6 w-6 text-green-700" />
        <div>
          <p className="font-semibold text-green-900">Numéro utilisé</p>
          <p className="mt-1 text-sm text-green-800">
            Cette vérification est terminée.
          </p>
        </div>
      </div>
    );
  }

  const volontaire = status === "CANCELLED";
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex gap-3">
        <IconRefund className="mt-0.5 h-6 w-6 text-blue-700" />
        <div>
          <p className="font-semibold text-blue-900">
            {volontaire
              ? "Numéro annulé — vous avez été remboursé"
              : "Aucun code reçu — vous avez été remboursé"}
          </p>
          <p className="mt-1 text-sm text-blue-800">
            <strong className="tabular-nums">{formatXof(priceXof)}</strong> ont
            été recrédités automatiquement sur votre solde. Vous n&apos;avez
            rien perdu.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <ButtonLink href="/buy" variant="accent" size="lg" className="w-full">
          Réessayer un numéro
        </ButtonLink>
        <ButtonLink href="/wallet" variant="outline" className="w-full">
          Voir mon solde
        </ButtonLink>
      </div>
    </div>
  );
}
