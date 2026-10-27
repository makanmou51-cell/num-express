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
import Link from "next/link";

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

      {/* Mobile : TOUT tient sans scroll — solde compact puis les 3 services
          en raccourcis d'une ligne. Les grandes cartes n'arrivent qu'à
          partir de sm. */}
      <div className="grid gap-2 sm:hidden">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-dark to-[#0d5a37] p-4 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl" />
          <p className="text-sm text-white/70">
            Bonjour{user.name ? ` ${user.name}` : ""} · Solde disponible
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-2xl font-extrabold tabular-nums tracking-tight">
              {formatXof(balance)}
            </p>
            <ButtonLink
              href="/wallet"
              size="sm"
              variant="outline"
              className="border-transparent bg-white text-primary-dark hover:bg-white/90"
            >
              Recharger
            </ButtonLink>
          </div>
        </div>
        <QuickRow
          iconPath="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"
          tone="blue"
          title="Acheter un numéro"
          desc="Code SMS en quelques secondes"
          href="/buy"
        />
        <QuickRow
          iconPath="M3 17l6-6 4 4 8-8M21 7v6h-6"
          tone="green"
          title="Boost réseaux"
          desc="Followers, likes et vues"
          href="/boost"
        />
        <QuickRow
          iconPath="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M1 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"
          tone="violet"
          title="Comptes réseaux sociaux"
          desc="TikTok, Facebook Europe, Instagram"
          href="/comptes"
        />
      </div>

      {/* Tablette et PC : quatre cartes sur une ligne, boutons compacts,
          une couleur par service (orange = numéro, vert = boost,
          violet = comptes). */}
      <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {/* Solde — carte dégradée premium.
            La salutation « Bonjour X » est remontée DANS cette carte : en bloc
            séparé au-dessus, elle coûtait deux lignes de haut de page et
            repoussait les codes reçus hors du premier écran.
            Couleurs passées aux tokens (--primary-dark) : elles étaient
            écrites en dur, donc invisibles au reste du système. */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-dark to-[#0d5a37] p-4 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl" />
          <p className="text-sm text-white/70">
            Bonjour{user.name ? ` ${user.name}` : ""} · Solde disponible
          </p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">
            {formatXof(balance)}
          </p>
          <ButtonLink
            href="/wallet"
            size="sm"
            variant="outline"
            className="mt-3 border-transparent bg-white text-primary-dark hover:bg-white/90"
          >
            Recharger
          </ButtonLink>
        </div>

        {/* L'action qui fait gagner de l'argent : une seule par écran, en
            accent. Elle était en petit bouton vert aligné à gauche, identique
            à celui du boost — donc aucune ne ressortait. */}
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
        />

        <QuickCard
          iconPath="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M1 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"
          tone="violet"
          title="Comptes réseaux sociaux"
          desc="Comptes TikTok, Facebook Europe et Instagram, livrés immédiatement."
          href="/comptes"
          cta="Parcourir"
          violet
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

/* Raccourci d'une ligne (mobile) : icône + titre + description tronquée +
   chevron. Toute la ligne est le lien — la cible tactile fait ~64 px. */
function QuickRow({
  iconPath,
  tone,
  title,
  desc,
  href,
}: {
  iconPath: string;
  tone: keyof typeof TONES;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 transition-colors active:bg-gray-50"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}
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
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted">{desc}</span>
      </span>
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 shrink-0 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </Link>
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
  violet = false,
}: {
  iconPath: string;
  tone: keyof typeof TONES;
  title: string;
  desc: string;
  href: string;
  cta: string;
  outline?: boolean;
  /** Action dominante de l'écran : bouton orange. */
  accent?: boolean;
  /** Couleur du service « Comptes » (surcharge locale, voir [&_a]). */
  violet?: boolean;
}) {
  return (
    <Card className="flex flex-col justify-between p-4">
      <div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONES[tone]}`}
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
        <p className="mt-3 font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted">{desc}</p>
      </div>
      {violet ? (
        /* Le sélecteur [&_a] est plus spécifique que les classes de variante :
           il impose le violet sans toucher au composant Button partagé. */
        <span className="[&_a]:bg-violet-600 [&_a]:text-white [&_a:hover]:bg-violet-700 [&_a:hover]:shadow-lg [&_a:hover]:shadow-violet-500/25">
          <ButtonLink href={href} size="sm" className="mt-3 w-full">
            {cta}
          </ButtonLink>
        </span>
      ) : (
        <ButtonLink
          href={href}
          size="sm"
          variant={accent ? "accent" : outline ? "outline" : "primary"}
          className="mt-3 w-full"
        >
          {cta}
        </ButtonLink>
      )}
    </Card>
  );
}
