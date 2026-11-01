import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { Badge, Card } from "@/components/ui";
import { AccountCredentials } from "@/components/account-credentials";
import { AccountGuide } from "@/components/account-guide";
import { formatXof } from "@/lib/pricing";
import { formatWhen } from "@/lib/datetime";
import { getCatalog } from "@/lib/acckit/catalog";
import {
  listAccountOrders,
  refreshUserAccountOrders,
} from "@/lib/acckit/orders";
import { CatalogBrowser } from "./catalog-browser";

export const metadata: Metadata = { title: "Comptes réseaux sociaux" };
/* /buy peut mettre jusqu'à ~50 s chez AccKit (fournisseur lent). Sans ce
   plafond explicite, Vercel coupe la fonction plus tôt et la commande
   resterait sans trace — le statut CHECK existe pour ce cas. */
export const maxDuration = 60;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En préparation",
  DELIVERED: "Livré",
  CHECK: "Vérification…",
  FAILED: "Échoué — non débité",
};
const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  DELIVERED: "bg-green-100 text-green-800",
  CHECK: "bg-blue-100 text-blue-700",
  FAILED: "bg-gray-200 text-gray-600",
};

export default async function ComptesPage() {
  const user = await requireUser();
  await refreshUserAccountOrders(user.id);
  const orders = await listAccountOrders(user.id, 20);

  const configured = Boolean(env.acckit.apiKey);
  let catalogError = false;
  let catalog: Awaited<ReturnType<typeof getCatalog>> = [];
  if (configured) {
    try {
      catalog = await getCatalog();
    } catch {
      catalogError = true;
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Comptes réseaux sociaux</h1>
        <p className="text-muted">
          Comptes TikTok, Facebook (France, Allemagne, Royaume-Uni) et
          Instagram — livrés immédiatement, payés avec ton solde.
        </p>
      </div>

      {!configured && (
        <Card className="p-5 text-sm text-muted">
          Ce service est en cours de configuration. Reviens bientôt !
        </Card>
      )}
      {configured && catalogError && (
        <Card className="p-5 text-sm text-muted">
          Le catalogue ne répond pas pour l&apos;instant. Réessaie dans quelques
          minutes.
        </Card>
      )}

      {/* Catalogue : onglets par réseau + recherche (CatalogBrowser). */}
      {configured && !catalogError && catalog.length > 0 && (
        <CatalogBrowser sections={catalog} />
      )}

      {/* Commandes du client : identifiants livrés ici. */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mes commandes de comptes</h2>
        {orders.length === 0 ? (
          <Card className="p-5 text-sm text-muted">
            Aucune commande pour l&apos;instant.
          </Card>
        ) : (
          orders.map((o) => (
            <Card key={o.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{o.productName}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {o.categoryName ? `${o.categoryName} · ` : ""}×{o.quantity}{" "}
                    · {formatXof(o.priceXof)} · {formatWhen(o.createdAt)}
                  </p>
                </div>
                <Badge
                  className={
                    STATUS_CLASS[o.status] ?? "bg-gray-200 text-gray-600"
                  }
                >
                  {STATUS_LABEL[o.status] ?? o.status}
                </Badge>
              </div>

              {o.status === "PENDING" && (
                <p className="text-xs text-muted">
                  Le fournisseur prépare les comptes — recharge cette page dans
                  quelques minutes.
                </p>
              )}
              {o.status === "CHECK" && (
                <p className="text-xs text-muted">
                  Vérification en cours auprès du fournisseur. Aucun débit tant
                  que la commande n&apos;est pas confirmée.
                </p>
              )}

              {/* Identifiants = secrets du client : étiquetés, masqués par
                  défaut, et tenus hors des enregistrements de session (comme
                  les codes SMS) par data-clarity-mask dans le composant. */}
              {o.accounts && (
                <>
                  <AccountCredentials accounts={o.accounts} />
                  <AccountGuide />
                </>
              )}
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
