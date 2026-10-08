import { Suspense } from "react";
import { PushOptIn } from "@/components/push-optin";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { VerifyBanner } from "@/components/verify-banner";
import { getRentServiceList } from "@/lib/rentals";
import { formatXof } from "@/lib/pricing";
import { BuyWizard } from "./buy-wizard";
import { BuySkeleton } from "./buy-skeleton";

export const metadata: Metadata = { title: "Acheter un numéro" };
export const maxDuration = 60;

/**
 * Partie lente isolée : la liste HeroSMS (~800 services, ~1 s au pire) est
 * derrière un <Suspense>, donc l'en-tête et le solde s'affichent sans
 * l'attendre. En cache chaud (cf. getRentServiceList), elle arrive de toute
 * façon immédiatement.
 */
async function ServicePicker({ userBalance }: { userBalance: number }) {
  const services = await getRentServiceList();
  return <BuyWizard services={services} userBalance={userBalance} />;
}

export default async function BuyPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Acheter un numéro</h1>
          <p className="mt-1 text-sm text-muted">
            Choisissez le service, le pays, puis validez.
          </p>
        </div>
        {/* tabular-nums : le montant ne fait plus sauter la ligne quand il change. */}
        <p className="shrink-0 rounded-xl border border-border bg-card px-3 py-2 text-right">
          <span className="block text-xs text-muted">Votre solde</span>
          <strong className="block text-base font-bold tabular-nums">
            {formatXof(user.balance)}
          </strong>
        </p>
      </div>

      {/* Le blocage s'affiche LÀ où il s'applique. Avant, le client
          choisissait son service et son pays, cliquait « Acheter », et était
          renvoyé sur le tableau de bord avec un message — en perdant tout ce
          qu'il venait de sélectionner. */}
      {env.requireEmailVerification && !user.emailVerifiedAt && (
        <VerifyBanner email={user.email} blocking />
      )}

      <PushOptIn variant="banner" />

      <Suspense fallback={<BuySkeleton />}>
        <ServicePicker userBalance={user.balance} />
      </Suspense>
    </div>
  );
}
