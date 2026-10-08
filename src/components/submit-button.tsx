"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/**
 * Bouton de soumission qui se désactive et s'annonce pendant le traitement.
 *
 * Il ne changeait que son libellé : sur un réseau lent, un texte qui passe de
 * « Acheter » à « Achat… » se remarque à peine et le client rappuie. On ajoute
 * un disque qui tourne — le seul mouvement de l'écran à ce moment-là, donc
 * impossible à rater. Il est neutralisé par le bloc `prefers-reduced-motion`
 * global de globals.css.
 *
 * Ce composant est utilisé par TOUS les formulaires du site (achat, location,
 * recharge, annulation) : la correction vaut partout d'un coup.
 */
export function SubmitButton({
  children,
  pendingLabel = "…",
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    /* `disabled` est combiné, jamais écrasé : avec un simple `{...props}`
       après `disabled={pending}`, un appelant passant `disabled={false}`
       réactivait le bouton PENDANT l'envoi — donc double soumission, donc
       double paiement. */
    <Button
      type="submit"
      {...props}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
