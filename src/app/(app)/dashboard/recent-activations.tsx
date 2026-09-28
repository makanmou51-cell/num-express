"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { ServiceIcon } from "@/components/service-icon";
import { Amount, ButtonLink, Segmented } from "@/components/ui";
import { IconCheck, IconCopy } from "@/components/icons";
import { copyText } from "@/lib/clipboard";
import { formatWhen } from "@/lib/datetime";

export type DashAct = {
  id: string;
  serviceCode: string;
  serviceName: string | null;
  countryName: string | null;
  countryCode: string;
  status: string;
  smsCode: string | null;
  phoneNumber: string | null;
  priceXof: number;
  createdAt: string;
};

const NOISE = new Set(["CANCELLED", "REFUNDED", "EXPIRED"]);
const SUCCESS = new Set(["RECEIVED", "COMPLETED"]);

/**
 * Le code reçu, en gros et copiable en un appui, directement sur l'accueil.
 * Avant, il fallait ouvrir la fiche du numéro puis sélectionner au doigt une
 * ligne de texte — alors que c'est LA chose qu'on vient chercher.
 */
function CodeChip({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "copied" | "selected">("idle");
  const valueRef = useRef<HTMLSpanElement>(null);

  return (
    /* Occulte : ce bloc affiche le code de verification du client. */
    <div className="mb-2 pl-14" data-clarity-mask="true">
      <button
        type="button"
        aria-label="Copier le code"
        onClick={async () => {
          const r = await copyText(code, valueRef.current);
          setState(r === "copied" ? "copied" : "selected");
          if (r === "copied") setTimeout(() => setState("idle"), 2000);
        }}
        className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-mono text-lg font-bold tracking-[0.2em] tabular-nums transition-colors active:scale-[0.97] ${
          state === "copied"
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary"
        }`}
      >
        <span ref={valueRef} className="select-all">
          {code}
        </span>
        {state === "copied" ? (
          <IconCheck className="h-4 w-4" />
        ) : (
          <IconCopy className="h-4 w-4" />
        )}
      </button>
      {state === "selected" && (
        <p className="mt-1 text-xs font-medium text-warning" role="status">
          Appui long sur le code puis «&nbsp;Copier&nbsp;».
        </p>
      )}
    </div>
  );
}

export function RecentActivations({ activations }: { activations: DashAct[] }) {
  const [tab, setTab] = useState<"clean" | "all">("clean");
  const noiseCount = useMemo(
    () => activations.filter((a) => NOISE.has(a.status)).length,
    [activations],
  );
  const list = (
    tab === "all"
      ? activations
      : activations.filter((a) => !NOISE.has(a.status))
  ).slice(0, 6);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Activations récentes</h2>
        {noiseCount > 0 && (
          <Segmented
            ariaLabel="Filtrer les activations"
            value={tab}
            onChange={(v) => setTab(v as "clean" | "all")}
            options={[
              { value: "clean", label: "Actives" },
              { value: "all", label: "Toutes" },
            ]}
          />
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted">
            {activations.length > 0
              ? "Aucune activation active pour l'instant."
              : "Aucune activation pour l'instant."}
          </p>
          <ButtonLink href="/buy" size="sm" className="mt-3">
            Acheter mon premier numéro
          </ButtonLink>
        </div>
      ) : (
        <>
          <ul className="divide-y">
            {list.map((a) => {
              const received = SUCCESS.has(a.status) && a.smsCode;
              return (
                <li key={a.id}>
                  <Link
                    href={`/numbers/${a.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-gray-50 active:bg-gray-100"
                  >
                    <ServiceIcon
                      code={a.serviceCode}
                      className="h-11 w-11 shrink-0 text-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">
                          {a.serviceName ?? a.serviceCode}
                        </span>
                        <span className="text-muted">·</span>
                        <span className="truncate text-sm text-muted">
                          {a.countryName ?? a.countryCode}
                        </span>
                      </div>
                      <p
                        data-clarity-mask="true"
                        className="mt-0.5 truncate font-mono text-sm tabular-nums text-muted"
                      >
                        {a.phoneNumber || "Numéro en attribution…"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={a.status} />
                      <span className="text-[11px] text-muted">
                        {formatWhen(a.createdAt)} ·{" "}
                        <Amount value={a.priceXof} />
                      </span>
                    </div>
                  </Link>

                  {/* FRÈRE du <Link>, jamais enfant : un <button> dans un <a>
                    est du HTML invalide et Android capture le tap au hasard
                    entre les deux. Le code est ainsi copiable sans ouvrir
                    la fiche. */}
                  {received && a.smsCode && <CodeChip code={a.smsCode} />}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 border-t border-border pt-3 text-center">
            <Link
              href="/numbers"
              className="group inline-flex items-center gap-1 text-sm font-medium text-primary transition-all hover:gap-2 hover:text-primary/80"
            >
              Voir toutes mes activations
              <span
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </div>
        </>
      )}
    </>
  );
}
