"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { refillBoostAction } from "./actions";
import type { ActionState } from "@/lib/forms";

export function RefillButton({ id }: { id: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    refillBoostAction,
    undefined,
  );
  return (
    <form action={action} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="outline" pendingLabel="…">
        ♻️ Refill
      </SubmitButton>
      {state?.error && (
        <span className="max-w-[160px] text-right text-[10px] leading-tight text-red-600">
          {state.error}
        </span>
      )}
      {state?.success && (
        <span className="text-[10px] font-semibold text-green-600">
          ✓ Refill lancé
        </span>
      )}
    </form>
  );
}
