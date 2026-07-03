import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";
import { Alert, Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { SimulateButton } from "./simulate-button";

export const metadata: Metadata = { title: "Simulation de paiement" };

export default async function SimulatePage({
  searchParams,
}: {
  searchParams: Promise<{ tx?: string }>;
}) {
  const user = await requireUser();
  const { tx } = await searchParams;

  // Disponible uniquement en mode manuel (pas de vrai prestataire actif).
  if (getPaymentProvider().name !== "manual" || !tx) notFound();

  const transaction = await prisma.transaction.findFirst({
    where: { id: tx, userId: user.id, type: "TOPUP" },
  });
  if (!transaction) notFound();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Simulation de paiement</h1>
      <Alert variant="info">
        Mode développement : aucun paiement réel. Configurez FedaPay pour
        encaisser de vrais Mobile Money.
      </Alert>
      <Card className="space-y-4 p-6">
        <div>
          <p className="text-sm text-muted">Montant à payer</p>
          <p className="text-2xl font-bold">{formatXof(transaction.amount)}</p>
        </div>
        {transaction.status === "COMPLETED" ? (
          <Alert variant="success">Cette recharge est déjà validée.</Alert>
        ) : (
          <SimulateButton txId={transaction.id} />
        )}
      </Card>
    </div>
  );
}
