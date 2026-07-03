import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/logo";
import { Button, ButtonLink } from "@/components/ui";
import { formatXof } from "@/lib/pricing";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/buy", label: "Acheter" },
  { href: "/numbers", label: "Mes numéros" },
  { href: "/wallet", label: "Solde" },
  { href: "/affiliate", label: "Parrainage" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard">
            <Logo />
          </Link>

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

          <div className="flex items-center gap-2">
            {user.role === "ADMIN" && (
              <ButtonLink href="/admin" variant="ghost" size="sm">
                Admin
              </ButtonLink>
            )}
            <ButtonLink href="/wallet" variant="outline" size="sm">
              {formatXof(user.balance)}
            </ButtonLink>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Déconnexion
              </Button>
            </form>
          </div>
        </div>

        {/* Nav mobile */}
        <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
