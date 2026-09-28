"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { ServiceIcon } from "@/components/service-icon";
import { ButtonLink, Segmented } from "@/components/ui";
import { IconSim } from "@/components/icons";
import { formatXof } from "@/lib/pricing";
import { formatWhen } from "@/lib/datetime";

export type NumItem = {
  id: string;
  kind: "activation" | "rental";
  href: string;
  serviceCode: string;
  serviceName: string | null;
  countryName: string | null;
  countryCode: string;
  status: string;
  code: string | null;
  phoneNumber: string | null;
  priceXof: number;
  createdAt: string;
  durationLabel?: string;
};

const NOISE = new Set(["CANCELLED", "REFUNDED", "EXPIRED"]);
const SUCCESS = new Set(["RECEIVED", "COMPLETED"]);

export function NumbersList({ items }: { items: NumItem[] }) {
  const [tab, setTab] = useState<"clean" | "all">("clean");
  const noiseCount = useMemo(
    () => items.filter((a) => NOISE.has(a.status)).length,
    [items],
  );
  const list =
    tab === "all" ? items : items.filter((a) => !NOISE.has(a.status));

  return (
    <div className="space-y-4">
      {noiseCount > 0 && (
        <div className="flex justify-end">
          <Segmented
            ariaLabel="Filtrer les numéros"
            value={tab}
            onChange={(v) => setTab(v as "clean" | "all")}
            options={[
              { value: "clean", label: "Actifs" },
              { value: "all", label: `Tous (${items.length})` },
            ]}
          />
        </div>
      )}

      {list.length === 0 ? (
        /* Un état vide sans action est un cul-de-sac : le nouveau client
           arrivait sur une phrase grise, le bouton « Acheter » étant relégué
           en petit tout en haut de la page. */
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <IconSim className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 text-base font-semibold">
            {items.length > 0
              ? "Aucun numéro actif"
              : "Aucun numéro pour l'instant"}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            {items.length > 0
              ? "Vos numéros terminés restent visibles dans l'onglet « Tous »."
              : "Achetez un numéro et recevez le code en quelques secondes."}
          </p>
          <ButtonLink
            href="/buy"
            variant="accent"
            size="lg"
            className="mt-5 w-full sm:w-auto"
          >
            Acheter un numéro
          </ButtonLink>
        </div>
      ) : (
        <div className="divide-y rounded-2xl border border-border bg-card">
          {list.map((a) => {
            const isRental = a.kind === "rental";
            const received = isRental
              ? Boolean(a.code)
              : SUCCESS.has(a.status) && Boolean(a.code);
            return (
              <Link
                key={`${a.kind}-${a.id}`}
                href={a.href}
                /* `hover:bg-muted/50` utilisait --muted (#475569, une ardoise
                   foncée) : la ligne devenait gris foncé, et sur Android l'état
                   :hover reste collé après un appui — en revenant de la fiche,
                   le client retrouvait sa ligne assombrie, l'air désactivée. */
                className="flex items-center gap-3 px-4 py-3.5 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-gray-50 active:bg-gray-100"
              >
                <ServiceIcon
                  code={a.serviceCode}
                  className="h-11 w-11 shrink-0 text-sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium">
                      {a.serviceName ?? a.serviceCode}
                    </span>
                    <span className="text-muted">·</span>
                    <span className="truncate text-sm text-muted">
                      {a.countryName ?? a.countryCode}
                    </span>
                    {isRental && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        Loué{a.durationLabel ? ` · ${a.durationLabel}` : ""}
                      </span>
                    )}
                  </div>
                  {received ? (
                    <p className="mt-0.5 text-sm">
                      <span className="text-muted">Code : </span>
                      {/* Occulté dans les enregistrements de session. */}
                      <span
                        data-clarity-mask="true"
                        className="font-mono font-semibold tracking-wider text-primary"
                      >
                        {a.code}
                      </span>
                    </p>
                  ) : (
                    /* Le numéro était en 12px gris — l'info centrale de la
                       ligne. En attente, un point ambré qui bat montre que
                       la recherche du code tourne encore. */
                    <p className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-sm tabular-nums">
                      {a.status === "WAITING_CODE" && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-500"
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate" data-clarity-mask="true">
                        {a.phoneNumber || "Numéro en attribution…"}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {isRental ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        a.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {a.status === "ACTIVE" ? "Actif" : "Expiré"}
                    </span>
                  ) : (
                    <StatusBadge status={a.status} />
                  )}
                  <span className="text-[11px] text-muted">
                    {formatWhen(a.createdAt)} · {formatXof(a.priceXof)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
