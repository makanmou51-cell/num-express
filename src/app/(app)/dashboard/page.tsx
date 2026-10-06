import { requireUser } from "@/lib/auth";
import { TrackOnce } from "@/components/track-once";
import { PushOptIn } from "@/components/push-optin";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { listActivations, refundExpiredForUser } from "@/lib/activations";
import { Alert, Card, ButtonLink } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { VerifyBanner } from "@/components/verify-banner";
import { RecentActivations } from "./recent-activations";

const TONES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  green: "bg-primary/10 text-primary",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; bienvenue?: string }>;
}) {
  const user = await requireUser();
  const { error, bienvenue } = await searchParams;
  // Rembourse les numéros expirés sans code, puis relit le solde à jour.
  await refundExpiredForUser(user.id);
  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: { balance: true },
  });
  const balance = fresh?.balance ?? user.balance;
  // On en récupère plus que 5 : le filtre « Actives » masque les annulées.
  const recent = (await listActivations(user.id, 20)) ?? [];

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Recrutement d abonnés aux notifications. Ne declenche rien tout
          seul : la demande du navigateur n arrive qu au clic. */}
      <PushOptIn variant="banner" />
      {!user.emailVerifiedAt && (
        <VerifyBanner
          email={user.email}
          blocking={env.requireEmailVerification}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Solde — carte dégradée premium.
            La salutation « Bonjour X » est remontée DANS cette carte : en bloc
            séparé au-dessus, elle coûtait deux lignes de haut de page et
            repoussait les codes reçus hors du premier écran.
            Couleurs passées aux tokens (--primary-dark) : elles étaient
            écrites en dur, donc invisibles au reste du système. */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-dark to-[#0d5a37] p-5 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl" />
          <p className="text-sm text-white/70">
            Bonjour{user.name ? ` ${user.name}` : ""} · Solde disponible
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">
            {formatXof(balance)}
          </p>
          <ButtonLink
            href="/wallet"
            size="sm"
            variant="outline"
            className="mt-4 border-transparent bg-white text-primary-dark hover:bg-white/90"
          >
            Recharger
          </ButtonLink>
        </div>

        {/* L'action qui fait gagner de l'argent : une seule par écran, en
            accent, pleine largeur. Elle était en petit bouton vert aligné à
            gauche, identique à celui du boost — donc aucune ne ressortait. */}
        <QuickCard
          iconPath="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"
          tone="blue"
          title="Acheter un numéro"
          desc="Code SMS en quelques secondes, ou numéro dédié en location."
          href="/buy"
          cta="Acheter un numéro"
          accent
        />

        <QuickCard
          iconPath="M3 17l6-6 4 4 8-8M21 7v6h-6"
          tone="green"
          title="Boost réseaux"
          desc="Followers, likes et vues pour tes réseaux."
          href="/boost"
          cta="Booster"
          outline
        />
      </div>

      <Card className="p-5">
        <RecentActivations
          activations={recent.map((a) => ({
            id: a.id,
            serviceCode: a.serviceCode,
            serviceName: a.serviceName,
            countryName: a.countryName,
            countryCode: a.countryCode,
            status: a.status,
            smsCode: a.smsCode,
            phoneNumber: a.phoneNumber,
            priceXof: a.priceXof,
            createdAt: a.createdAt.toISOString(),
          }))}
        />
      </Card>
    </div>
  );
}

function QuickCard({
  iconPath,
  tone,
  title,
  desc,
  href,
  cta,
  outline = false,
  accent = false,
}: {
  iconPath: string;
  tone: keyof typeof TONES;
  title: string;
  desc: string;
  href: string;
  cta: string;
  outline?: boolean;
  /** Action dominante de l'écran : grand bouton orange pleine largeur. */
  accent?: boolean;
}) {
  return (
    <Card className="flex flex-col justify-between p-5">
      <div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${TONES[tone]}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={iconPath} />
          </svg>
        </div>
        <p className="mt-4 font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted">{desc}</p>
      </div>
      <ButtonLink
        href={href}
        size={accent ? "lg" : "md"}
        variant={accent ? "accent" : outline ? "outline" : "primary"}
        className="mt-4 w-full"
      >
        {cta}
      </ButtonLink>
    </Card>
  );
}
