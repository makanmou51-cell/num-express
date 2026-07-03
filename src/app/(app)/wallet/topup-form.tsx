"use client";

import { useActionState, useState } from "react";
import { Alert, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { topupAction } from "@/app/(app)/actions";
import type { ActionState } from "@/lib/forms";
import { cn } from "@/lib/utils";

const PRESETS = [500, 1000, 2000, 5000, 10000];

export function TopupForm() {
  const [amount, setAmount] = useState<number | "">("");
  const [state, formAction] = useActionState<ActionState, FormData>(
    topupAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <div>
        <Label htmlFor="amount">Montant (F CFA)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          inputMode="numeric"
          min={200}
          step={50}
          required
          placeholder="Ex : 2000"
          value={amount}
          onChange={(e) =>
            setAmount(e.target.value === "" ? "" : Number(e.target.value))
          }
        />
      </div>

      <div>
        <Label htmlFor="phone">Numéro Mobile Money (optionnel)</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="Ex : 90 00 00 00"
          autoComplete="tel"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              amount === p
                ? "border-primary bg-primary/10 text-primary"
                : "hover:bg-gray-50",
            )}
          >
            {p.toLocaleString("fr-FR")}
          </button>
        ))}
      </div>

      <SubmitButton size="lg" className="w-full" pendingLabel="Redirection…">
        Payer en Mobile Money
      </SubmitButton>
    </form>
  );
}
