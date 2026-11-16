"use client";

import { useMemo, useState, useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink } from "@/components/ui";
import { IconArrowLeft, IconCheck, IconClock, IconRefresh } from "@/components/icons";
import { ServiceIcon } from "@/components/service-icon";
import { formatXof } from "@/lib/pricing";
import { boostPriceXof } from "@/lib/boost/catalog";
import { placeBoostOrderAction, type BoostActionState } from "./actions";
import type { BoostNetwork, BoostTier } from "@/lib/boost/catalog";
import { cn } from "@/lib/utils";

/**
 * Commande de Boost en ASSISTANT (une décision par écran), façon « commander
 * en 4 étapes » : Réseau → Service → Quantité → Lien. Remplace le grand
 * formulaire où tout était empilé — le client voyait sept champs d'un coup et
 * décrochait.
 *
 * Choix de qualité : plié dans l'étape « Service ». Un service à une seule
 * qualité avance directement ; un service à plusieurs qualités affiche ses
 * options juste après (sous-écran de la même étape).
 *
 * Identité num express : surfaces claires, accent vert pour la sélection,
 * chiffres en mono tabulaire, orange réservé à l'action qui encaisse
 * (« Commander »). Pas de barre fixe : un récap + une action à la fin de
 * chaque étape, pour ne pas recouvrir « Mes commandes » en dessous.
 */

const QTY_PRESETS = [500, 1000, 2500, 5000];

/** Quantité de départ raisonnable : 1 000 si dans les bornes, sinon le min. */
function defaultQty(tier: BoostTier): number {
  return Math.min(Math.max(1000, tier.min), tier.max);
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/** Barre de progression + numéro d'étape. */
function Steps({ step }: { step: number }) {
  return (
    <div className="flex-1">
      <p className="text-xs text-muted">Étape {step} sur 4</p>
      <div className="mt-1 flex items-center gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-gray-200")}
          />
        ))}
      </div>
    </div>
  );
}

/** Ligne de récap (choix déjà faits) avec un lien « Changer ». */
function Recap({ children, onChange }: { children: React.ReactNode; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">{children}</div>
      <button type="button" onClick={onChange} className="shrink-0 text-sm font-medium text-primary">
        Changer
      </button>
    </div>
  );
}

function CommanderButton({ price, disabled }: { price: number; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending || disabled}>
      {pending ? "Commande en cours…" : `Commander · ${formatXof(price)}`}
    </Button>
  );
}

export function BoostForm({
  catalog,
  balance,
}: {
  catalog: BoostNetwork[];
  balance: number;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<BoostActionState, FormData>(
    placeBoostOrderAction,
    undefined,
  );

  const [step, setStep] = useState(1);
  const [netKey, setNetKey] = useState("");
  const [svcKey, setSvcKey] = useState("");
  const [tierKey, setTierKey] = useState("");
  const [qty, setQty] = useState(0);
  const [link, setLink] = useState("");
  const [about, setAbout] = useState(false);

  const network = catalog.find((n) => n.key === netKey);
  const service = network?.services.find((s) => s.key === svcKey);
  const tier = service?.tiers.find((t) => t.key === tierKey);
  const price = tier ? boostPriceXof(tier, qty || 0) : 0;
  const missing = Math.max(0, price - balance);

  // Étape 2 : sous-écran « qualité » quand un service à plusieurs options est
  // choisi mais que la qualité ne l'est pas encore.
  const choosingTier = Boolean(service && service.tiers.length > 1 && !tierKey);

  const presets = useMemo(
    () => (tier ? QTY_PRESETS.filter((n) => n >= tier.min && n <= tier.max) : []),
    [tier],
  );
  const qtyValid = Boolean(tier && qty >= tier.min && qty <= tier.max);

  // Après une commande réussie : on repart à zéro et on rafraîchit la liste.
  useEffect(() => {
    if (state && "success" in state) {
      setStep(1);
      setNetKey("");
      setSvcKey("");
      setTierKey("");
      setQty(0);
      setLink("");
      router.refresh();
    }
  }, [state, router]);

  function pickNetwork(k: string) {
    setNetKey(k);
    setSvcKey("");
    setTierKey("");
    setStep(2);
  }
  function pickService(s: BoostNetwork["services"][number]) {
    setSvcKey(s.key);
    if (s.tiers.length === 1) {
      setTierKey(s.tiers[0].key);
      setQty(defaultQty(s.tiers[0]));
      setStep(3);
    } else {
      setTierKey("");
    }
  }
  function pickTier(t: BoostTier) {
    setTierKey(t.key);
    setQty(defaultQty(t));
    setStep(3);
  }
  function back() {
    if (step === 2 && choosingTier) {
      setSvcKey("");
      return;
    }
    if (step === 2) {
      setStep(1);
      return;
    }
    if (step === 3) {
      setSvcKey("");
      setTierKey("");
      setStep(2);
      return;
    }
    if (step === 4) {
      setStep(3);
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      {state && "error" in state && <Alert variant="error">{state.error}</Alert>}
      {state && "success" in state && (
        <Alert variant="success">
          Commande lancée. Suis son avancement dans « Mes commandes » ci-dessous.
        </Alert>
      )}

      {/* En-tête : retour + progression */}
      <div className="flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={back}
            aria-label="Retour"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-foreground transition-colors active:bg-gray-100"
          >
            <IconArrowLeft className="h-4 w-4" />
          </button>
        )}
        <Steps step={step} />
      </div>

      {/* ───────── Étape 1 — Réseau ───────── */}
      {step === 1 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Que veux-tu faire grandir&nbsp;?
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {catalog.map((n) => (
              <button
                key={n.key}
                type="button"
                onClick={() => pickNetwork(n.key)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 active:bg-gray-50"
              >
                <ServiceIcon code={n.icon} className="h-12 w-12" />
                <span className="text-sm font-medium">{n.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ───────── Étape 2 — Service, puis qualité si besoin ───────── */}
      {step === 2 && network && !choosingTier && (
        <div className="space-y-3">
          <Recap onChange={() => setStep(1)}>
            <ServiceIcon code={network.icon} className="h-8 w-8" />
            <span className="truncate font-medium">{network.label}</span>
          </Recap>
          <h2 className="text-lg font-semibold tracking-tight">
            De quoi as-tu besoin sur {network.label}&nbsp;?
          </h2>
          <div className="space-y-2">
            {network.services.map((s) => {
              const from = Math.min(...s.tiers.map((t) => t.pricePer1000Xof));
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => pickService(s)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 active:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.label}</p>
                    <p className="mt-0.5 font-mono text-xs tabular-nums text-muted">
                      à partir de {formatXof(from)} / 1 000
                    </p>
                  </div>
                  <Chevron className="h-5 w-5 shrink-0 text-muted" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && network && service && choosingTier && (
        <div className="space-y-3">
          <Recap onChange={() => setSvcKey("")}>
            <ServiceIcon code={network.icon} className="h-8 w-8" />
            <span className="truncate font-medium">
              {network.label} · {service.label}
            </span>
          </Recap>
          <h2 className="text-lg font-semibold tracking-tight">Choisis la qualité</h2>
          <div className="space-y-2">
            {service.tiers.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => pickTier(t)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 active:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.label}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Livré {t.eta} · Recharge {t.refill}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono font-semibold tabular-nums">
                    {formatXof(t.pricePer1000Xof)}
                  </p>
                  <p className="text-xs text-muted">/ 1 000</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ───────── Étape 3 — Quantité ───────── */}
      {step === 3 && network && service && tier && (
        <div className="space-y-4">
          <Recap
            onChange={() => {
              setSvcKey("");
              setTierKey("");
              setStep(2);
            }}
          >
            <ServiceIcon code={network.icon} className="h-8 w-8" />
            <span className="truncate text-sm">
              <span className="font-medium">
                {network.label} · {service.label}
              </span>
              <span className="block truncate text-xs text-muted">{tier.label}</span>
            </span>
          </Recap>

          <h2 className="text-lg font-semibold tracking-tight">Combien&nbsp;?</h2>

          {presets.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {presets.map((n) => {
                const on = qty === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQty(n)}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center rounded-xl border-2 px-2 transition-colors",
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-white active:bg-gray-100",
                    )}
                  >
                    <span className="text-base font-semibold tabular-nums">
                      {n.toLocaleString("fr-FR")}
                    </span>
                    <span className="font-mono text-xs tabular-nums opacity-80">
                      {formatXof(boostPriceXof(tier, n))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Quantité précise, avec − / + */}
          <div>
            <label htmlFor="qty-precise" className="mb-1.5 block text-sm text-muted">
              Ou une quantité précise
            </label>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                aria-label="Diminuer"
                onClick={() => setQty((q) => Math.max(tier.min, (q || tier.min) - 100))}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-xl font-semibold text-foreground transition-colors active:bg-gray-100"
              >
                −
              </button>
              <input
                id="qty-precise"
                type="number"
                inputMode="numeric"
                value={qty || ""}
                min={tier.min}
                max={tier.max}
                onChange={(e) => setQty(Number(e.target.value))}
                className="min-h-12 w-full rounded-lg border border-border bg-white px-3 text-center text-base font-semibold tabular-nums focus:border-primary"
              />
              <button
                type="button"
                aria-label="Augmenter"
                onClick={() => setQty((q) => Math.min(tier.max, (q || tier.min) + 100))}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-xl font-semibold text-foreground transition-colors active:bg-gray-100"
              >
                +
              </button>
            </div>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted">
              Min {tier.min.toLocaleString("fr-FR")} · Max{" "}
              {tier.max.toLocaleString("fr-FR")}
            </p>
          </div>

          {/* À propos de ce service */}
          <div>
            <button
              type="button"
              onClick={() => setAbout((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
            >
              <Chevron
                className={cn("h-4 w-4 transition-transform", about && "rotate-90")}
              />
              À propos de ce service
            </button>
            {about && (
              <ul className="mt-2 space-y-2 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <IconClock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Livraison indicative&nbsp;: <strong>{tier.eta}</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <IconRefresh className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Recharge si ça baisse&nbsp;: <strong>{tier.refill}</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Garde le compte <strong>public</strong> et ne change pas le
                    nom d&apos;utilisateur pendant la livraison.
                  </span>
                </li>
              </ul>
            )}
          </div>

          {/* Total + action */}
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">
                {(qty || 0).toLocaleString("fr-FR")} · {service.label}
              </span>
              <span className="text-2xl font-semibold tabular-nums text-primary">
                {formatXof(price)}
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!qtyValid}
            onClick={() => setStep(4)}
          >
            Continuer
          </Button>
        </div>
      )}

      {/* ───────── Étape 4 — Lien ───────── */}
      {step === 4 && network && service && tier && (
        <div className="space-y-4">
          <Recap
            onChange={() => {
              setSvcKey("");
              setTierKey("");
              setStep(2);
            }}
          >
            <ServiceIcon code={network.icon} className="h-8 w-8" />
            <span className="truncate text-sm">
              <span className="font-medium">
                {network.label} · {service.label}
              </span>
              <span className="block truncate font-mono text-xs tabular-nums text-muted">
                {(qty || 0).toLocaleString("fr-FR")} · {formatXof(price)}
              </span>
            </span>
          </Recap>

          <h2 className="text-lg font-semibold tracking-tight">Colle ton lien</h2>

          <div>
            <label htmlFor="boost-link" className="mb-1.5 block text-sm font-medium">
              {service.linkHint}
            </label>
            <input
              id="boost-link"
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={() => {
                const v = link.trim();
                if (!v) return;
                if (!/^https?:\/\//i.test(v)) setLink(`https://${v}`);
                else if (v !== link) setLink(v);
              }}
              placeholder="https://…"
              className="min-h-11 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-base focus:border-primary"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const t = await navigator.clipboard.readText();
                  if (t) setLink(t.trim());
                } catch {
                  document.getElementById("boost-link")?.focus();
                }
              }}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-white text-sm font-medium transition-colors active:bg-gray-100"
            >
              Coller le lien
            </button>
          </div>

          {/* Solde insuffisant : on dit exactement combien ajouter, et on mène
              droit à la recharge (le contrôle serveur reste la vérité). */}
          {missing > 0 ? (
            <>
              <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
                <p className="font-semibold text-warning">
                  Il te manque{" "}
                  <span className="tabular-nums">{formatXof(missing)}</span>
                </p>
                <p className="mt-0.5 text-muted">
                  Ton solde est de{" "}
                  <span className="font-mono tabular-nums">{formatXof(balance)}</span>.
                  Recharge pour passer cette commande.
                </p>
              </div>
              <ButtonLink href="/wallet" variant="accent" size="lg" className="w-full">
                Recharger mon solde
              </ButtonLink>
            </>
          ) : (
            <CommanderButton price={price} disabled={!link.trim()} />
          )}
        </div>
      )}

      {/* Champs envoyés au serveur (le contrôle serveur reste la vérité). */}
      <input type="hidden" name="network" value={netKey} />
      <input type="hidden" name="service" value={svcKey} />
      <input type="hidden" name="tier" value={tierKey} />
      <input type="hidden" name="quantity" value={qty} />
      <input type="hidden" name="link" value={link} />
    </form>
  );
}
