"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { forgotPasswordAction } from "../actions";
import type { ForgotState } from "@/lib/forms";

export function ForgotForm() {
  const [state, formAction] = useActionState<ForgotState, FormData>(
    forgotPasswordAction,
    undefined,
  );

  if (state?.sent) {
    return (
      <Alert variant="success">
        Si un compte existe pour cet e-mail, un lien de réinitialisation vient
        d'être envoyé. Pensez à vérifier vos spams.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <div>
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vous@exemple.com"
        />
      </div>
      <SubmitButton size="lg" className="w-full" pendingLabel="Envoi…">
        Envoyer le lien
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
