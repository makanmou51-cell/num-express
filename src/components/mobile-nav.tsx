"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui";
import { logoutAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

export function MobileNav({
  nav,
  isAdmin,
  balanceLabel,
  userName,
}: {
  nav: NavItem[];
  isAdmin: boolean;
  balanceLabel: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Ferme le menu à chaque changement de page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bloque le défilement du fond quand le menu est ouvert.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const items: NavItem[] = [
    ...nav,
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <>
      {/* Bouton hamburger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-white text-foreground"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay + tiroir */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          open ? "" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <aside
          className={cn(
            "absolute right-0 top-0 flex h-full w-72 max-w-[82%] flex-col bg-white shadow-2xl transition-transform duration-200",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          {/* En-tête du tiroir */}
          <div className="flex items-center justify-between border-b px-4 py-4">
            <Logo />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer le menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {/* Solde */}
          <div className="border-b px-4 py-4">
            <p className="text-xs text-muted">Bonjour, {userName}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm text-muted">Solde</span>
              <span className="rounded-lg border bg-background px-3 py-1 text-sm font-semibold">
                {balanceLabel}
              </span>
            </div>
          </div>

          {/* Liens de navigation */}
          <nav className="flex-1 overflow-y-auto p-2">
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-lg px-3 py-3 text-[15px] font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-gray-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Déconnexion */}
          <div className="border-t p-3">
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="w-full">
                Déconnexion
              </Button>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
}
