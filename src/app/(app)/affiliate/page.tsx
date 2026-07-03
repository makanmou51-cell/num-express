import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getAffiliateStats } from "@/lib/affiliate";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { Card } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { formatXof } from "@/lib/pricing";

export const metadata: Metadata = { title: "Parrainage" };

export default async function AffiliatePage() {
  const user = await requireUser();
  const [stats, settings] = await Promise.all([
    getAffiliateStats(user.id),
    getSettings(),
  ]);

  const link = `${env.appUrl}/register?ref=${user.referralCode}`;
  const pct = Math.round(settings.commissionRate * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parrainage</h1>
        <p className="text-muted">
          Gagnez <strong>{pct}%</strong> sur chaque achat de vos filleuls,
          crédité directement sur votre solde.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Filleuls</p>
          <p className="mt-1 text-2xl font-bold">{stats.referralsCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Commissions gagnées</p>
          <p className="mt-1 text-2xl font-bold">{formatXof(stats.totalEarned)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Votre code</p>
          <p className="mt-1 font-mono text-2xl font-bold">{user.referralCode}</p>
        </Card>
      </div>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Votre lien de parrainage</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <code className="flex-1 truncate rounded-lg border bg-gray-50 px-3 py-2.5 text-sm">
            {link}
          </code>
          <CopyButton value={link} label="Copier le lien" size="md" />
        </div>
        <p className="text-sm text-muted">
          Partagez ce lien : toute personne qui s'inscrit via celui-ci devient
          votre filleul à vie.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Mes filleuls</h2>
        {stats.referrals.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Aucun filleul pour l'instant. Partagez votre lien !
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {stats.referrals.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <span className="font-medium">{r.name ?? r.email}</span>
                <span className="text-muted">
                  {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
