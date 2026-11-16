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
// Statut en point coloré + texte discret, au lieu d'une pastille pastel pleine.
// Ton tiré des couleurs sémantiques : ambre = en cours, rouge = échec, gris = clos.
type StatusTone = "warning" | "destructive" | "muted";
const STATUS_TONE: Record<string, StatusTone> = {
  PENDING: "warning",
  FAILED: "destructive",
  CANCELLED: "muted",
};
const STATUS_DOT: Record<StatusTone, string> = {
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-gray-300",
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
                {/* Pastille NEUTRE : chaque type a son propre pictogramme, ça
                    suffit à les distinguer. Le crédit/débit se lit sur le
                    montant (vert/rouge) à droite, pas sur un fond coloré de
                    plus — on évite l'arc-en-ciel de pastilles. */}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-muted">
                  <TxIcon type={t.type} credit={credit} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">
                      {TYPE_LABEL[t.type] ?? t.type}
                    </span>
                    {t.status !== "COMPLETED" && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            STATUS_DOT[STATUS_TONE[t.status] ?? "muted"]
                          }`}
                        />
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-muted">
                    {formatWhen(t.createdAt)}
                  </p>
                </div>
                {/* tabular-nums : les montants s'alignent en colonne au lieu
                    de danser d'une ligne à l'autre. */}
                <Amount
                  value={t.amount}
                  signed
                  className={`shrink-0 text-base font-semibold ${
                    credit ? "text-success" : "text-destructive"
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
