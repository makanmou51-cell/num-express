import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { FEATURED_SERVICES, serviceLabel, SERVICE_LABELS } from "@/lib/grizzly/catalog";

export const metadata: Metadata = { title: "Acheter un numéro" };

export default function BuyPage() {
  // Services mis en avant d'abord, puis le reste du catalogue connu.
  const rest = Object.keys(SERVICE_LABELS).filter(
    (c) => !FEATURED_SERVICES.includes(c),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Choisissez un service</h1>
        <p className="text-muted">
          Pour quel service avez-vous besoin d'un numéro&nbsp;?
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Populaires
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FEATURED_SERVICES.map((code) => (
            <ServiceCard key={code} code={code} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Autres services
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {rest.map((code) => (
            <ServiceCard key={code} code={code} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ServiceCard({ code }: { code: string }) {
  return (
    <Link href={`/buy/${code}`}>
      <Card className="px-4 py-5 text-center font-medium transition-colors hover:border-primary">
        {serviceLabel(code)}
      </Card>
    </Link>
  );
}
