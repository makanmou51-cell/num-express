import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getAccountAdminStats, listAllAccountOrders } from "@/lib/admin";
import { env } from "@/lib/env";
import { Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { formatWhen } from "@/lib/datetime";

export const metadata: Metadata = { title: "Admin — Comptes" };
export const maxDuration = 60;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En préparation",
  DELIVERED: "Livré",
  CHECK: "Vérification…",
  FAILED: "Échoué — non débité",
  REFUNDED: "Remboursé",
};
const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  DELIVERED: "bg-green-100 text-green-800",
  CHECK: "bg-blue-100 text-blue-700",
  FAILED: "bg-gray-200 text-gray-600",
  REFUNDED: "bg-gray-200 text-gray-600",
};

function Stat({
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
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export default async function AdminComptesPage() {
  await requireAdmin();
  const [stats, orders] = await Promise.all([
    getAccountAdminStats(),
    listAllAccountOrders(30),
  ]);

  const bal = stats.acckitBalance; // VND (null = AccKit injoignable)
  /* Seuil d'alerte : un compte Facebook Europe coûte jusqu'à ~380 000 VND.
     En dessous, les produits les plus chers échouent déjà — et un solde vide
     fait échouer TOUTES les ventes d'un coup (même situation que HeroSMS en
     août : on le dit fort plutôt qu'en petit gris). */
  const SEUIL_ALERTE = 400_000;
  const soldeBas = bal !== null && bal < SEUIL_ALERTE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Comptes réseaux sociaux</h1>
        <p className="text-muted">Suivi des ventes de comptes (via AccKit).</p>
      </div>

      {/* Solde AccKit (ton stock) — vire au rouge quand il devient critique. */}
      <div
        className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg ${
          soldeBas
            ? "bg-gradient-to-br from-red-700 to-red-900"
            : "bg-gradient-to-br from-violet-700 to-violet-900"
        }`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
        <p className="text-sm text-white/70">Solde AccKit (ton stock)</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight">
          {bal !== null ? `${bal.toLocaleString("fr-FR")} VND` : "—"}
        </p>
        {bal !== null && (
          <p className="mt-1 text-xs text-white/60">
            ≈ {formatXof(Math.round(bal / env.acckit.vndPerXof))}
          </p>
        )}
        {soldeBas ? (
          <p className="mt-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold">
            Recharge maintenant sur acckit.com. Un compte Facebook coûte
            jusqu&apos;à ~380 000 VND — solde vide = toutes les ventes Comptes
            échouent.
          </p>
        ) : (
          <p className="mt-1 text-xs text-white/60">
            Recharge sur acckit.com quand ça baisse.
          </p>
        )}
      </div>

      {/* Indicateurs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Chiffre d'affaires Comptes"
          value={formatXof(stats.revenueXof)}
          hint="hors remboursés"
        />
        <Stat label="Commandes totales" value={String(stats.total)} />
        <Stat label="Livrées" value={String(stats.delivered)} />
        <Stat label="En attente" value={String(stats.pending)} />
      </div>

      {/* Dernières commandes */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Dernières commandes</h2>
        {orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted">
            Aucune commande de comptes pour l'instant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <ul className="min-w-[520px] divide-y">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {o.productName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {o.user.email} · ×{o.quantity} ·{" "}
                      {formatWhen(o.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">
                    {formatXof(o.priceXof)}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      STATUS_CLASS[o.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
