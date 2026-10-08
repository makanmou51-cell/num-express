"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { IconWarnCircle } from "@/components/icons";
import { resendVerificationAction } from "@/app/(app)/actions";
import type { ActionState } from "@/lib/forms";

/**
 * Bannière « e-mail non vérifié ».
 *
 * Elle disait seulement « Pensez à confirmer votre compte » — sans jamais dire
 * la seule chose qui compte : **l'achat est bloqué tant que ce n'est pas fait**.
 * Un client qui venait de recharger son solde se retrouvait donc à ne pas
 * pouvoir commander sans comprendre pourquoi, et écrivait au support.
 *
 * Elle dit maintenant le blocage, rappelle l'adresse concernée, et oriente vers
 * les spams — première cause d'e-mail « jamais reçu » chez Gmail.
 */
export function VerifyBanner({
  email,
  blocking = false,
}: {
  email?: string;
  /** true quand la vérification empêche réellement d'acheter. */
  blocking?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resendVerificationAction,
    undefined,
  );

  const sent = Boolean(state?.success);

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex gap-3">
        <IconWarnCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {sent
              ? "E-mail renvoyé"
              : blocking
                ? "Confirmez votre e-mail pour pouvoir acheter"
                : "Votre adresse e-mail n'est pas encore confirmée"}
          </p>

          {state?.error ? (
            <p className="mt-1">{state.error}</p>
          ) : sent ? (
            <p className="mt-1">
              Un nouveau lien vient d&apos;être envoyé
              {email ? (
                <>
                  {" "}
                  à <strong className="break-all">{email}</strong>
                </>
              ) : null}
              . Regardez aussi dans vos{" "}
              <strong>spams</strong> et dans l&apos;onglet{" "}
              <strong>Promotions</strong>.
            </p>
          ) : (
            <p className="mt-1">
              Nous avons envoyé un lien de confirmation
              {email ? (
                <>
                  {" "}
                  à <strong className="break-all">{email}</strong>
                </>
              ) : null}
              . Il n&apos;est pas arrivé&nbsp;? Regardez dans vos{" "}
              <strong>spams</strong> ou l&apos;onglet{" "}
              <strong>Promotions</strong>, puis renvoyez-le.
            </p>
          )}

          {!sent && (
            <form action={formAction} className="mt-3">
              <Button
                type="submit"
                variant="accent"
                className="w-full sm:w-auto"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden="true"
                    />
                    Envoi…
                  </>
                ) : (
                  "Renvoyer l'e-mail de confirmation"
                )}
              </Button>
            </form>
          )}

          {sent && (
            <p className="mt-2 text-xs text-amber-900/80">
              Toujours rien après quelques minutes&nbsp;? Écrivez-nous par le
              chat, en bas à droite — on confirme votre compte à la main.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
