"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { resendVerificationAction } from "@/app/(app)/actions";
import type { ActionState } from "@/lib/forms";

export function VerifyBanner() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resendVerificationAction,
    undefined,
  );

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {state?.success
          ? state.success
          : state?.error
            ? state.error
            : "Votre adresse e-mail n'est pas encore vérifiée. Pensez à confirmer votre compte."}
      </span>
      {!state?.success && (
        <form action={formAction}>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Envoi…" : "Renvoyer l'e-mail"}
          </Button>
        </form>
      )}
    </div>
  );
}
