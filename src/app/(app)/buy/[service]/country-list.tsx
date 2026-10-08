"use client";

import { useMemo, useState } from "react";
import { ButtonLink } from "@/components/ui";
import {
  IconCall,
  IconCheck,
  IconGlobe,
  IconSms,
} from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { formatXof } from "@/lib/pricing";
import { purchaseAction } from "@/app/(app)/actions";

export type CountryOffer = {
  countryCode: string;
  countryName: string;
  iso: string | null;
  count: number;
  priceXof: number;
  reliable?: boolean;
};

/**
 * Choix du pays, puis achat.
 *
 * Avant : chaque ligne portait son propre `<form>` avec un petit bouton vert
 * « Acheter » collé au bord de l'écran. Un seul effleurement débitait le
 * compte — sans jamais récapituler le service, le mode de réception, le prix
 * ni le solde restant. Avec quarante pays affichés, c'étaient quarante boutons
 * verts identiques : plus aucune action dominante à l'écran.
 *
 * Maintenant : la ligne SÉLECTIONNE le pays, et un récapitulatif apparaît en
 * bas de l'écran avec un seul bouton orange de confirmation.
 *
 * Ce qui ne devait surtout pas bouger : les trois champs cachés `service`,
 * `country` et `verify` partent à l'identique dans le formulaire — un nom
 * modifié et l'achat casse en silence (`purchaseAction` redirige alors vers
 * /buy/{service}?error=…).
 */
export function CountryList({
  service,
  serviceName,
  offers,
  userBalance,
}: {
  service: string;
  serviceName: string;
  offers: CountryOffer[];
  userBalance: number;
}) {
  const [q, setQ] = useState("");
  const [verify, setVerify] = useState<"SMS" | "CALL">("SMS");
  const [picked, setPicked] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return offers;
    return offers.filter((o) => o.countryName.toLowerCase().includes(term));
  }, [q, offers]);

  const chosen = offers.find((o) => o.countryCode === picked) ?? null;
  const missing = chosen ? Math.max(0, chosen.priceXof - userBalance) : 0;
  const after = chosen ? userBalance - chosen.priceXof : userBalance;

  return (
    /* pb-56 quand le récapitulatif est ouvert : sans cette réserve, les
       dernières lignes de la liste passent dessous et deviennent inatteignables. */
    <div className={`space-y-3 ${chosen ? "pb-56" : ""}`}>
      {/* Type de réception */}
      <div className="space-y-1.5">
        <p
          id="verify-label"
          className="px-1 text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Réception du code
        </p>
        <div
          role="radiogroup"
          aria-labelledby="verify-label"
          className="flex gap-2"
        >
          {(["SMS", "CALL"] as const).map((v) => {
            const on = verify === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setVerify(v)}
                className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold transition-colors ${
                  on
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card active:bg-gray-100"
                }`}
              >
                {v === "SMS" ? (
                  <IconSms className="h-4 w-4" />
                ) : (
                  <IconCall className="h-4 w-4" />
                )}
                {v === "SMS" ? "Par SMS" : "Par appel"}
                {on && <IconCheck className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
        {verify === "CALL" && (
          <p className="px-1 text-xs text-muted">
            Sur WhatsApp, choisissez «&nbsp;M&apos;appeler&nbsp;» : le code reçu
            par appel s&apos;affichera ici. Idéal quand le SMS tarde.
          </p>
        )}
      </div>

      {/* Recherche pays */}
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Rechercher un pays"
          placeholder="Rechercher un pays…"
          className="min-h-11 w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-3 text-base transition-colors focus:border-primary"
        />
      </div>

      <p className="px-1 text-xs text-muted">
        {filtered.length} pays disponible{filtered.length > 1 ? "s" : ""}
      </p>

      <div
        role="radiogroup"
        aria-label="Choisir un pays"
        className="divide-y overflow-hidden rounded-2xl border border-border bg-card"
      >
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            Aucun pays ne correspond à « {q} ».
          </p>
        ) : (
          filtered.map((o) => {
            const on = o.countryCode === picked;
            return (
              <button
                key={o.countryCode}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPicked(o.countryCode)}
                className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                  on ? "bg-primary/10" : "active:bg-gray-100"
                }`}
              >
                <Flag iso={o.iso} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    <span className="truncate">{o.countryName}</span>
                    {o.reliable && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-success/10 px-1.5 py-0.5 text-xs font-semibold text-success">
                        <IconCheck className="h-3 w-3" />
                        Fiable
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {o.count.toLocaleString("fr-FR")} numéros
                  </p>
                </div>
                <span className="shrink-0 font-bold tabular-nums">
                  {formatXof(o.priceXof)}
                </span>
                {on && <IconCheck className="h-5 w-5 shrink-0 text-primary" />}
              </button>
            );
          })
        )}
      </div>

      {/* ── Récapitulatif ──────────────────────────────────────────────
          Ancré au-dessus de la barre d'onglets (56 px + zone sûre iPhone)
          pour ne pas la recouvrir. */}
      {chosen && (
        <div className="fixed inset-x-0 bottom-14 z-30 mb-[env(safe-area-inset-bottom)] border-t border-border bg-card p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.10)] md:bottom-0 md:mb-0">
          <div className="mx-auto max-w-xl">
            <div className="flex items-center gap-2">
              <Flag iso={chosen.iso} />
              <p className="min-w-0 flex-1 truncate text-sm">
                <strong>{serviceName}</strong> · {chosen.countryName} ·{" "}
                {verify === "SMS" ? "par SMS" : "par appel"}
              </p>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="shrink-0 text-sm font-medium text-primary underline underline-offset-2"
              >
                Changer
              </button>
            </div>

            <div className="mt-2 flex items-end justify-between">
              <span className="text-sm text-muted">Prix</span>
              <span className="text-3xl font-extrabold tabular-nums">
                {formatXof(chosen.priceXof)}
              </span>
            </div>
            <p className="mt-0.5 text-right text-xs text-muted">
              {missing > 0 ? (
                <span className="font-semibold text-warning">
                  Il vous manque{" "}
                  <span className="tabular-nums">{formatXof(missing)}</span>
                </span>
              ) : (
                <>
                  Solde après achat&nbsp;:{" "}
                  <span className="tabular-nums">{formatXof(after)}</span>
                </>
              )}
            </p>

            {missing > 0 ? (
              <ButtonLink
                href="/wallet"
                variant="accent"
                size="lg"
                className="mt-3 w-full"
              >
                Recharger mon solde
              </ButtonLink>
            ) : (
              <form action={purchaseAction} className="mt-3">
                {/* NE PAS renommer : `purchaseAction` lit exactement ces trois
                    noms. Un champ perdu = achat cassé sans message. */}
                <input type="hidden" name="service" value={service} />
                <input
                  type="hidden"
                  name="country"
                  value={chosen.countryCode}
                />
                <input type="hidden" name="verify" value={verify} />
                {/* SubmitButton se désactive pendant l'envoi : un seul bouton
                    pour toute la liste, donc un double appui sur 3G enverrait
                    autrement deux achats. */}
                <SubmitButton
                  variant="accent"
                  size="lg"
                  className="w-full"
                  pendingLabel="Achat en cours…"
                >
                  Acheter ce numéro
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Flag({ iso }: { iso: string | null }) {
  if (!iso) {
    return (
      <span className="flex h-5 w-7 shrink-0 items-center justify-center rounded-sm bg-gray-100 text-muted">
        <IconGlobe className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${iso}.png`}
      alt=""
      width={28}
      height={21}
      loading="lazy"
      className="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm ring-1 ring-black/5"
    />
  );
}
