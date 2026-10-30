"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ServiceIcon } from "@/components/service-icon";
import { WhatsAppGuide } from "@/components/whatsapp-guide";
import { ButtonLink } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatXof } from "@/lib/pricing";
import { purchaseAction } from "@/app/(app)/actions";

type Svc = { code: string; name: string; featured: boolean };
type Country = {
  code: string;
  name: string;
  iso: string | null;
  count: number;
  /* Taux de reception mesure sur nos ventes, 0-100. Absent si trop peu de
     ventes pour que le chiffre signifie quelque chose. */
  successRate?: number;
  priceXof: number;
  reliable: boolean;
};
type Price = {
  available: boolean;
  kind?: "activation" | "rental";
  priceXof?: number;
  count?: number;
  reason?: "no_physical";
  rentalAvailable?: boolean;
  suggestDuration?: number;
};


/* ─────────────── Icônes (SVG : jamais d'emoji comme icône) ─────────────── */

const svg = "shrink-0";

function IconSearch({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${svg} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${svg} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function IconSms({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${svg} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconCall({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${svg} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l4 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}
function IconGlobe({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${svg} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
    </svg>
  );
}
function IconWarn({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${svg} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
function IconEdit({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${svg} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

/* ─────────────────────────── Sous-composants ─────────────────────────── */

/** Fil d'Ariane des 3 étapes : le client sait toujours où il en est. */
function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Service", "Pays", "Acheter"];
  return (
    <ol className="flex items-center gap-2" aria-label={`Étape ${step} sur 3`}>
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done
                  ? "bg-primary text-primary-foreground"
                  : current
                    ? "bg-primary/15 text-primary ring-2 ring-primary"
                    : "bg-border text-muted"
              }`}
            >
              {done ? <IconCheck className="h-3.5 w-3.5" /> : n}
            </span>
            <span
              className={`hidden text-xs font-medium sm:block ${current ? "text-foreground" : "text-muted"}`}
            >
              {label}
            </span>
            {i < 2 && <span className="h-px flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

/** Squelette de chargement : réserve la hauteur, la page ne saute plus. */
function RowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-14 animate-pulse items-center gap-3 rounded-xl border border-border bg-card px-3"
        >
          <span className="h-8 w-8 rounded-lg bg-border" />
          <span className="h-3 flex-1 rounded bg-border" />
          <span className="h-3 w-16 rounded bg-border" />
        </div>
      ))}
    </div>
  );
}

/** Champ de recherche avec un VRAI label (jamais un placeholder seul). */
function SearchField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          id={id}
          type="search"
          inputMode="search"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-11 w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-3 text-base transition-colors focus:border-primary"
        />
      </div>
    </div>
  );
}

/** Ligne de résumé d'une étape validée + bouton « Modifier » nommé. */
function ChosenRow({
  children,
  onEdit,
  editLabel,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  editLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={editLabel}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 active:bg-primary/20"
      >
        <IconEdit className="h-4 w-4" />
        Modifier
      </button>
    </div>
  );
}

/* ──────────────────────────────── Wizard ──────────────────────────────── */

export function BuyWizard({
  services,
  userBalance,
}: {
  services: Svc[];
  userBalance: number;
}) {
  const uid = useId();
  const [service, setService] = useState<Svc | null>(null);
  const [country, setCountry] = useState<Country | null>(null);

  // Étape 1 — services
  const [svcQ, setSvcQ] = useState("");
  const [svcLimit, setSvcLimit] = useState(8);
  const filteredSvc = useMemo(() => {
    const t = svcQ.trim().toLowerCase();
    return t
      ? services.filter(
          (s) => s.name.toLowerCase().includes(t) || s.code.includes(t),
        )
      : [...services].sort((a, b) => Number(b.featured) - Number(a.featured));
  }, [svcQ, services]);

  // Étape 2 — pays
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [ctryLoading, setCtryLoading] = useState(false);
  const [ctryErr, setCtryErr] = useState<string | null>(null);
  const [ctryQ, setCtryQ] = useState("");
  const [ctryLimit, setCtryLimit] = useState(8);
  const [sortBy, setSortBy] = useState<"quality" | "price">("quality");

  /**
   * Liste des pays : préchargée, et gardée en mémoire.
   *
   * ── Pourquoi c'était lent ───────────────────────────────────────────
   * Rien ne partait avant le clic sur le service. Le client attendait
   * alors toute la chaîne bout à bout : aller-retour vers notre serveur,
   * réveil éventuel de la fonction, puis les appels au fournisseur —
   * mesurés entre 0,6 et 1,5 s rien que pour eux. Et comme la requête
   * était en « no-store », revenir sur un service déjà consulté
   * recommençait tout.
   *
   * Deux changements. Le chargement DÉMARRE dès que le doigt touche la
   * carte du service, avant même que le clic soit relâché — ces quelques
   * centaines de millisecondes sont autant de pris. Et le résultat est
   * gardé en mémoire : revenir en arrière puis ressortir est instantané.
   *
   * La fraîcheur n'en souffre pas : le prix affiché ici ne sert qu'au
   * classement. Celui qui sera facturé est recalculé à l'étape suivante,
   * sans cache, et de toute façon revérifié au moment de l'achat.
   */
  const enMemoire = useRef(new Map<string, Country[]>());
  const enCours = useRef(new Map<string, Promise<Country[]>>());

  const chargerPays = useCallback((code: string): Promise<Country[]> => {
    const dejaLa = enMemoire.current.get(code);
    if (dejaLa) return Promise.resolve(dejaLa);
    const enRoute = enCours.current.get(code);
    if (enRoute) return enRoute;

    const promesse = fetch(
      `/api/buy/countries?service=${encodeURIComponent(code)}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        const liste: Country[] = d.countries ?? [];
        enMemoire.current.set(code, liste);
        return liste;
      })
      .finally(() => {
        /* On retire la promesse en cours quoi qu'il arrive : un échec ne
           doit pas condamner ce service pour le reste de la visite. */
        enCours.current.delete(code);
      });

    enCours.current.set(code, promesse);
    return promesse;
  }, []);

  useEffect(() => {
    if (!service) return;
    const code = service.code;
    const dejaLa = enMemoire.current.get(code);
    if (dejaLa) {
      setCountries(dejaLa);
      setCtryErr(null);
      return;
    }
    let vivant = true;
    setCountries(null);
    setCtryErr(null);
    setCtryLoading(true);
    chargerPays(code)
      .then((liste) => {
        if (vivant) setCountries(liste);
      })
      .catch((e) => {
        if (vivant) {
          setCtryErr(
            (e as Error).message ||
              "Chargement impossible. Vérifiez votre connexion.",
          );
        }
      })
      .finally(() => {
        if (vivant) setCtryLoading(false);
      });
    return () => {
      vivant = false;
    };
  }, [service, chargerPays]);

  const filteredCtry = useMemo(() => {
    if (!countries) return [];
    const t = ctryQ.trim().toLowerCase();
    const list = t
      ? countries.filter((c) => c.name.toLowerCase().includes(t))
      : countries;
    return sortBy === "price"
      ? [...list].sort((a, b) => a.priceXof - b.priceXof)
      : list; // « qualité » = ordre serveur (numéros physiques décroissants)
  }, [countries, ctryQ, sortBy]);

  // Étape 3 — options + prix
  const [verify, setVerify] = useState<"SMS" | "CALL">("SMS");
  const [price, setPrice] = useState<Price | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    if (!service || !country) return;
    setPrice(null);
    setPriceLoading(true);
    let alive = true;
    fetch(
      `/api/buy/price?service=${encodeURIComponent(service.code)}&country=${encodeURIComponent(country.code)}&duration=0`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((d) => alive && setPrice(d))
      .catch(() => alive && setPrice({ available: false }))
      .finally(() => alive && setPriceLoading(false));
    return () => {
      alive = false;
    };
  }, [service, country]);

  const chooseService = (s: Svc) => {
    setService(s);
    setCountry(null);
    setCtryQ("");
    setCtryLimit(8);
  };

  const affordable = price?.priceXof != null && userBalance >= price.priceXof;
  const missing =
    price?.priceXof != null ? Math.max(0, price.priceXof - userBalance) : 0;
  const step: 1 | 2 | 3 = !service ? 1 : !country ? 2 : 3;

  return (
    <div className="space-y-4">
      <Stepper step={step} />

      {/* ═════════ ÉTAPE 1 — SERVICE ═════════ */}
      <section
        aria-labelledby={`${uid}-s1`}
        className="space-y-3 rounded-2xl border border-border bg-card p-4"
      >
        <h2 id={`${uid}-s1`} className="text-sm font-semibold">
          <span className="mr-1 text-muted">1.</span> Choisir le service
        </h2>

        {service ? (
          <ChosenRow
            onEdit={() => {
              setService(null);
              setCountry(null);
            }}
            editLabel="Changer de service"
          >
            <ServiceIcon code={service.code} className="h-8 w-8 text-xs" />
            <span className="truncate font-medium">{service.name}</span>
          </ChosenRow>
        ) : (
          <>
            <SearchField
              id={`${uid}-svc`}
              label="Rechercher un service"
              value={svcQ}
              onChange={setSvcQ}
              placeholder="WhatsApp, Telegram, Google…"
            />
            {filteredSvc.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Aucun service ne correspond à « {svcQ} ».
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredSvc.slice(0, svcLimit).map((s) => (
                  <li key={s.code}>
                    <button
                      type="button"
                      onClick={() => chooseService(s)}
                      /* Le chargement part dès le contact, pas au clic : sur
                         mobile il s'écoule 100 à 300 ms entre les deux, et
                         sur un réseau lent elles comptent. Une promesse déjà
                         en vol est réutilisée, jamais dupliquée. */
                      onPointerDown={() => {
                        chargerPays(s.code).catch(() => {});
                      }}
                      onMouseEnter={() => {
                        chargerPays(s.code).catch(() => {});
                      }}
                      className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 active:bg-primary/10"
                    >
                      <ServiceIcon code={s.code} className="h-8 w-8 text-xs" />
                      <span className="flex-1 truncate text-sm font-medium">
                        {s.name}
                      </span>
                      {s.featured && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          Populaire
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {filteredSvc.length > svcLimit && (
              <button
                type="button"
                onClick={() => setSvcLimit((n) => n + 12)}
                className="min-h-11 w-full rounded-xl border border-border text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-primary/5 active:bg-primary/10"
              >
                Afficher plus de services
              </button>
            )}
          </>
        )}
      </section>

      {/* ═════════ ÉTAPE 2 — PAYS ═════════ */}
      {service && (
        <section
          aria-labelledby={`${uid}-s2`}
          className="space-y-3 rounded-2xl border border-border bg-card p-4"
        >
          <h2 id={`${uid}-s2`} className="text-sm font-semibold">
            <span className="mr-1 text-muted">2.</span> Choisir le pays
          </h2>

          {country ? (
            <ChosenRow
              onEdit={() => setCountry(null)}
              editLabel="Changer de pays"
            >
              <CountryFlag iso={country.iso} />
              <span className="truncate font-medium">{country.name}</span>
            </ChosenRow>
          ) : (
            <>
              <SearchField
                id={`${uid}-ctry`}
                label="Rechercher un pays"
                value={ctryQ}
                onChange={setCtryQ}
                placeholder="France, Royaume-Uni, Portugal…"
              />

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  {countries ? `${filteredCtry.length} pays disponibles` : "…"}
                </p>
                <button
                  type="button"
                  aria-pressed={sortBy === "price"}
                  onClick={() =>
                    setSortBy((s) => (s === "quality" ? "price" : "quality"))
                  }
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold transition-colors hover:border-primary/50 active:bg-primary/10"
                >
                  Trier&nbsp;: {sortBy === "quality" ? "Fiabilité" : "Prix"}
                </button>
              </div>

              {ctryLoading && <RowSkeleton rows={5} />}

              {ctryErr && (
                <p
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium text-destructive"
                >
                  <IconWarn className="h-4 w-4" />
                  {ctryErr}
                </p>
              )}

              {countries && !ctryLoading && filteredCtry.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">
                  Aucun pays ne correspond à « {ctryQ} ».
                </p>
              )}

              <ul className="space-y-2">
                {filteredCtry.slice(0, ctryLimit).map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setCountry(c);
                      }}
                      className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 active:bg-primary/10"
                    >
                      <CountryFlag iso={c.iso} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">
                            {c.name}
                          </span>
                          {c.reliable && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                              <IconCheck className="h-3 w-3" />
                              Fiable
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-muted">
                          {c.count.toLocaleString("fr-FR")} numéros disponibles
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums">
                        {formatXof(c.priceXof)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {filteredCtry.length > ctryLimit && (
                <button
                  type="button"
                  onClick={() => setCtryLimit((n) => n + 12)}
                  className="min-h-11 w-full rounded-xl border border-border text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-primary/5 active:bg-primary/10"
                >
                  Afficher plus de pays
                </button>
              )}
            </>
          )}
        </section>
      )}

      {/* ═════════ ÉTAPE 3 — ACHETER ═════════ */}
      {service && country && (
        <section
          aria-labelledby={`${uid}-s3`}
          className="space-y-4 rounded-2xl border border-border bg-card p-4"
        >
          <h2 id={`${uid}-s3`} className="text-sm font-semibold">
            <span className="mr-1 text-muted">3.</span> Valider votre achat
          </h2>

          {service.code === "wa" && (
            <WhatsAppGuide countryName={country.name} />
          )}

          {/* Type de vérification — vrai groupe de boutons radio.
              Le FlashCall est un produit distinct chez HeroSMS : le choix
              descend jusqu'au fournisseur, il ne reste pas décoratif. */}
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Recevoir le code par
            </legend>
            <div
              role="radiogroup"
              aria-label="Type de vérification"
              className="flex gap-2"
            >
              {(
                [
                  { v: "SMS", label: "SMS", Icon: IconSms },
                  { v: "CALL", label: "Appel", Icon: IconCall },
                ] as const
              ).map(({ v, label, Icon }) => {
                const on = verify === v;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setVerify(v)}
                    className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold transition-colors active:scale-[0.98] ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {/* La coche évite de signaler l'état par la COULEUR SEULE. */}
                    {on ? (
                      <IconCheck className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    {label}
                  </button>
                );
              })}
            </div>
            {verify === "CALL" && (
              <p className="mt-1.5 px-1 text-xs text-muted">
                Choisissez «&nbsp;M&apos;appeler&nbsp;» dans{" "}
                {service.name} quand le SMS tarde. Le code dicté s&apos;affichera
                ici. Si l&apos;appel n&apos;est pas disponible, vous recevrez un
                SMS au même prix.
              </p>
            )}
          </fieldset>

          {/* ── Prix + action ── */}
          <div className="rounded-2xl border border-border bg-background p-4">
            {priceLoading ? (
              <div
                className="flex min-h-14 animate-pulse items-center justify-between gap-3"
                aria-hidden="true"
              >
                <span className="space-y-2">
                  <span className="block h-6 w-28 rounded bg-border" />
                  <span className="block h-3 w-20 rounded bg-border" />
                </span>
                <span className="block h-11 w-28 rounded-lg bg-border" />
              </div>
            ) : !price?.available ? (
              price?.reason === "no_physical" ? (
                <div className="space-y-3" role="alert">
                  <p className="flex items-start gap-2 text-sm font-medium text-warning">
                    <IconWarn className="mt-0.5 h-4 w-4" />
                    <span>
                      Pas de code unique (20 min) pour {country.name} : aucun
                      numéro physique disponible, {service.name} refuserait un
                      numéro virtuel.
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    Essayez un autre pays pour ce service.
                  </p>
                </div>
              ) : (
                <p role="alert" className="text-center text-sm text-muted">
                  Indisponible pour cette durée. Choisissez une autre durée ou
                  un autre pays.
                </p>
              )
            ) : (
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">
                      {formatXof(price.priceXof!)}
                    </p>
                    <p className="text-xs text-muted">
                      Code unique ·{" "}
                      {verify === "CALL" ? "reçu par appel" : "reçu par SMS"}
                    </p>
                  </div>
                  <p className="text-right text-xs text-muted">
                    Votre solde
                    <span className="block font-bold tabular-nums text-foreground">
                      {formatXof(userBalance)}
                    </span>
                  </p>
                </div>

                {affordable ? (
                  <form action={purchaseAction}>
                      <input
                        type="hidden"
                        name="service"
                        value={service.code}
                      />
                      <input
                        type="hidden"
                        name="country"
                        value={country.code}
                      />
                      <input type="hidden" name="verify" value={verify} />
                      <SubmitButton
                        variant="accent"
                        size="lg"
                        className="w-full"
                        pendingLabel="Achat en cours…"
                      >
                        Acheter ce numéro
                      </SubmitButton>
                    </form>
                ) : (
                  <div className="space-y-2" role="alert">
                    <p className="flex items-center gap-2 text-sm font-medium text-warning">
                      <IconWarn className="h-4 w-4" />
                      Il vous manque{" "}
                      <strong className="tabular-nums">
                        {formatXof(missing)}
                      </strong>
                    </p>
                    {/* On emporte la somme manquante : la page de recharge
                        la pré-remplit. Avant, le client arrivait sur un
                        formulaire vide et devait la retenir de tête — beaucoup
                        reprenaient le plus petit palier, trop petit pour
                        acheter, et payaient pour rien. Arrondi à la centaine
                        supérieure : un montant Mobile Money propre. */}
                    <ButtonLink
                      href={`/wallet?montant=${Math.ceil(missing / 100) * 100}`}
                      variant="accent"
                      size="lg"
                      className="w-full"
                    >
                      Recharger mon compte
                    </ButtonLink>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/** Drapeau du pays (image décorative : le nom du pays est juste à côté). */
function CountryFlag({ iso }: { iso: string | null }) {
  if (!iso) {
    return (
      <span className="flex h-5 w-7 shrink-0 items-center justify-center rounded-sm bg-border text-muted">
        <IconGlobe className="h-4 w-4" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${iso}.png`}
      alt=""
      width={26}
      height={20}
      loading="lazy"
      className="h-5 w-7 shrink-0 rounded-sm object-cover ring-1 ring-black/5"
    />
  );
}
