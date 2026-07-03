import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { isGrizzlyMock } from "@/lib/grizzly/client";
import {
  getCatalogForService,
  serviceLabel,
  type CatalogOffer,
} from "@/lib/grizzly/catalog";
import { purchaseAction } from "@/app/(app)/actions";
import { Alert, ButtonLink, Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatXof } from "@/lib/pricing";

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/buy" className="text-sm text-primary hover:underline">
            ← Tous les services
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            {serviceLabel(service)} — choisissez un pays
          </h1>
        </div>
        <span className="shrink-0 text-sm text-muted">
          Solde : <strong className="text-foreground">{formatXof(user.balance)}</strong>
        </span>
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
        <Card className="divide-y">
          {offers.map((o) => {
            const affordable = user.balance >= o.priceXof;
            return (
              <div
                key={o.countryCode}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{o.countryName}</p>
                  <p className="text-sm text-muted">
                    {o.count.toLocaleString("fr-FR")} disponibles
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold">{formatXof(o.priceXof)}</span>
                  {affordable ? (
                    <form action={purchaseAction}>
                      <input type="hidden" name="service" value={service} />
                      <input type="hidden" name="country" value={o.countryCode} />
                      <SubmitButton size="sm" pendingLabel="Achat…">
                        Acheter
                      </SubmitButton>
                    </form>
                  ) : (
                    <ButtonLink href="/wallet" size="sm" variant="outline">
                      Recharger
                    </ButtonLink>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
