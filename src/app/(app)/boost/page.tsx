import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { Card } from "@/components/ui";
import { IconBoost } from "@/components/icons";
import { BOOST_CATALOG, tierIsLive } from "@/lib/boost/catalog";
import { listBoostOrders, refreshUserBoosts } from "@/lib/boost/orders";
import { BoostForm } from "./boost-form";
import { BoostOrders } from "./boost-orders";

export const metadata: Metadata = { title: "Boost réseaux sociaux" };
export const maxDuration = 60;

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
          Followers, j&apos;aime et vues pour TikTok, Instagram, Facebook et
          plus — payés avec ton solde.
        </p>
      </div>

      {configured ? (
        <BoostForm catalog={live} balance={user.balance} />
      ) : (
        <Card className="p-8 text-center">
          <IconBoost className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 font-semibold">Boost bientôt disponible</p>
          <p className="mt-1 text-sm text-muted">
            Cette section est en cours d&apos;activation. Reviens très vite.
          </p>
        </Card>
      )}

      {/* Mes commandes */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Mes commandes</h2>
        <BoostOrders
          orders={orders.map((o) => ({
            id: o.id,
            serviceLabel: o.serviceLabel,
            quantity: o.quantity,
            priceXof: o.priceXof,
            status: o.status,
            createdAt: o.createdAt.toISOString(),
            startCount: o.startCount ?? null,
            remains: o.remains ?? null,
          }))}
        />
      </Card>
    </div>
  );
}
