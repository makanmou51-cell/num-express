import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listTransactions } from "@/lib/wallet";
import { reconcilePendingTopups } from "@/lib/payments";
import { Alert, Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { TopupForm } from "./topup-form";

export const metadata: Metadata = { title: "Mon solde" };
// Laisse le temps à LeekPay (création de paiement) et à la réconciliation.
export const maxDuration = 60;

const TYPE_LABEL: Record<string, string> = {
  TOPUP: "Recharge",
  PURCHASE: "Achat",
  REFUND: "Remboursement",
  ADJUSTMENT: "Ajustement",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  COMPLETED: "Validé",
  FAILED: "Échoué",
  CANCELLED: "Annulé",
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string }>;
}) {
  const user = await requireUser();
  const { topup } = await searchParams;

  // On interroge le prestataire pour toute recharge en attente et on crédite si
  // payé (ne fait des appels API que s'il existe des PENDING). Fonctionne sans
  // webhook — utile en local et robuste si le return_url est tronqué.
  const credited = await reconcilePendingTopups(user.id);
  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: { balance: true },
  });
  const balance = fresh?.balance ?? user.balance;

  const txs = await listTransactions(user.id, 30);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mon solde</h1>

      {credited > 0 && (
        <Alert variant="success">
          Paiement confirmé : votre solde a été crédité. Merci !
        </Alert>
      )}
      {topup === "retour" && credited === 0 && (
        <Alert variant="info">
          Merci ! Si le paiement vient d'être effectué, votre solde sera crédité
          dès sa confirmation par le prestataire (patientez quelques instants
          puis rafraîchissez).
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <p className="text-sm text-muted">Solde disponible</p>
          <p className="mt-1 text-3xl font-bold">{formatXof(balance)}</p>
          <div className="mt-6">
            <h2 className="mb-3 font-semibold">Recharger</h2>
            <TopupForm />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-semibold">Historique</h2>
          {txs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Aucune transaction.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {txs.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">
                      {TYPE_LABEL[t.type] ?? t.type}
                      {t.status !== "COMPLETED" && (
                        <span className="ml-2 text-xs text-muted">
                          ({STATUS_LABEL[t.status] ?? t.status})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(t.createdAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <span
                    className={
                      t.amount >= 0
                        ? "font-semibold text-green-700"
                        : "font-semibold text-red-600"
                    }
                  >
                    {t.amount >= 0 ? "+" : ""}
                    {formatXof(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
