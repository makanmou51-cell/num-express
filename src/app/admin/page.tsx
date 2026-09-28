import Link from "next/link";
import type { Metadata } from "next";
import {
  getAdminStats,
  getSalesData,
  listRecentTopups,
  listRecentPurchases,
} from "@/lib/admin";
import { Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { formatWhen } from "@/lib/datetime";
import { SalesChart } from "./sales-chart";

export const metadata: Metadata = { title: "Admin — Vue d'ensemble" };

export default async function AdminHome() {
  const [s, sales, topups, purchases] = await Promise.all([
    getAdminStats(),
    getSalesData(),
    listRecentTopups(15),
    listRecentPurchases(15),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Vue d'ensemble</h1>

      {/* Chiffre d'affaires réel (recharges) — la vraie mesure */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-dark to-[#0d5a37] p-6 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl" />
          <p className="text-sm text-white/70">Chiffre d'affaires réel</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">
            {formatXof(s.topups)}
          </p>
          <p className="mt-2 text-xs text-white/60">
            Paiements Mobile Money encaissés
            {s.manualCredits > 0 && (
              <>
                {" · "}
                {formatXof(s.manualCredits)} crédités à la main, non comptés
              </>
            )}
          </p>
        </div>

        <Tile label="Utilisateurs" value={s.users.toLocaleString("fr-FR")} />
        <Tile
          label="Activations"
          value={s.activations.toLocaleString("fr-FR")}
        />
      </div>

      {/* Recharges récentes + Achats récents (accès rapide) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityCard
          title="💳 Recharges récentes"
          empty="Aucune recharge pour l'instant."
          positive
          rows={topups.map((t) => ({
            id: t.id,
            userId: t.userId,
            email: t.user?.email ?? "—",
            sub: t.provider ?? "recharge",
            amount: t.amount,
            when: t.createdAt,
          }))}
        />
        <ActivityCard
          title="🛒 Achats récents"
          empty="Aucun achat pour l'instant."
          rows={purchases.map((t) => ({
            id: t.id,
            userId: t.userId,
            email: t.user?.email ?? "—",
            sub: t.description ?? "achat",
            amount: Math.abs(t.amount),
            when: t.createdAt,
          }))}
        />
      </div>

      {/* Graphique des ventes dans le temps */}
      <Card className="p-5 sm:p-6">
        <SalesChart topups={sales.topups} />
      </Card>

      {/* Autres indicateurs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          label="Ventes brutes"
          value={formatXof(s.grossSales)}
          hint="avant remboursements (WhatsApp échoués inclus)"
        />
        <Tile
          label="Soldes clients (passif)"
          value={formatXof(s.liabilities)}
          hint="argent des clients encore sur leur solde"
        />
        <Tile label="Commissions versées" value={formatXof(s.commissions)} />
      </div>
    </div>
  );
}

type ActivityRow = {
  id: string;
  userId: string;
  email: string;
  sub: string;
  amount: number;
  when: Date;
};

function ActivityCard({
  title,
  empty,
  rows,
  positive = false,
}: {
  title: string;
  empty: string;
  rows: ActivityRow[];
  positive?: boolean;
}) {
  return (
    <Card className="p-5">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted">
          {empty}
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/users/${r.userId}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.email}</p>
                  <p className="truncate text-xs text-muted">
                    {r.sub} · {formatWhen(r.when)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    positive ? "text-green-600" : "text-foreground"
                  }`}
                >
                  {positive ? "+" : ""}
                  {formatXof(r.amount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}
