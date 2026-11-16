import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/(auth)/actions";
import { formatXof } from "@/lib/pricing";
import { Button } from "@/components/ui";
import { InstallButton } from "@/components/install-button";

export const metadata: Metadata = { title: "Plus" };

/* Chevron « > » discret, commun à toutes les lignes. */
function Chevron() {
  return (
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
  );
}

/** Une ligne de menu : icône + titre (+ sous-titre) + valeur ou chevron. */
function Row({
  href,
  icon,
  title,
  sub,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub?: string;
  value?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-gray-50 active:bg-gray-100"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      {value ? (
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
          {value}
        </span>
      ) : (
        <Chevron />
      )}
    </Link>
  );
}

const ic = {
  wallet: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M16 12h.01M3 10h18" />
    </svg>
  ),
  gift: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
      <path d="M12 8S10.5 3 8 3a2 2 0 0 0 0 4h4zM12 8s1.5-5 4-5a2 2 0 0 1 0 4h-4z" />
    </svg>
  ),
  accounts: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M15 8h3M15 12h3M5 16c.8-1.3 2.3-2 4-2s3.2.7 4 2" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

export default async function PlusPage() {
  const user = await requireUser();
  const initial = (user.name?.trim()?.[0] ?? user.email[0] ?? "?").toUpperCase();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Plus</h1>

      {/* Profil */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{user.name ?? "Mon compte"}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
      </div>

      {/* Argent & produits */}
      <div className="divide-y overflow-hidden rounded-2xl border border-border bg-card">
        <Row
          href="/wallet"
          icon={ic.wallet}
          title="Mon solde"
          sub="Recharger par Mobile Money"
          value={formatXof(user.balance)}
        />
        <Row
          href="/affiliate"
          icon={ic.gift}
          title="Parrainage"
          sub="Gagne sur les achats de tes filleuls"
        />
        <Row
          href="/comptes"
          icon={ic.accounts}
          title="Comptes réseaux sociaux"
          sub="TikTok, Facebook, Instagram — livrés"
        />
      </div>

      {/* Infos */}
      <div className="divide-y overflow-hidden rounded-2xl border border-border bg-card">
        <Row href="/terms" icon={ic.doc} title="Conditions d'utilisation" />
        {user.role === "ADMIN" && (
          <Row href="/admin" icon={ic.shield} title="Espace admin" />
        )}
      </div>

      {/* Support : le chat est toujours en bas à droite, pas d'URL à ouvrir. */}
      <p className="px-1 text-center text-xs text-muted">
        Besoin d&apos;aide&nbsp;? Écris-nous dans le chat, en bas à droite.
      </p>

      {/* Installer l'app (n'apparaît que si le navigateur le permet) */}
      <div className="flex justify-center">
        <InstallButton />
      </div>

      {/* Déconnexion */}
      <form action={logoutAction}>
        <Button type="submit" variant="outline" className="w-full">
          Déconnexion
        </Button>
      </form>
    </div>
  );
}
