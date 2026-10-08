"use client";

import { useMemo, useState } from "react";
import { formatXof } from "@/lib/pricing";

type Point = { at: string; amount: number };
type Gran = "day" | "week" | "month";

interface Bucket {
  key: string;
  label: string; // court, pour l'axe
  full: string; // complet, pour l'infobulle
  start: number;
  end: number;
  total: number;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const DAY = 86_400_000;

function buildBuckets(points: Point[], gran: Gran): Bucket[] {
  const now = new Date();
  const buckets: Bucket[] = [];

  if (gran === "day") {
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(now);
      d.setDate(d.getDate() - i);
      const start = d.getTime();
      buckets.push({
        key: `d${start}`,
        label: d.toLocaleDateString("fr-FR", { day: "2-digit" }),
        full: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" }),
        start,
        end: start + DAY,
        total: 0,
      });
    }
  } else if (gran === "week") {
    const tomorrow = startOfDay(now).getTime() + DAY;
    for (let i = 11; i >= 0; i--) {
      const end = tomorrow - i * 7 * DAY;
      const start = end - 7 * DAY;
      const sd = new Date(start);
      buckets.push({
        key: `w${start}`,
        label: sd.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        full: `Semaine du ${sd.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}`,
        start,
        end,
        total: 0,
      });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      buckets.push({
        key: `m${d.getTime()}`,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        full: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        start: d.getTime(),
        end: end.getTime(),
        total: 0,
      });
    }
  }

  for (const p of points) {
    const t = new Date(p.at).getTime();
    for (const b of buckets) {
      if (t >= b.start && t < b.end) {
        b.total += p.amount;
        break;
      }
    }
  }
  return buckets;
}

const TABS: { key: Gran; label: string }[] = [
  { key: "day", label: "Jour" },
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
];

export function SalesChart({ topups }: { topups: Point[] }) {
  const [gran, setGran] = useState<Gran>("day");
  const [hover, setHover] = useState<number | null>(null);

  const buckets = useMemo(() => buildBuckets(topups, gran), [topups, gran]);
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const total = buckets.reduce((s, b) => s + b.total, 0);
  const step = Math.ceil(buckets.length / 8);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Ventes (recharges encaissées)</h2>
          <p className="mt-0.5 text-sm text-muted">
            Total sur la période :{" "}
            <span className="font-semibold text-foreground">
              {formatXof(total)}
            </span>
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setGran(t.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                gran === t.key
                  ? "bg-white text-foreground shadow-sm"
                  : "text-gray-500 hover:bg-white/60 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Graphique en barres (série unique -> une seule teinte verte) */}
      <div className="relative">
        <div className="flex h-52 items-end gap-[3px]">
          {buckets.map((b, i) => {
            const h = (b.total / max) * 100;
            return (
              <div
                key={b.key}
                className="group relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={`w-full rounded-t transition-colors ${
                    hover === i ? "bg-primary" : "bg-primary/70"
                  }`}
                  style={{
                    height: `${h}%`,
                    minHeight: b.total > 0 ? "4px" : "2px",
                    opacity: b.total > 0 ? 1 : 0.35,
                  }}
                />
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-y-0 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
                    <div className="font-semibold">{formatXof(b.total)}</div>
                    <div className="text-white/60">{b.full}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Ligne de base */}
        <div className="mt-1 h-px w-full bg-border" />

        {/* Étiquettes de l'axe (espacées pour éviter le chevauchement) */}
        <div className="mt-1.5 flex gap-[3px]">
          {buckets.map((b, i) => (
            <div
              key={b.key}
              className="flex-1 text-center text-[10px] text-muted"
            >
              {i % step === 0 ? b.label : ""}
            </div>
          ))}
        </div>
      </div>

      {total === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted">
          Aucune recharge encaissée sur cette période.
        </p>
      )}
    </div>
  );
}
