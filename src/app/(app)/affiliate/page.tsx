import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getAffiliateStats } from "@/lib/affiliate";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { ButtonLink, Card } from "@/components/ui";
import { IconShare } from "@/components/icons";
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
  const shareText = `Salut ! Sur num express tu achètes un numéro virtuel et tu reçois ton code SMS (Telegram, Google, Instagram…) en quelques secondes, payé en Mobile Money. Inscris-toi ici : ${link}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parrainage</h1>
        <p className="text-muted">
          Gagnez <strong>{pct}%</strong> sur chaque achat de vos filleuls,
          crédité directement sur votre solde.
        </p>
      </div>

      {/* Le gain sort de la grille à trois colonnes : c'est le chiffre qui
          donne envie de partager, il était noyé au même niveau que le nombre
          de filleuls et le code. */}
      <Card className="p-5 text-center">
        <p className="text-sm text-muted">Commissions gagnées</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums text-primary">
          {formatXof(stats.totalEarned)}
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-muted">Filleuls</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {stats.referralsCount}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Votre code</p>
          <p className="mt-1 font-mono text-2xl font-bold">{user.referralCode}</p>
        </Card>
      </div>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Votre lien de parrainage</h2>

        {/* Partage en un geste : WhatsApp est le canal réel de nos clients,
            et le message part déjà rédigé. C'était le seul moyen de partager
            auparavant : copier le lien, ouvrir WhatsApp, coller. */}
        <ButtonLink
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          variant="accent"
          size="lg"
          className="w-full"
        >
          <IconShare className="h-5 w-5" />
          Partager sur WhatsApp
        </ButtonLink>

        {/* break-all et non truncate : un lien coupé par des points de
            suspension ne peut être ni lu ni recopié à la main. */}
        <code className="block break-all rounded-lg border bg-gray-50 px-3 py-2.5 text-sm">
          {link}
        </code>
        <CopyButton
          value={link}
          label="Copier le lien"
          size="md"
          className="w-full"
        />
        <p className="text-sm text-muted">
          Toute personne qui s&apos;inscrit via ce lien devient votre filleul à
          vie.
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
