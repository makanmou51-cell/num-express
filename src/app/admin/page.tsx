import type { Metadata } from "next";
import { getAdminStats } from "@/lib/admin";
import { Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";

export const metadata: Metadata = { title: "Admin — Vue d'ensemble" };

export default async function AdminHome() {
  const s = await getAdminStats();

  const cards = [
    { label: "Utilisateurs", value: s.users.toLocaleString("fr-FR") },
    { label: "Activations", value: s.activations.toLocaleString("fr-FR") },
    { label: "Ventes brutes", value: formatXof(s.grossSales) },
    { label: "Recharges validées", value: formatXof(s.topups) },
    { label: "Soldes clients (passif)", value: formatXof(s.liabilities) },
    { label: "Commissions versées", value: formatXof(s.commissions) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Vue d'ensemble</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-sm text-muted">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
