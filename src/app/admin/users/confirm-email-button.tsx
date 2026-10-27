"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { confirmEmailAction } from "../actions";
import type { ActionState } from "@/lib/forms";

/**
 * Confirmation manuelle de l'e-mail d'un client (liste admin + fiche client).
 *
 * Au succès, revalidatePath rafraîchit la page : le badge « non vérifié » et
 * ce bouton disparaissent — c'est la confirmation visuelle. Seule une erreur
 * reste affichée en texte.
 */
export function ConfirmEmailButton({ userId }: { userId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    confirmEmailAction,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton variant="outline" size="sm" pendingLabel="…">
        Confirmer
      </SubmitButton>
      {state?.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}
