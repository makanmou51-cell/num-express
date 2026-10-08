import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { isGrizzlyMock } from "@/lib/grizzly/client";
import {
  getCatalogForService,
  serviceLabel,
  type CatalogOffer,
} from "@/lib/grizzly/catalog";
import { Alert, BackLink, BalancePill, Card } from "@/components/ui";
import { ServiceIcon } from "@/components/service-icon";
import { formatXof } from "@/lib/pricing";
import { CountryList } from "./country-list";

// OnlineSim peut être lent : on laisse le temps au catalogue de se construire
// et à l'achat (getNum + retries) d'aboutir sans couper la fonction.
export const maxDuration = 60;

type Params = { service: string };
type Search = { error?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { service } = await params;
  return { title: `Numéro ${serviceLabel(service)}` };
}

export default async function BuyServicePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { service } = await params;
  const { error } = await searchParams;
  const user = await requireUser();

  let offers: CatalogOffer[] = [];
  let loadError: string | null = null;
  try {
    offers = await getCatalogForService(service);
  } catch (e) {
    loadError = (e as Error).message;
    offers = [];
  }

  return (
    <div className="space-y-5">
      <div>
        <BackLink href="/buy" label="Tous les services" />
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {/* Le titre tenait sur trois lignes sur un écran de 360 px : le nom
                du service reste seul sur sa ligne, la consigne passe en
                sous-titre. */}
            <h1 className="flex items-center gap-2.5 text-2xl font-bold">
              <ServiceIcon code={service} className="h-9 w-9 shrink-0 text-sm" />
              <span className="truncate">Numéro {serviceLabel(service)}</span>
            </h1>
            <p className="mt-1 text-sm text-muted">Choisissez le pays.</p>
          </div>
          {/* Même encadré de solde que sur la page d'achat principale. */}
          <BalancePill balance={user.balance} />
        </div>
      </div>

      {isGrizzlyMock && (
        <Alert variant="info">
          Mode démo : prix et numéros simulés. Le code SMS arrivera
          automatiquement ~8 s après l'achat.
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {loadError && (
        <Alert variant="error">
          Impossible de charger les offres : {loadError}
        </Alert>
      )}

      {offers.length === 0 && !loadError ? (
        <Card className="p-8 text-center text-muted">
          Aucun pays disponible pour ce service actuellement.
        </Card>
      ) : (
        <CountryList
          service={service}
          serviceName={serviceLabel(service)}
          offers={offers}
          userBalance={user.balance}
        />
      )}
    </div>
  );
}
