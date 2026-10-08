"use client";

import { useMemo, useState } from "react";
import { Amount, Segmented } from "@/components/ui";
import { formatWhen } from "@/lib/datetime";
import {
  IconAdjust,
  IconCart,
  IconRefund,
  IconTopup,
} from "@/components/icons";

export type WTx = {
  id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
  activationId: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  TOPUP: "Recharge",
  PURCHASE: "Achat",
  REFUND: "Remboursement",
  ADJUSTMENT: "Ajustement",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  COMPLETED: "Validé",
  FAILED: "Échoué",
  CANCELLED: "Annulé",
};
const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-200 text-gray-600",
};

/** Une couleur par nature d'opération, pas seulement crédit/débit. */
const TYPE_TONE: Record<string, string> = {
  TOPUP: "bg-green-100 text-green-700",
  PURCHASE: "bg-slate-100 text-slate-600",
  REFUND: "bg-blue-100 text-blue-700",
  ADJUSTMENT: "bg-amber-100 text-amber-800",
};

function TxIcon({ type, credit }: { type: string; credit: boolean }) {
  const cls = "h-5 w-5";
  if (type === "TOPUP") return <IconTopup className={cls} />;
  if (type === "PURCHASE") return <IconCart className={cls} />;
  if (type === "REFUND") return <IconRefund className={cls} />;
  if (type === "ADJUSTMENT") return <IconAdjust className={cls} />;
  return credit ? <IconTopup className={cls} /> : <IconCart className={cls} />;
}

export function WalletHistory({ transactions }: { transactions: WTx[] }) {
  const [tab, setTab] = useState<"clean" | "all">("clean");
  // Paires achat + remboursement (numéro échoué) qui s'annulent : repérées par
  // activationId pour être masquées dans la vue « Réelles ».
  const refundedActIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of transactions) {
      if (t.type === "REFUND" && t.activationId) s.add(t.activationId);
    }
    return s;
  }, [transactions]);
  const isNoise = (t: WTx) =>
    (t.type === "REFUND" || t.type === "PURCHASE") &&
    t.activationId !== null &&
    refundedActIds.has(t.activationId);
  const hasNoise = transactions.some(isNoise);
  const list = tab === "all" ? transactions : transactions.filter((t) => !isNoise(t));

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Historique</h2>
        {hasNoise && (
          <Segmented
            ariaLabel="Filtrer l'historique"
            value={tab}
            onChange={(v) => setTab(v as "clean" | "all")}
            options={[
              { value: "clean", label: "Réelles" },
              { value: "all", label: "Toutes" },
            ]}
          />
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted">Aucune transaction pour l'instant.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {list.map((t) => {
            const credit = t.amount >= 0;
            const faded = t.status === "FAILED" || t.status === "CANCELLED";
            return (
              <li
                key={t.id}
                className={`flex items-center gap-3 py-3 ${faded ? "opacity-60" : ""}`}
              >
                {/* Avant : un « + » ou un « − » dans une pastille, identique
                    pour une recharge, un achat et un remboursement — trois
                    opérations très différentes qui se ressemblaient. Chaque
                    type a maintenant son propre pictogramme. */}
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    TYPE_TONE[t.type] ??
                    (credit
                      ? "bg-green-100 text-green-700"
                      : "bg-rose-100 text-rose-600")
                  }`}
                >
                  <TxIcon type={t.type} credit={credit} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">
                      {TYPE_LABEL[t.type] ?? t.type}
                    </span>
                    {t.status !== "COMPLETED" && (
                      /* 10px était sous le seuil de lisibilité : « En attente »
                         est justement la mention qu'il faut pouvoir lire. */
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          STATUS_CLASS[t.status] ?? "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatWhen(t.createdAt)}
                  </p>
                </div>
                {/* tabular-nums : les montants s'alignent en colonne au lieu
                    de danser d'une ligne à l'autre. */}
                <Amount
                  value={t.amount}
                  signed
                  className={`shrink-0 text-base font-bold ${
                    credit ? "text-green-700" : "text-rose-600"
                  }`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
