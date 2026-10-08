"use client";

import { useMemo, useState } from "react";
import { ButtonLink } from "@/components/ui";
import { IconGlobe } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { formatXof } from "@/lib/pricing";
import { rentAction } from "./actions";

export type RentCountryOffer = {
  countryCode: string;
  countryName: string;
  iso: string | null;
  quantity: number;
  priceXof: number;
};

export function RentCountryList({
  service,
  durationHours,
  offers,
  userBalance,
}: {
  service: string;
  durationHours: number;
  offers: RentCountryOffer[];
  userBalance: number;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return offers;
    return offers.filter((o) => o.countryName.toLowerCase().includes(term));
  }, [q, offers]);

  return (
    <div className="space-y-3">
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
          placeholder="Rechercher un pays…"
          className="w-full rounded-xl border border-border bg-white min-h-11 py-2.5 pl-9 pr-3 text-base transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <p className="px-1 text-xs text-muted">
        {filtered.length} pays disponible{filtered.length > 1 ? "s" : ""}
      </p>

      <div className="divide-y overflow-hidden rounded-2xl border border-border bg-card">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            Aucun pays ne correspond à « {q} ».
          </p>
        ) : (
          filtered.map((o) => {
            const affordable = userBalance >= o.priceXof;
            return (
              <div
                key={o.countryCode}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                {o.iso ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://flagcdn.com/w40/${o.iso}.png`}
                    alt=""
                    width={28}
                    height={21}
                    loading="lazy"
                    className="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm ring-1 ring-black/5"
                  />
                ) : (
                  <span className="flex h-5 w-7 shrink-0 items-center justify-center rounded-sm bg-gray-100 text-muted">
                    <IconGlobe className="h-3.5 w-3.5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{o.countryName}</p>
                  <p className="text-xs text-muted">
                    {o.quantity.toLocaleString("fr-FR")} dispo
                  </p>
                </div>
                <span className="shrink-0 font-bold">
                  {formatXof(o.priceXof)}
                </span>
                {affordable ? (
                  <form action={rentAction} className="shrink-0">
                    <input type="hidden" name="service" value={service} />
                    <input type="hidden" name="country" value={o.countryCode} />
                    <input type="hidden" name="duration" value={durationHours} />
                    <SubmitButton size="sm" pendingLabel="Location…">
                      Louer
                    </SubmitButton>
                  </form>
                ) : (
                  <ButtonLink
                    href="/wallet"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                  >
                    Recharger
                  </ButtonLink>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
