import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listTransactions, numberPriceRange } from "@/lib/wallet";
import { reconcilePendingTopups } from "@/lib/payments";
import { Alert, Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { TopupForm } from "./topup-form";
import { TopupPending } from "./topup-pending";
import { WalletHistory } from "./wallet-history";

export const metadata: Metadata = { title: "Mon solde" };
// Laisse le temps à LeekPay (création de paiement) et à la réconciliation.
export const maxDuration = 60;

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string; montant?: string }>;
}) {
  const user = await requireUser();
  const { topup, montant } = await searchParams;

  /* Somme transmise par l'écran d'achat (« Il vous manque X »). Bornée :
     le paramètre vient de l'URL, donc du client. */
  const suggere =
    Math.min(Math.max(Number(montant) || 0, 0), 500_000) || undefined;

  // On interroge le prestataire pour toute recharge en attente et on crédite si
  // payé (ne fait des appels API que s'il existe des PENDING). Fonctionne sans
  // webhook — utile en local et robuste si le return_url est tronqué.
  const credited = await reconcilePendingTopups(user.id);
  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: { balance: true },
  });
  const balance = fresh?.balance ?? user.balance;

  const [txs, prix] = await Promise.all([
    listTransactions(user.id, 30),
    numberPriceRange(),
  ]);
  // Recharge en attente la plus récente : sert de clé au compteur de
  // vérifications, pour qu'un nouveau paiement reparte de zéro.
  const pendingId =
    txs.find((t) => t.type === "TOPUP" && t.status === "PENDING")?.id ?? null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mon solde</h1>

      {credited > 0 && (
        <Alert variant="success">
          Paiement confirmé : votre solde a été crédité. Merci !
        </Alert>
      )}
      {topup === "retour" && credited === 0 && (
        <TopupPending pendingId={pendingId} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* Solde — carte dégradée premium */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-dark to-[#0d5a37] p-6 text-white shadow-lg">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl" />
            <p className="text-sm text-white/70">Solde disponible</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight">
              {formatXof(balance)}
            </p>
          </div>

          <Card className="p-6">
            <h2 className="mb-3 font-semibold">Recharger</h2>
            <TopupForm prix={prix} suggere={suggere} />
          </Card>
        </div>

        <Card className="p-6">
          <WalletHistory
            transactions={txs.map((t) => ({
              id: t.id,
              type: t.type,
              amount: t.amount,
              status: t.status,
              createdAt: t.createdAt.toISOString(),
              activationId: t.activationId,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
