import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { Card } from "@/components/ui";
import { StatusDot } from "@/components/status-badge";
import { IconBoost } from "@/components/icons";
import { formatXof } from "@/lib/pricing";
import { formatWhen } from "@/lib/datetime";
import { BOOST_CATALOG, tierIsLive } from "@/lib/boost/catalog";
import { listBoostOrders, refreshUserBoosts } from "@/lib/boost/orders";
import { BoostForm } from "./boost-form";

export const metadata: Metadata = { title: "Boost réseaux sociaux" };
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
// Statut en point vivant + texte discret (même langage que le reste de l'app),
// au lieu de pastilles pastel — dont un violet banni partout ailleurs.
type Tone = "success" | "warning" | "muted" | "destructive";
const STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  PROCESSING: "warning",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  PARTIAL: "warning",
  CANCELED: "muted",
  FAILED: "destructive",
  REFUNDED: "muted",
};
// Les commandes qui travaillent encore : le point bat (« en cours »).
const LIVE = new Set(["PROCESSING", "IN_PROGRESS"]);

export default async function BoostPage() {
  const user = await requireUser();
  await refreshUserBoosts(user.id);
  const orders = await listBoostOrders(user.id, 20);

  // Catalogue « live » : seulement les services dont l'ID Peakerr est renseigné.
  const live = BOOST_CATALOG.map((n) => ({
    ...n,
    services: n.services
      .map((s) => ({ ...s, tiers: s.tiers.filter(tierIsLive) }))
      .filter((s) => s.tiers.length > 0),
  })).filter((n) => n.services.length > 0);

  const configured = Boolean(env.peakerr.apiKey) && live.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Boost réseaux sociaux
        </h1>
        <p className="text-muted">
          Followers, likes et vues pour TikTok, Instagram et Facebook — payés
          avec ton solde.
        </p>
      </div>

      {configured ? (
        <BoostForm catalog={live} balance={user.balance} />
      ) : (
        <Card className="p-8 text-center">
          <IconBoost className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 font-semibold">Boost bientôt disponible</p>
          <p className="mt-1 text-sm text-muted">
            Cette section est en cours d'activation. Reviens très vite !
          </p>
        </Card>
      )}

      {/* Mes commandes */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Mes commandes</h2>
        {orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted">
            Aucune commande pour l'instant.
          </p>
        ) : (
          <ul className="divide-y">
            {orders.map((o) => {
              const delivered = o.startCount != null && o.remains != null
                ? Math.max(0, o.quantity - o.remains)
                : null;
              return (
                <li key={o.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {o.serviceLabel}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-muted">
                      {o.quantity.toLocaleString("fr-FR")} ·{" "}
                      {formatWhen(o.createdAt)} · {formatXof(o.priceXof)}
                      {delivered != null && o.status !== "COMPLETED"
                        ? ` · livré ${delivered.toLocaleString("fr-FR")}/${o.quantity.toLocaleString("fr-FR")}`
                        : ""}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">
                    <StatusDot
                      tone={STATUS_TONE[o.status] ?? "muted"}
                      pulse={LIVE.has(o.status)}
                    />
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
