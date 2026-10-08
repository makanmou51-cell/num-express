import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import {
  RENTALS_ENABLED,
  RENT_DURATIONS,
  getRentCatalog,
  getRentServiceList,
  isValidDuration,
  durationLabel,
  type RentOffer,
} from "@/lib/rentals";
import { Alert, Card } from "@/components/ui";
import { ServiceIcon } from "@/components/service-icon";
import { formatXof } from "@/lib/pricing";
import { RentServices } from "./rent-services";
import { RentCountryList } from "./rent-country-list";

// Le catalogue location interroge plusieurs pays : on laisse le temps.
export const maxDuration = 60;
export const metadata: Metadata = { title: "Location de numéro" };

type Search = { service?: string; duration?: string; error?: string };

export default async function LocationPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { service: s, duration: d, error } = await searchParams;
  const user = await requireUser();

  if (!RENTALS_ENABLED) {
    return (
      <Alert variant="info">
        La location de numéros n&apos;est pas disponible actuellement.
      </Alert>
    );
  }

  const services = await getRentServiceList();
  const service = s && services.some((x) => x.code === s) ? s : "wa";
  const durationHours = d && isValidDuration(Number(d)) ? Number(d) : 24;
  const serviceName =
    services.find((x) => x.code === service)?.name ?? service.toUpperCase();

  let offers: RentOffer[] = [];
  let loadError: string | null = null;
  try {
    offers = await getRentCatalog(service, durationHours);
  } catch (e) {
    loadError = (e as Error).message;
  }

  const qs = (hours: number) => `/location?service=${service}&duration=${hours}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Louer un numéro dédié</h1>
          <p className="text-sm text-muted">
            Un numéro rien qu&apos;à vous, qui reçoit plusieurs SMS pendant toute
            la durée.
          </p>
        </div>
        <span className="shrink-0 text-sm text-muted">
          Solde :{" "}
          <strong className="text-foreground">{formatXof(user.balance)}</strong>
        </span>
      </div>

      <Card className="border-primary/30 bg-primary/5 p-4 text-sm">
        <strong className="text-primary">Pourquoi louer ?</strong> Le numéro
        loué est <strong>dédié</strong> (non partagé) et reçoit{" "}
        <strong>plusieurs codes</strong> — c&apos;est la meilleure option pour
        WhatsApp. Plus fiable qu&apos;un numéro « activation » à usage unique.
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {/* 1. Service (recherche + tous les services) */}
      <section className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          1. Service
        </p>
        <RentServices
          services={services}
          active={service}
          durationHours={durationHours}
        />
      </section>

      {/* 2. Durée */}
      <section className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          2. Durée
        </p>
        <div className="flex flex-wrap gap-2">
          {RENT_DURATIONS.map((dr) => {
            const active = dr.hours === durationHours;
            return (
              <Link
                key={dr.hours}
                href={qs(dr.hours)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {dr.label}
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. Pays (recherche) */}
      <section className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          3. Pays —
          <span className="inline-flex items-center gap-1.5 normal-case text-foreground">
            <ServiceIcon code={service} className="h-5 w-5 text-[9px]" />
            {serviceName}
          </span>
        </p>
        {loadError && (
          <Alert variant="error">
            Impossible de charger les pays : {loadError}
          </Alert>
        )}
        {!loadError && offers.length === 0 ? (
          <Card className="p-6 text-center text-muted">
            <p className="font-medium text-foreground">
              {serviceName} n&apos;est pas louable sur{" "}
              {durationLabel(durationHours)}.
            </p>
            <p className="mt-1 text-sm">
              Essayez une <strong>durée plus courte</strong> (1 à 7 jours) ou un
              autre service.
            </p>
          </Card>
        ) : (
          !loadError && (
            <RentCountryList
              service={service}
              durationHours={durationHours}
              userBalance={user.balance}
              offers={offers.map((o) => ({
                countryCode: o.countryCode,
                countryName: o.countryName,
                iso: o.iso,
                quantity: o.quantity,
                priceXof: o.priceXof,
              }))}
            />
          )
        )}
      </section>
    </div>
  );
}
