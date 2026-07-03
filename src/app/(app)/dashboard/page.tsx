import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listActivations } from "@/lib/activations";
import { Alert, Card, ButtonLink } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { StatusBadge } from "@/components/status-badge";
import { VerifyBanner } from "@/components/verify-banner";

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
          <p className="py-6 text-center text-sm text-muted">
            Aucune activation pour l'instant.
          </p>
        ) : (
          <ul className="divide-y">
            {recent.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/numbers/${a.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:opacity-80"
                >
                  <div>
                    <p className="font-medium">
                      {a.serviceName ?? a.serviceCode} · {a.countryName ?? a.countryCode}
                    </p>
                    <p className="text-sm text-muted">{a.phoneNumber}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
