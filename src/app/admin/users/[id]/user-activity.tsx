"use client";

import { useMemo, useState } from "react";
import { RentalRefundButton } from "./rental-refund-button";
import { Card } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { ServiceIcon } from "@/components/service-icon";
import { formatXof } from "@/lib/pricing";
import { formatWhen } from "@/lib/datetime";

export type AdminTx = {
  id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
  activationId: string | null;
};

export type AdminAct = {
  id: string;
  serviceCode: string;
  serviceName: string | null;
  countryName: string | null;
  countryCode: string;
  status: string;
  smsCode: string | null;
  priceXof: number;
  createdAt: string;
  /* Les LOCATIONS entrent dans la meme liste que les activations.
     Elles vivaient dans un encadre separe tout en haut de la fiche, si bien
     que le compteur annoncait « Toutes 6 » pour un client qui avait pris 7
     numeros : en balayant la fiche, on passait a cote d'une location a
     6 900 F. Un client ne distingue pas les deux, l'admin non plus. */
  kind?: "activation" | "rental";
  phoneNumber?: string | null;
  durationLabel?: string | null;
};

// Activations « bruit » (échecs WhatsApp typiques) : à masquer par défaut.
const ACT_NOISE = new Set(["CANCELLED", "REFUNDED", "EXPIRED"]);
const ACT_SUCCESS = new Set(["RECEIVED", "COMPLETED"]);

const TYPE_LABEL: Record<string, string> = {
  TOPUP: "Recharge",
  PURCHASE: "Achat",
  REFUND: "Remboursement",
  ADJUSTMENT: "Ajustement",
};

export function UserActivity({
  transactions,
  activations,
}: {
  transactions: AdminTx[];
  activations: AdminAct[];
}) {
  /* ─────────── Activations ─────────── */
  const [actTab, setActTab] = useState<"clean" | "all">("clean");
  const actCounts = useMemo(() => {
    let success = 0;
    let pending = 0;
    let noise = 0;
    for (const a of activations) {
      if (ACT_SUCCESS.has(a.status)) success++;
      else if (ACT_NOISE.has(a.status)) noise++;
      else pending++;
    }
    return { success, pending, noise };
  }, [activations]);
  const actList =
    actTab === "all"
      ? activations
      : activations.filter((a) => !ACT_NOISE.has(a.status));

  /* ─────────── Transactions ─────────── */
  const [txTab, setTxTab] = useState<"clean" | "all">("clean");
  // Une activation remboursée génère une paire ACHAT + REMBOURSEMENT qui
  // s'annulent : on repère ces paires par activationId pour les masquer.
  const refundedActIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of transactions) {
      if (t.type === "REFUND" && t.activationId) s.add(t.activationId);
    }
    return s;
  }, [transactions]);
  const isNoiseTx = (t: AdminTx) =>
    (t.type === "REFUND" || t.type === "PURCHASE") &&
    t.activationId !== null &&
    refundedActIds.has(t.activationId);
  const txList =
    txTab === "all" ? transactions : transactions.filter((t) => !isNoiseTx(t));
  const autoRefundCount = transactions.filter(
    (t) => t.type === "REFUND",
  ).length;
  // UNIQUEMENT les recharges réellement encaissées : une recharge PENDING est
  // un panier ouvert et jamais payé — la compter gonflait le total affiché.
  const toppedUp = transactions
    .filter(
      (t) => t.type === "TOPUP" && t.amount > 0 && t.status === "COMPLETED",
    )
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Transactions ── */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Transactions</h2>
          <Tabs
            value={txTab}
            onChange={(v) => setTxTab(v)}
            tabs={[
              { key: "clean", label: "Réelles" },
              { key: "all", label: "Toutes", count: transactions.length },
            ]}
          />
        </div>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Chip label="Rechargé" value={formatXof(toppedUp)} tone="green" />
          <Chip
            label="Remb. auto"
            value={String(autoRefundCount)}
            tone="gray"
          />
        </div>
        {txList.length === 0 ? (
          <Empty label="Aucune transaction réelle." />
        ) : (
          <ul className="divide-y">
            {txList.map((t) => {
              const credit = t.amount >= 0;
              return (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      credit
                        ? "bg-green-100 text-green-700"
                        : "bg-rose-100 text-rose-600"
                    }`}
                    aria-hidden
                  >
                    {credit ? "+" : "−"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {TYPE_LABEL[t.type] ?? t.type}
                    </p>
                    <p className="text-xs text-muted">
                      {formatWhen(t.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      credit ? "text-green-700" : "text-rose-600"
                    }`}
                  >
                    {credit ? "+" : "−"}
                    {formatXof(Math.abs(t.amount))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ── Activations ── */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Numéros</h2>
          <Tabs
            value={actTab}
            onChange={(v) => setActTab(v)}
            tabs={[
              { key: "clean", label: "Actives" },
              { key: "all", label: "Toutes", count: activations.length },
            ]}
          />
        </div>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Chip
            label="Réussies"
            value={String(actCounts.success)}
            tone="green"
          />
          <Chip
            label="En cours"
            value={String(actCounts.pending)}
            tone="amber"
          />
          <Chip label="Annulées" value={String(actCounts.noise)} tone="gray" />
        </div>
        {actList.length === 0 ? (
          <Empty
            label={
              actTab === "clean"
                ? "Aucune activation active."
                : "Aucune activation."
            }
          />
        ) : (
          <ul className="divide-y">
            {actList.map((a) => {
              const received = ACT_SUCCESS.has(a.status) && a.smsCode;
              return (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <ServiceIcon
                    code={a.serviceCode}
                    className="h-9 w-9 shrink-0 text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {a.serviceName ?? a.serviceCode}{" "}
                      <span className="text-muted">
                        · {a.countryName ?? a.countryCode}
                      </span>
                      {a.kind === "rental" && (
                        <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          Location
                          {a.durationLabel ? ` · ${a.durationLabel}` : ""}
                        </span>
                      )}
                    </p>
                    {a.phoneNumber && (
                      <p
                        data-clarity-mask="true"
                        className="truncate font-mono text-xs text-muted"
                      >
                        +{a.phoneNumber}
                      </p>
                    )}
                    {received ? (
                      <p className="text-xs">
                        <span className="text-muted">Code : </span>
                        <span className="font-mono font-semibold tracking-wider text-primary">
                          {a.smsCode}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted">
                        {formatWhen(a.createdAt)} · {formatXof(a.priceXof)}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={a.status} />
                  {/* L'action de remboursement suit la location dans la liste,
                      au lieu de vivre dans un encadre a part. */}
                  {a.kind === "rental" && a.status === "ACTIVE" && (
                    <RentalRefundButton id={a.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ───────────────────────── Sous-composants ───────────────────────── */

function Tabs({
  value,
  onChange,
  tabs,
}: {
  value: "clean" | "all";
  onChange: (v: "clean" | "all") => void;
  tabs: { key: "clean" | "all"; label: string; count?: number }[];
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === t.key
              ? "bg-white text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="ml-1 opacity-60">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "gray";
}) {
  const cls = {
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-800",
    gray: "bg-gray-100 text-gray-600",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium ${cls}`}
    >
      {label} <strong>{value}</strong>
    </span>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted">
      {label}
    </p>
  );
}
