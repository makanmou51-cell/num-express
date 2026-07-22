"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { StatusBadge } from "@/components/status-badge";
import {
  cancelActivationAction,
  deliverDemoCodeAction,
  requestNewCodeAction,
} from "@/app/(app)/actions";
import type { ActionState } from "@/lib/forms";

const TERMINAL = ["RECEIVED", "COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"];

type Activation = {
  id: string;
  status: string;
  smsCode: string | null;
  phoneNumber: string;
  expiresAt: string | null;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copié ✓" : label}
    </Button>
  );
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
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [isTerminal, poll, router]);

  // Compte à rebours indicatif.
  const [remaining, setRemaining] = useState<string | null>(null);
  useEffect(() => {
    if (!activation.expiresAt || isTerminal) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const ms = new Date(activation.expiresAt!).getTime() - Date.now();
      if (ms <= 0) return setRemaining("expiré");
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRemaining(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [activation.expiresAt, isTerminal]);

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <StatusBadge status={activation.status} />
        {remaining && (
          <span className="text-sm text-muted">Expire dans {remaining}</span>
        )}
      </div>

      {/* Numéro */}
      <div>
        <p className="text-sm text-muted">Numéro de téléphone</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="font-mono text-xl font-semibold">
            +{activation.phoneNumber}
          </span>
          <CopyButton value={activation.phoneNumber} label="Copier" />
        </div>
      </div>

      {/* Code SMS */}
      {activation.smsCode ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700">Code de vérification reçu</p>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-mono text-3xl font-bold tracking-widest text-green-800">
              {activation.smsCode}
            </span>
            <CopyButton value={activation.smsCode} label="Copier le code" />
          </div>
        </div>
      ) : !isTerminal ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border bg-gray-50 p-4">
            <span className="h-3 w-3 animate-pulse rounded-full bg-amber-500" />
            <p className="text-sm text-muted">
              En attente du SMS… Saisissez ce numéro sur le service ; le code
              s'affichera ici automatiquement.
            </p>
          </div>

          {/* Démo : le code n'arrive qu'après une action explicite. */}
          {isMock && (
            <form action={deliverAction}>
              <input type="hidden" name="id" value={activation.id} />
              <SubmitButton size="sm" variant="outline" pendingLabel="Réception…">
                📲 J&apos;ai utilisé le numéro — recevoir le SMS (démo)
              </SubmitButton>
              {deliverState?.error && (
                <p className="mt-2 text-sm text-red-600">{deliverState.error}</p>
              )}
            </form>
          )}
        </div>
      ) : null}

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
            Le SMS tarde ? Demandez un nouveau code — c'est gratuit et vous
            gardez le même numéro.
          </p>
        </form>
      )}

      {/* Annulation (uniquement en attente) */}
      {activation.status === "WAITING_CODE" && (
        <form action={formAction} className="pt-2">
          <input type="hidden" name="id" value={activation.id} />
          <SubmitButton variant="danger" size="sm" pendingLabel="Annulation…">
            Annuler &amp; être remboursé
          </SubmitButton>
          <p className="mt-2 text-xs text-muted">
            L'annulation est possible après 2 minutes si aucun code n'est arrivé.
          </p>
        </form>
      )}
    </Card>
  );
}
