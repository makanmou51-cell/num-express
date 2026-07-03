"use client";

import { useActionState } from "react";
import { Alert, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { updateSettingsAction } from "../actions";
import type { AppSettings } from "@/lib/settings";
import type { ActionState } from "@/lib/forms";

const FIELDS: { key: keyof AppSettings; label: string; step: string; hint: string }[] = [
  { key: "fxToXof", label: "Taux devise → F CFA", step: "0.01", hint: "1 USD = X F CFA. Ex : 620" },
  { key: "tier1MaxXof", label: "Tranche 1 — coût max (F CFA)", step: "50", hint: "Coût < ce seuil. Ex : 1000" },
  { key: "tier1ProfitXof", label: "Tranche 1 — bénéfice (F CFA)", step: "100", hint: "Ex : 4000" },
  { key: "tier2MaxXof", label: "Tranche 2 — coût max (F CFA)", step: "50", hint: "Coût jusqu'à ce seuil. Ex : 7000" },
  { key: "tier2ProfitXof", label: "Tranche 2 — bénéfice (F CFA)", step: "100", hint: "Ex : 4000" },
  { key: "tier3ProfitXof", label: "Tranche 3 — bénéfice (coût au-delà)", step: "100", hint: "Coût > seuil 2. Ex : 4000" },
  { key: "roundToXof", label: "Arrondi (F CFA)", step: "10", hint: "Ex : 50" },
  { key: "minPriceXof", label: "Prix minimum (F CFA)", step: "10", hint: "Ex : 300" },
  { key: "commissionRate", label: "Commission parrainage (0–1)", step: "0.01", hint: "Ex : 0.10 = 10%" },
];

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateSettingsAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              name={f.key}
              type="number"
              step={f.step}
              min={0}
              defaultValue={settings[f.key]}
            />
            <p className="mt-1 text-xs text-muted">{f.hint}</p>
          </div>
        ))}
      </div>
      <SubmitButton size="lg" pendingLabel="Enregistrement…">
        Enregistrer les réglages
      </SubmitButton>
    </form>
  );
}
