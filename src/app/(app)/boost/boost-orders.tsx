"use client";

import { useMemo, useState } from "react";
import { StatusDot } from "@/components/status-badge";
import { formatXof } from "@/lib/pricing";
import { formatWhen } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export type BoostOrderRow = {
  id: string;
  serviceLabel: string;
  quantity: number;
  priceXof: number;
  status: string;
  createdAt: string;
  startCount: number | null;
  remains: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  PROCESSING: "En traitement",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  PARTIAL: "Partiel",
  CANCELED: "Annulé",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
};
type Tone = "success" | "warning" | "muted" | "destructive";
const STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  PROCESSING: "warning",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  PARTIAL: "warning",
  CANCELED: "muted",
  FAILED: "destructive",
  REFUNDED: "muted",
};
const LIVE = new Set(["PROCESSING", "IN_PROGRESS"]);
// Ordre d'affichage des filtres (seuls ceux présents sont montrés).
const ORDER = [
  "PENDING",
  "PROCESSING",
  "IN_PROGRESS",
  "COMPLETED",
  "PARTIAL",
  "CANCELED",
  "FAILED",
  "REFUNDED",
];

export function BoostOrders({ orders }: { orders: BoostOrderRow[] }) {
  const [filter, setFilter] = useState<string>("all");

  // Filtres : « Tout » + un onglet par statut réellement présent.
  const present = useMemo(() => {
    const set = new Set(orders.map((o) => o.status));
    return ORDER.filter((s) => set.has(s));
  }, [orders]);

  const list = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted">
        Aucune commande pour l&apos;instant.
      </p>
    );
  }

  return (
    <div>
      {present.length > 0 && (
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ v: "all", label: "Tout" }, ...present.map((s) => ({ v: s, label: STATUS_LABEL[s] ?? s }))].map(
            (c) => {
              const on = filter === c.v;
              return (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setFilter(c.v)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-white text-muted active:bg-gray-100",
                  )}
                >
                  {c.label}
                </button>
              );
            },
          )}
        </div>
      )}

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted">
          Aucune commande dans ce filtre.
        </p>
      ) : (
        <ul className="divide-y">
          {list.map((o) => {
            const delivered =
              o.startCount != null && o.remains != null
                ? Math.max(0, o.quantity - o.remains)
                : null;
            return (
              <li key={o.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.serviceLabel}</p>
                  <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-muted">
                    {o.quantity.toLocaleString("fr-FR")} · {formatWhen(o.createdAt)} ·{" "}
                    {formatXof(o.priceXof)}
                    {delivered != null && o.status !== "COMPLETED"
                      ? ` · livré ${delivered.toLocaleString("fr-FR")}/${o.quantity.toLocaleString("fr-FR")}`
                      : ""}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">
                  <StatusDot
                    tone={STATUS_TONE[o.status] ?? "muted"}
                    pulse={LIVE.has(o.status)}
                  />
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
