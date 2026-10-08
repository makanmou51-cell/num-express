"use client";

import { useActionState } from "react";
import { Alert, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  adjustBalanceAction,
  setRoleAction,
  sendUserEmailAction,
} from "../../actions";
import type { ActionState } from "@/lib/forms";

export function EmailForm({
  userId,
  defaultSubject = "",
  defaultBody = "",
}: {
  userId: string;
  defaultSubject?: string;
  defaultBody?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    sendUserEmailAction,
    undefined,
  );
  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <input type="hidden" name="userId" value={userId} />
      <div>
        <Label htmlFor="subject">Objet</Label>
        <Input
          id="subject"
          name="subject"
          required
          defaultValue={defaultSubject}
          placeholder="Objet de l'e-mail"
        />
      </div>
      <div>
        <Label htmlFor="body">Message</Label>
        <textarea
          id="body"
          name="body"
          required
          rows={7}
          defaultValue={defaultBody}
          placeholder="Votre message… (« {nom} » sera remplacé par le prénom du client)"
          className="w-full rounded-xl border border-border bg-white p-3 text-sm transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <SubmitButton pendingLabel="Envoi…">Envoyer l&apos;e-mail</SubmitButton>
    </form>
  );
}

export function AdjustBalanceForm({ userId }: { userId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    adjustBalanceAction,
    undefined,
  );
  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <input type="hidden" name="userId" value={userId} />
      <div>
        <Label htmlFor="amount">Montant (F CFA, négatif pour débiter)</Label>
        <Input id="amount" name="amount" type="number" step={50} required placeholder="Ex : 2000 ou -500" />
      </div>
      <div>
        <Label htmlFor="reason">Motif</Label>
        <Input id="reason" name="reason" placeholder="Recharge Mobile Money reçue…" />
      </div>
      <SubmitButton pendingLabel="…">Appliquer</SubmitButton>
    </form>
  );
}

export function RoleForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    setRoleAction,
    undefined,
  );
  const nextRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
  return (
    <form action={formAction} className="space-y-2">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={nextRole} />
      <SubmitButton variant={nextRole === "ADMIN" ? "primary" : "danger"} pendingLabel="…">
        {nextRole === "ADMIN" ? "Promouvoir administrateur" : "Retirer le rôle admin"}
      </SubmitButton>
    </form>
  );
}
