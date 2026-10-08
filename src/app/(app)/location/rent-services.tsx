"use client";

import { useState } from "react";
import Link from "next/link";
import { ServiceIcon } from "@/components/service-icon";

type Svc = { code: string; name: string; featured: boolean };

export function RentServices({
  services,
  active,
  durationHours,
}: {
  services: Svc[];
  active: string;
  durationHours: number;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const filtered = term
    ? services
        .filter(
          (s) =>
            s.name.toLowerCase().includes(term) ||
            s.code.toLowerCase().includes(term),
        )
        .slice(0, 80)
    : null;

  const featured = services.filter((s) => s.featured);
  const base = featured.some((s) => s.code === active)
    ? featured
    : [...services.filter((s) => s.code === active), ...featured];
  const shown = filtered ?? base;

  return (
    <div className="space-y-2">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un service (WhatsApp, Netflix, Ticketmaster…)"
          className="w-full rounded-xl border border-border bg-white min-h-11 py-2.5 pl-9 pr-3 text-base transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {shown.map((s) => {
          const isActive = s.code === active;
          return (
            <Link
              key={s.code}
              href={`/location?service=${s.code}&duration=${durationHours}`}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <ServiceIcon code={s.code} className="h-6 w-6 text-[10px]" />
              <span className="max-w-[150px] truncate">{s.name}</span>
            </Link>
          );
        })}
      </div>

      {filtered && filtered.length === 0 && (
        <p className="text-sm text-muted">
          Aucun service ne correspond à « {q} ».
        </p>
      )}
      {!filtered && services.length > featured.length && (
        <p className="text-xs text-muted">
          + {services.length - featured.length} autres services — utilisez la
          recherche ci-dessus.
        </p>
      )}
    </div>
  );
}
