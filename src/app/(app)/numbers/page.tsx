import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listActivations, refundExpiredForUser } from "@/lib/activations";
import { listRentals, durationLabel } from "@/lib/rentals";
import { ButtonLink } from "@/components/ui";
import { NumbersList, type NumItem } from "./numbers-list";

export const metadata: Metadata = { title: "Mes numéros" };

export default async function NumbersPage() {
  const user = await requireUser();
  // Libère le solde des numéros expirés sans code (auto-remboursement).
  await refundExpiredForUser(user.id);

  // « Mes numéros » regroupe DEUX choses : les activations (code unique) ET les
  // locations (numéro dédié). Sans les locations ici, un client qui loue ne
  // retrouvait son numéro nulle part.
  const [activations, rentals] = await Promise.all([
    listActivations(user.id),
    listRentals(user.id),
  ]);

  const items: NumItem[] = [
    ...activations.map((a) => ({
      id: a.id,
      kind: "activation" as const,
      href: `/numbers/${a.id}`,
      serviceCode: a.serviceCode,
      serviceName: a.serviceName,
      countryName: a.countryName,
      countryCode: a.countryCode,
      status: a.status,
      code: a.smsCode,
      phoneNumber: a.phoneNumber,
      priceXof: a.priceXof,
      createdAt: a.createdAt.toISOString(),
    })),
    ...rentals.map((r) => ({
      id: r.id,
      kind: "rental" as const,
      href: `/location/${r.id}`,
      serviceCode: r.serviceCode,
      serviceName: r.serviceName,
      countryName: r.countryName,
      countryCode: r.countryCode,
      status: r.status,
      code: r.lastCode,
      phoneNumber: r.phoneNumber,
      priceXof: r.priceXof,
      createdAt: r.createdAt.toISOString(),
      durationLabel: durationLabel(r.durationHours),
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes numéros</h1>
        <ButtonLink href="/buy" size="sm">
          Acheter
        </ButtonLink>
      </div>

      <NumbersList items={items} />
    </div>
  );
}
