import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getBoostAdminStats, listAllBoostOrders } from "@/lib/admin";
import { sweepPendingBoosts } from "@/lib/boost/orders";
import { Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { formatWhen } from "@/lib/datetime";
import { RefillButton } from "./refill-button";

export const metadata: Metadata = { title: "Admin — Boost" };
export const maxDuration = 60;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  PROCESSING: "En traitement",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  PARTIAL: "Partiel",
  CANCELED: "Annulé",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
};
const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PROCESSING: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-800",
  PARTIAL: "bg-violet-100 text-violet-700",
  CANCELED: "bg-gray-200 text-gray-600",
  FAILED: "bg-red-100 text-red-700",
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

export default async function AdminBoostPage() {
  /* On interroge Peakerr AVANT d'afficher. Sans ca la page montrait « En
     cours » sur des commandes que Peakerr avait terminees ou annulees depuis
     des semaines : le statut n'etait rafraichi que si le CLIENT rouvrait sa
     propre page /boost. Deadline courte : l'admin ne doit pas attendre. */
  await sweepPendingBoosts({ limit: 25, deadlineMs: 12_000 }).catch(() => {});

  await requireAdmin();
  const [stats, orders] = await Promise.all([
    getBoostAdminStats(),
    listAllBoostOrders(30),
  ]);

  const peak = stats.peakerrBalance;
  /* Seuil d'alerte : une commande TikTok Followers de 1000 coute ~5,80 $.
     En dessous de 15 $ il ne reste donc que deux ou trois commandes avant
     que TOUT echoue - c'est exactement ce qui a fait cesser les ventes sur
     HeroSMS en aout. On le dit fort plutot que de l'ecrire en petit gris. */
  const SEUIL_ALERTE = 15;
  const soldeBas = peak !== null && peak.balance < SEUIL_ALERTE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Boost 🚀</h1>
        <p className="text-muted">
          Suivi des commandes de boost réseaux sociaux.
        </p>
      </div>

      {/* Solde Peakerr (ton stock) — vire au rouge quand il devient critique,
          parce qu'un solde vide fait echouer TOUTES les commandes d'un coup. */}
      <div
        className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg ${
          soldeBas
            ? "bg-gradient-to-br from-red-700 to-red-900"
            : "bg-gradient-to-br from-primary-dark to-[#0d5a37]"
        }`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl" />
        <p className="text-sm text-white/70">Solde Peakerr (ton stock)</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight">
          {peak ? `${peak.balance.toFixed(2)}` : "—"}
        </p>
        {soldeBas ? (
          <p className="mt-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold">
            Recharge maintenant. Une commande TikTok de 1 000 abonnés coûte
            environ 5,80 $ — il te reste{" "}
            {Math.max(0, Math.floor(peak!.balance / 5.8))} commande(s) avant que
            toutes les ventes Boost échouent.
          </p>
        ) : (
          <p className="mt-1 text-xs text-white/60">
            Recharge en crypto sur peakerr.com quand ça baisse.
          </p>
        )}
      </div>

      {/* Indicateurs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Chiffre d'affaires Boost"
          value={formatXof(stats.revenueXof)}
          hint="hors remboursés"
        />
        <Stat label="Commandes totales" value={String(stats.total)} />
        <Stat label="En cours" value={String(stats.inProgress)} />
        <Stat label="Terminées" value={String(stats.done)} />
      </div>

      {/* Dernières commandes */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Dernières commandes</h2>
        {orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted">
            Aucune commande de boost pour l'instant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <ul className="min-w-[520px] divide-y">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {o.serviceLabel}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {o.user.email} · {o.quantity.toLocaleString("fr-FR")} ·{" "}
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
                  {!["REFUNDED", "CANCELED", "FAILED"].includes(o.status) && (
                    <RefillButton id={o.id} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
