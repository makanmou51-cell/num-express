"use client";

import { useActionState, useState } from "react";
import { Alert, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { IconCheck } from "@/components/icons";
import { topupAction } from "@/app/(app)/actions";
import { formatXof } from "@/lib/pricing";
import type { ActionState } from "@/lib/forms";
import { cn } from "@/lib/utils";

const PRESETS = [500, 1000, 2000, 5000, 10000];
const MIN = 200;

/**
 * Formulaire de recharge Mobile Money.
 *
 * Trois défauts corrigés, tous sur le chemin par lequel l'argent entre :
 *
 * 1. Les raccourcis de montant étaient cinq pastilles d'environ 30 px placées
 *    APRÈS les champs — donc après que le client a déjà sorti son clavier pour
 *    taper une somme à la main. Ils passent en tête, en grandes touches.
 * 2. Le bouton de paiement était vert comme tout le reste et disait seulement
 *    « Payer en Mobile Money » : le client partait sur Mobile Money sans avoir
 *    jamais vu le montant écrit sur le bouton qu'il venait de toucher.
 *    Il passe en `accent` (la couleur réservée aux actions qui encaissent) et
 *    affiche la somme exacte.
 * 3. Il restait cliquable sans montant, pour ne renvoyer qu'une erreur rouge
 *    en haut de page. Il est désormais désactivé et le dit.
 */
export function TopupForm() {
  const [amount, setAmount] = useState<number | "">("");
  const [custom, setCustom] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    topupAction,
    undefined,
  );

  const valid = typeof amount === "number" && amount >= MIN;

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <div>
        <p id="topup-amount-label" className="mb-2 block text-sm font-medium">
          Combien voulez-vous recharger&nbsp;?
        </p>
        <div
          role="radiogroup"
          aria-labelledby="topup-amount-label"
          className="grid grid-cols-3 gap-2"
        >
          {PRESETS.map((p) => {
            const on = !custom && amount === p;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setCustom(false);
                  setAmount(p);
                }}
                className={cn(
                  "relative flex min-h-14 items-center justify-center rounded-xl border-2 px-2 text-base font-bold tabular-nums transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-white text-foreground active:bg-gray-100",
                )}
              >
                {on && (
                  <IconCheck className="absolute right-1.5 top-1.5 h-4 w-4" />
                )}
                {p.toLocaleString("fr-FR")}
              </button>
            );
          })}

          <button
            type="button"
            role="radio"
            aria-checked={custom}
            onClick={() => {
              setCustom(true);
              setAmount("");
            }}
            className={cn(
              "flex min-h-14 items-center justify-center rounded-xl border-2 px-2 text-base font-bold transition-colors",
              custom
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-foreground active:bg-gray-100",
            )}
          >
            Autre
          </button>
        </div>
      </div>

      {/* Le champ libre n'apparaît que si on en a besoin : sinon il invite à
          sortir le clavier alors qu'une touche suffit. Il reste dans le DOM
          en `hidden` quand un preset est choisi, pour que la valeur parte
          quand même avec le formulaire. */}
      {custom ? (
        <div>
          <Label htmlFor="amount">Montant en F CFA</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            inputMode="numeric"
            min={MIN}
            step={50}
            required
            autoFocus
            placeholder={`Minimum ${MIN}`}
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </div>
      ) : (
        <input type="hidden" name="amount" value={amount} />
      )}

      <div>
        <Label htmlFor="phone">Numéro Mobile Money (optionnel)</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          data-clarity-mask="true"
          placeholder="Ex : 90 00 00 00"
          autoComplete="tel"
        />
      </div>

      <SubmitButton
        size="lg"
        variant="accent"
        className="w-full"
        disabled={!valid}
        pendingLabel="Ouverture de Mobile Money…"
      >
        {valid ? `Payer ${formatXof(amount)}` : "Choisissez un montant"}
      </SubmitButton>
    </form>
  );
}
