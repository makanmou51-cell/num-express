"use client";

import { useActionState } from "react";
import { Alert, Input, Label } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { SubmitButton } from "@/components/submit-button";
import { resetPasswordAction } from "../actions";
import type { AuthState } from "@/lib/forms";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(
    resetPasswordAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <PasswordField
        label="Nouveau mot de passe"
        autoComplete="new-password"
        showRule
      />
      <SubmitButton size="lg" className="w-full" pendingLabel="Validation…">
        Réinitialiser le mot de passe
      </SubmitButton>
    </form>
  );
}
