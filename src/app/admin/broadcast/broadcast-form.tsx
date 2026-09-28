"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, Input, Label } from "@/components/ui";
import { sendBroadcastAction, type BroadcastState } from "./actions";

function SubmitButton({ count, quota }: { count: number; quota: number }) {
  const { pending } = useFormStatus();
  const premierLot = Math.min(count, quota);
  return (
    <Button type="submit" size="lg" disabled={pending || quota <= 0}>
      {pending
        ? "Envoi du premier lot…"
        : quota <= 0
          ? "Quota du jour atteint — réessaie demain"
          : `Lancer la diffusion (${premierLot} maintenant, ${count} au total)`}
    </Button>
  );
}

export function BroadcastForm({
  recipientCount,
  quotaRestant,
}: {
  recipientCount: number;
  /** E-mails encore autorisés aujourd'hui par le quota du fournisseur. */
  quotaRestant: number;
}) {
  const [state, formAction] = useActionState<BroadcastState, FormData>(
    sendBroadcastAction,
    undefined,
  );

  const jours = Math.ceil(recipientCount / Math.max(1, quotaRestant || 80));

  return (
    <form action={formAction} className="space-y-4">
      {state && "error" in state && (
        <Alert variant="error">{state.error}</Alert>
      )}

      <div>
        <Label htmlFor="subject">Sujet</Label>
        <Input
          id="subject"
          name="subject"
          required
          maxLength={120}
          placeholder="Ex. Reçois tes codes en 30 secondes (sujet sobre = moins de spam)"
        />
      </div>

      <div>
        <Label htmlFor="body">Message</Label>
        <textarea
          id="body"
          name="body"
          required
          rows={8}
          maxLength={4000}
          placeholder={
            "Bonjour {nom},\n\nÉcrivez ici votre message… (les sauts de ligne sont conservés)"
          }
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1.5 text-xs text-muted">
          Astuce : écrivez{" "}
          <code className="rounded bg-gray-100 px-1">{"{nom}"}</code> — il sera
          remplacé par le <strong>prénom</strong> de chaque client (ex. «
          Bonjour Rachidou, »). Un e-mail personnel et sobre a plus de chances
          d&apos;arriver dans la boîte <strong>Principale</strong>.
        </p>
      </div>

      <SubmitButton count={recipientCount} quota={quotaRestant} />

      <p className="text-xs text-muted">
        L&apos;envoi se fait <strong>par lots</strong> : {quotaRestant || 80}{" "}
        e-mails maintenant, puis la suite chaque jour automatiquement — environ{" "}
        <strong>
          {jours} jour{jours > 1 ? "s" : ""}
        </strong>{" "}
        pour les {recipientCount} clients. Personne ne reçoit deux fois le même
        message.
      </p>
    </form>
  );
}
