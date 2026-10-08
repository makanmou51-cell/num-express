import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/logo";
import { Button, ButtonLink } from "@/components/ui";
import { MobileNav } from "@/components/mobile-nav";
import { BottomNav } from "@/components/bottom-nav";
import { InstallButton } from "@/components/install-button";
import { formatXof } from "@/lib/pricing";

// Pas d'emoji dans un libellé de navigation : il dépend de la police du
// téléphone et s'affiche en carré vide sur beaucoup d'Android d'entrée de gamme.
// « Numéros virtuels » (/numeros) est remplacé par les deux destinations
// réelles : cette page n'était qu'un menu de deux cartes vers /buy et /numbers.
const NAV = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/buy", label: "Acheter" },
  { href: "/numbers", label: "Mes numéros" },
  { href: "/boost", label: "Boost" },
  { href: "/wallet", label: "Solde" },
  { href: "/affiliate", label: "Parrainage" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const balanceLabel = formatXof(user.balance);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard">
            <Logo />
          </Link>

          {/* Navigation bureau */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-gray-100 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Actions bureau */}
          <div className="hidden items-center gap-2 md:flex">
            <InstallButton />
            {user.role === "ADMIN" && (
              <ButtonLink href="/admin" variant="ghost" size="sm">
                Admin
              </ButtonLink>
            )}
            <ButtonLink href="/wallet" variant="outline" size="sm">
              {balanceLabel}
            </ButtonLink>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Déconnexion
              </Button>
            </form>
          </div>

          {/* Mobile : solde + menu latéral */}
          <div className="flex items-center gap-2 md:hidden">
            <ButtonLink href="/wallet" variant="outline" size="sm">
              {balanceLabel}
            </ButtonLink>
            <MobileNav
              nav={NAV}
              isAdmin={user.role === "ADMIN"}
              balanceLabel={balanceLabel}
              userName={user.name ?? "vous"}
            />
          </div>
        </div>
      </header>

      {/* pb-24 sur téléphone : sans cette réserve, le bas de chaque page passe
          sous la barre d'onglets fixe et devient inatteignable. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:pt-8 md:pb-8">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
