"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { buyAccountAction, type AccountActionState } from "./actions";
import { formatXof } from "@/lib/pricing";

/**
 * Achat d'un compte : quantité (bornée au stock, 10 max par commande) +
 * bouton dont le libellé porte le total — le client voit ce qu'il va payer
 * AU moment du clic, pas après.
 */
export function AccountBuyForm({
  productId,
  unitPriceXof,
  stock,
}: {
  productId: number;
  unitPriceXof: number;
  stock: number;
}) {
  const max = Math.max(1, Math.min(10, stock));
  const [qty, setQty] = useState(1);
  const [state, formAction] = useActionState<AccountActionState, FormData>(
    buyAccountAction,
    undefined,
  );

  return (
    <form action={formAction} className="mt-3 space-y-2">
      {state && "error" in state && <Alert variant="error">{state.error}</Alert>}
      {state && "success" in state && (
        <Alert variant="success">
          Acheté ! Tes identifiants sont dans « Mes commandes de comptes »,
          plus bas sur cette page.
        </Alert>
      )}
      <input type="hidden" name="product" value={productId} />
      <div className="flex items-center gap-2">
        <select
          name="quantity"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          aria-label="Quantité"
          className="rounded-lg border border-border bg-white px-2 py-2 text-sm"
        >
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              ×{n}
            </option>
          ))}
        </select>
        <SubmitButton size="sm" className="flex-1" pendingLabel="Achat…">
          Acheter · {formatXof(unitPriceXof * qty)}
        </SubmitButton>
      </div>
    </form>
  );
}
