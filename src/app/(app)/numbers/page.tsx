import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listActivations } from "@/lib/activations";
import { ButtonLink, Card } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { formatXof } from "@/lib/pricing";

export const metadata: Metadata = { title: "Mes numéros" };

export default async function NumbersPage() {
  const user = await requireUser();
  const activations = await listActivations(user.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes numéros</h1>
        <ButtonLink href="/buy" size="sm">
          Acheter
        </ButtonLink>
      </div>

      {activations.length === 0 ? (
        <Card className="p-10 text-center text-muted">
          Vous n'avez pas encore acheté de numéro.
        </Card>
      ) : (
        <Card className="divide-y">
          {activations.map((a) => (
            <Link
              key={a.id}
              href={`/numbers/${a.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {a.serviceName ?? a.serviceCode} · {a.countryName ?? a.countryCode}
                </p>
                <p className="truncate text-sm text-muted">
                  {a.phoneNumber}
                  {a.smsCode ? ` — code : ${a.smsCode}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm text-muted">{formatXof(a.priceXof)}</span>
                <StatusBadge status={a.status} />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
