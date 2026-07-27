import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listActivations } from "@/lib/activations";
import { Alert, Card, ButtonLink } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { StatusBadge } from "@/components/status-badge";
import { VerifyBanner } from "@/components/verify-banner";
import { ServiceIcon } from "@/components/service-icon";
import { formatWhen } from "@/lib/datetime";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const recent = (await listActivations(user.id, 5)) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Bonjour{user.name ? `, ${user.name}` : ""} 👋
        </h1>
        <p className="text-muted">Bienvenue sur votre espace num express.</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {!user.emailVerifiedAt && <VerifyBanner />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Solde disponible</p>
          <p className="mt-1 text-2xl font-bold">{formatXof(user.balance)}</p>
          <ButtonLink href="/wallet" size="sm" className="mt-3">
            Recharger
          </ButtonLink>
        </Card>
        <Card className="flex flex-col justify-between p-5">
          <div>
            <p className="font-semibold">Acheter un numéro</p>
            <p className="mt-1 text-sm text-muted">
              Choisissez un service et un pays.
            </p>
          </div>
          <ButtonLink href="/buy" size="sm" className="mt-3 self-start">
            Commencer
          </ButtonLink>
        </Card>
        <Card className="flex flex-col justify-between p-5">
          <div>
            <p className="font-semibold">Mes numéros</p>
            <p className="mt-1 text-sm text-muted">
              Suivez vos activations et vos codes.
            </p>
          </div>
          <ButtonLink href="/numbers" variant="outline" size="sm" className="mt-3 self-start">
            Voir
          </ButtonLink>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Activations récentes</h2>
          <Link href="/numbers" className="text-sm text-primary hover:underline">
            Tout voir
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted">
              Aucune activation pour l'instant.
            </p>
            <ButtonLink href="/buy" size="sm" className="mt-3">
              Acheter mon premier numéro
            </ButtonLink>
          </div>
        ) : (
          <ul className="divide-y">
            {recent.map((a) => {
              const received = a.status === "RECEIVED" || a.status === "COMPLETED";
              return (
                <li key={a.id}>
                  <Link
                    href={`/numbers/${a.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
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
                      {received && a.smsCode ? (
                        <p className="mt-0.5 text-sm">
                          <span className="text-muted">Code : </span>
                          <span className="font-mono font-semibold tracking-wider text-primary">
                            {a.smsCode}
                          </span>
                        </p>
                      ) : (
                        <p className="mt-0.5 truncate font-mono text-xs text-muted">
                          {a.phoneNumber || "Numéro en attribution…"}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={a.status} />
                      <span className="text-[11px] text-muted">
                        {formatWhen(a.createdAt)} · {formatXof(a.priceXof)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
