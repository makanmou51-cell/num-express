"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { simulateTopupAction } from "@/app/(app)/actions";
import type { ActionState } from "@/lib/forms";

export function SimulateButton({ txId }: { txId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(
    simulateTopupAction,
    undefined,
  );

  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => router.push("/wallet"), 1200);
      return () => clearTimeout(t);
    }
  }, [state?.success, router]);

  return (
    <div className="space-y-3">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <form action={formAction}>
        <input type="hidden" name="tx" value={txId} />
        <SubmitButton size="lg" className="w-full" pendingLabel="Validation…">
          Confirmer le paiement (simulation)
        </SubmitButton>
      </form>
    </div>
  );
}
