"use client";

import { useState } from "react";
import Link from "next/link";
import { ServiceIcon } from "@/components/service-icon";

export type Svc = { code: string; label: string; reliable: boolean };

function ServiceCard({ svc }: { svc: Svc }) {
  return (
    <Link
      href={`/buy/${svc.code}`}
      className="group relative flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40"
    >
      <ServiceIcon code={svc.code} className="h-11 w-11 shrink-0 text-sm" />
      <span className="font-medium group-hover:text-primary">{svc.label}</span>
      {svc.reliable && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 text-[11px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Fiable
        </span>
      )}
    </Link>
  );
}

export function ServiceGrid({
  featured,
  others,
}: {
  featured: Svc[];
  others: Svc[];
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const filtered = term
    ? [...featured, ...others].filter(
        (s) => s.label.toLowerCase().includes(term) || s.code.includes(term),
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Recherche service */}
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
          placeholder="Rechercher un service (WhatsApp, Telegram, TikTok…)"
          className="w-full rounded-xl border border-border bg-white min-h-11 py-2.5 pl-9 pr-3 text-base transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {filtered ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
          </h2>
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted">
              Aucun service ne correspond à « {q} ».
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((s) => (
                <ServiceCard key={s.code} svc={s} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted">
              Populaires
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {featured.map((s) => (
                <ServiceCard key={s.code} svc={s} />
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted">
              Autres services
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {others.map((s) => (
                <ServiceCard key={s.code} svc={s} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
