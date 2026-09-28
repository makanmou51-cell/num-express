"use client";

import { useActionState, useState } from "react";
import { Alert, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { IconCheck } from "@/components/icons";
import { topupAction } from "@/app/(app)/actions";
import { formatXof } from "@/lib/pricing";
import type { ActionState } from "@/lib/forms";
import { cn } from "@/lib/utils";

/* Paliers alignés sur ce que le catalogue vend RÉELLEMENT.
   Les anciens (500 · 1 000 · 2 000 · 5 000 · 10 000) avaient un défaut grave :
   trois d'entre eux ne permettaient d'acheter AUCUN numéro, le moins cher
   étant à 2 750 F. Constaté sur les ventes : 36 recharges sur 110 sont
   arrivées sous ce seuil, et 14 des 15 clients qui ont payé sans jamais
   acheter étaient exactement dans ce cas — ils avaient sorti leur argent
   Mobile Money pour un solde inutilisable.
   On garde un petit palier, mais étiqueté : le Boost, lui, démarre à 35 F. */
const PRESETS = [500, 3000, 5000, 10000, 20000];
const MIN = 200;

/** Ce que le montant permet d'acheter, écrit sous la touche. */
function ceQueCaAchete(
  montant: number,
  prix: { min: number; median: number } | null,
): string {
  if (!prix) return "";
  if (montant < prix.min) return "Boost uniquement";
  const n = Math.floor(montant / prix.median);
  if (n < 1) return "1 numéro";
  return `${n} numéro${n > 1 ? "s" : ""}`;
}

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
export function TopupForm({
  prix,
  suggere,
}: {
  /** Fourchette réelle des prix, mesurée sur les ventes. */
  prix: { min: number; median: number } | null;
  /** Montant manquant, transmis depuis l'écran d'achat. */
  suggere?: number;
}) {
  /* Si le client arrive depuis « Il vous manque 3 700 F », la somme est déjà
     là. Avant, elle était perdue : il repartait d'une page vide et devait
     deviner — souvent en reprenant le premier palier, trop petit. */
  const preselection = suggere && PRESETS.includes(suggere) ? suggere : "";
  const [amount, setAmount] = useState<number | "">(suggere ?? "");
  const [custom, setCustom] = useState(Boolean(suggere) && !preselection);
  const [state, formAction] = useActionState<ActionState, FormData>(
    topupAction,
    undefined,
  );

  const valid = typeof amount === "number" && amount >= MIN;

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <div>
        <p id="topup-amount-label" className="block text-sm font-medium">
          Combien voulez-vous recharger&nbsp;?
        </p>
        {/* L'information la plus utile de l'écran, et elle n'y figurait pas :
            le client choisissait un montant sans savoir ce que coûte ce
            qu'il est venu acheter. */}
        {prix && (
          <p className="mb-2 mt-0.5 text-xs text-muted">
            Un numéro coûte entre{" "}
            <strong className="text-foreground">{formatXof(prix.min)}</strong>{" "}
            et{" "}
            <strong className="text-foreground">
              {formatXof(prix.median * 2)}
            </strong>{" "}
            selon le pays. Le Boost démarre à 35 F.
          </p>
        )}
        {!prix && <div className="mb-2" />}
        <div
          role="radiogroup"
          aria-labelledby="topup-amount-label"
          className="grid grid-cols-3 gap-2"
        >
          {PRESETS.map((p) => {
            const on = !custom && amount === p;
            const achete = ceQueCaAchete(p, prix);
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
                  "relative flex min-h-16 flex-col items-center justify-center rounded-xl border-2 px-1 py-2 text-center text-base font-bold tabular-nums transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-white text-foreground active:bg-gray-100",
                )}
              >
                {on && (
                  <IconCheck className="absolute right-1.5 top-1.5 h-4 w-4" />
                )}
                <span className="block">{p.toLocaleString("fr-FR")}</span>
                {/* La ligne qui manquait : le client venait d'une publicité
                    sur les numéros et n'avait aucun moyen de savoir que son
                    montant n'en achetait aucun. */}
                {achete && (
                  <span
                    className={cn(
                      "mt-0.5 block text-[10px] font-medium leading-tight",
                      on ? "text-primary-foreground/80" : "text-muted",
                    )}
                  >
                    {achete}
                  </span>
                )}
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
              "flex min-h-16 items-center justify-center rounded-xl border-2 px-1 text-base font-bold transition-colors",
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
            // Pas de focus auto quand la somme est déjà pré-remplie : faire
            // surgir le clavier sur un champ correct est une gêne.
            autoFocus={!suggere}
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
