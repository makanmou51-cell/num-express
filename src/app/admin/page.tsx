import Link from "next/link";
import type { Metadata } from "next";
import {
  getAdminStats,
  getSalesData,
  listRecentTopups,
  listRecentPurchases,
  getSources,
} from "@/lib/admin";
import { getProfit } from "@/lib/profit";
import { Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { formatWhen } from "@/lib/datetime";
import { SalesChart } from "./sales-chart";

export const metadata: Metadata = { title: "Admin — Vue d'ensemble" };

export default async function AdminHome() {
  const [s, benefice, sales, topups, purchases, sources] = await Promise.all([
    getAdminStats(),
    getProfit(),
    getSalesData(),
    listRecentTopups(15),
    listRecentPurchases(15),
    getSources(30),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Vue d&apos;ensemble</h1>

      {/* Chiffre d'affaires réel (recharges) — la vraie mesure */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-dark to-[#0d5a37] p-6 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl" />
          <p className="text-sm text-white/70">Chiffre d&apos;affaires réel</p>
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

        {/* BENEFICE — a cote du chiffre d'affaires, parce que les deux se
            confondent facilement : l'argent encaisse n'est pas gagne. Une
            partie dort sur les soldes clients (une dette), et sur chaque
            vente il faut retrancher ce qu'on a paye au fournisseur. */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/20 blur-2xl" />
          <p className="text-sm text-white/70">Bénéfice net</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">
            {formatXof(benefice.net)}
          </p>
          <p className="mt-2 text-xs text-white/60">
            Marge sur ce qui a été livré, commissions de parrainage déduites
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

      {/* PROVENANCE DES INSCRITS. Sans ce tableau, juger une campagne
          revient a comparer des moyennes et a esperer que rien d'autre n'ait
          bouge en meme temps. La colonne qui decide n'est pas « inscrits »
          mais « encaisse » : une publicite qui amene cent curieux et zero
          franc n'a rien rapporte. */}
      <Card className="p-5">
        <h2 className="font-semibold">D&apos;où viennent les inscrits — 30 jours</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 font-medium">Provenance</th>
                <th className="pb-2 text-right font-medium">Inscrits</th>
                <th className="pb-2 text-right font-medium">Ont payé</th>
                <th className="pb-2 text-right font-medium">Encaissé</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sources.map((p) => (
                <tr key={p.source}>
                  <td className="py-2.5 font-medium">{p.source}</td>
                  <td className="py-2.5 text-right tabular-nums">{p.inscrits}</td>
                  <td className="py-2.5 text-right tabular-nums">{p.clients}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">
                    {formatXof(p.encaisse)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          La provenance est relevée depuis le 10 octobre 2026. Les comptes
          antérieurs apparaissent sous &laquo;&nbsp;avant la mesure&nbsp;&raquo;.
        </p>
      </Card>

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

      {/* LES RESERVES DU BENEFICE. Un chiffre dont on ignore les limites est
          plus dangereux qu'un chiffre absent : ces deux lignes disent
          exactement ce que « Benefice net » ne contient pas. */}
      <Card className="p-5">
        <h2 className="font-semibold">Ce que le bénéfice ne compte pas</h2>
        <dl className="mt-3 space-y-2.5 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <dt>
              Marge Boost
              <span className="block text-xs text-muted">
                Les prix Boost sont fixés à la main, le coût Peakerr n&apos;est
                pas enregistré — impossible de calculer la marge
              </span>
            </dt>
            <dd className="font-semibold tabular-nums">
              {formatXof(benefice.caBoost)} de CA
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-border pt-2.5">
            <dt>
              Coût des ventes remboursées
              <span className="block text-xs text-muted">
                HeroSMS ne rembourse que <strong>partiellement</strong> une
                activation annulée. Chaque échec coûte donc quelque chose, et ce
                montant n&apos;est écrit nulle part — le bénéfice affiché est{" "}
                <strong>optimiste</strong>.
              </span>
            </dt>
            <dd className="font-semibold tabular-nums text-amber-700">
              {benefice.ventesRemboursees.toLocaleString("fr-FR")} ventes
            </dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
          Détail du calcul : marge numéros{" "}
          <strong>{formatXof(benefice.margeNumeros)}</strong> + marge locations{" "}
          <strong>{formatXof(benefice.margeLocations)}</strong> − commissions{" "}
          <strong>{formatXof(benefice.commissions)}</strong>.
        </p>
      </Card>
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
