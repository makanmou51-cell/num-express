import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/logo";
import { Button, Badge } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/settings", label: "Réglages" },
  { href: "/admin/diagnostic", label: "Diagnostic" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Logo />
            </Link>
            <Badge className="bg-slate-800 text-white">Admin</Badge>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-gray-100 hover:text-foreground"
              >
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-gray-100"
            >
              ↩ Site
            </Link>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Déconnexion
              </Button>
            </form>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {NAV.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-gray-100"
            >
              {i.label}
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
