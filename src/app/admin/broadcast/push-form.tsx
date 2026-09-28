"use client";

import { useActionState } from "react";
import { Alert, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { sendPushBroadcastAction } from "./actions";
import type { ActionState } from "@/lib/forms";

/**
 * Diffusion d'une notification navigateur à tous les abonnés.
 *
 * Contrairement à l'e-mail, elle arrive même quand le site est fermé — c'est
 * ce que font les concurrents pour annoncer leurs nouveaux stocks.
 *
 * À manier avec retenue : une notification de trop et le client désactive
 * l'autorisation. Elle ne se redemande pas — c'est définitif.
 */
export function PushBroadcastForm({ subscribers }: { subscribers: number }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    sendPushBroadcastAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      <p className="text-sm text-muted">
        <strong className="tabular-nums text-foreground">{subscribers}</strong>{" "}
        {subscribers > 1 ? "appareils abonnés" : "appareil abonné"} recevront
        cette notification.
      </p>

      <div>
        <Label htmlFor="ptitle">Titre</Label>
        <Input
          id="ptitle"
          name="title"
          required
          maxLength={60}
          placeholder="Nouveaux numéros disponibles"
        />
        <p className="mt-1 text-xs text-muted">
          60 caractères maximum — au-delà, Android le coupe.
        </p>
      </div>

      <div>
        <Label htmlFor="pbody">Message</Label>
        <Input
          id="pbody"
          name="body"
          required
          maxLength={140}
          placeholder="501 nouveaux numéros WhatsApp pour le Royaume-Uni et le Portugal."
        />
      </div>

      <div>
        <Label htmlFor="purl">Page ouverte au clic</Label>
        <Input id="purl" name="url" defaultValue="/buy" placeholder="/buy" />
      </div>

      <SubmitButton
        variant="accent"
        size="lg"
        className="w-full"
        disabled={subscribers === 0}
        pendingLabel="Envoi en cours…"
      >
        {subscribers === 0
          ? "Aucun abonné pour l'instant"
          : `Envoyer à ${subscribers} appareil${subscribers > 1 ? "s" : ""}`}
      </SubmitButton>
    </form>
  );
}
