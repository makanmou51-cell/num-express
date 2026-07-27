import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listTransactions } from "@/lib/wallet";
import { reconcilePendingTopups } from "@/lib/payments";
import { Alert, Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { formatWhen } from "@/lib/datetime";
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
const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-200 text-gray-600",
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
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm text-muted">Aucune transaction pour l'instant.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {txs.map((t) => {
                const credit = t.amount >= 0;
                const faded = t.status === "FAILED" || t.status === "CANCELLED";
                return (
                  <li
                    key={t.id}
                    className={`flex items-center gap-3 py-3 ${faded ? "opacity-60" : ""}`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                        credit
                          ? "bg-green-100 text-green-700"
                          : "bg-rose-100 text-rose-600"
                      }`}
                      aria-hidden
                    >
                      {credit ? "+" : "−"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium">
                          {TYPE_LABEL[t.type] ?? t.type}
                        </span>
                        {t.status !== "COMPLETED" && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              STATUS_CLASS[t.status] ?? "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {STATUS_LABEL[t.status] ?? t.status}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatWhen(t.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-semibold ${
                        credit ? "text-green-700" : "text-rose-600"
                      }`}
                    >
                      {credit ? "+" : "−"}
                      {formatXof(Math.abs(t.amount))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
