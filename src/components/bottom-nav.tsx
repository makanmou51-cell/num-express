"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBoost,
  IconCart,
  IconHome,
  IconSim,
  IconWallet,
} from "@/components/icons";

/**
 * Barre d'onglets fixe en bas, sur téléphone uniquement.
 *
 * Pourquoi : le public est à ~100 % mobile, et toute la navigation était
 * enfermée dans un tiroir hamburger — deux gestes (ouvrir le tiroir, choisir)
 * pour chaque déplacement, et aucune indication de l'endroit où l'on se
 * trouve. Le tiroir reste pour le secondaire (parrainage, admin, déconnexion).
 *
 * Deux règles tenues :
 *  - 5 entrées maximum : au-delà, les cibles deviennent trop étroites au pouce ;
 *  - `env(safe-area-inset-bottom)` : sans ça, la barre passe sous le trait
 *    d'accueil des iPhone récents et le dernier onglet devient intapable.
 *
 * Les entrées pointent directement sur /buy et /numbers : l'ancienne entrée
 * « Numéros virtuels » (/numeros) n'était qu'un écran de menu avec deux cartes
 * renvoyant vers ces deux pages — un tap pour rien.
 */

const TABS = [
  { href: "/dashboard", label: "Accueil", Icon: IconHome },
  { href: "/buy", label: "Acheter", Icon: IconCart },
  { href: "/numbers", label: "Numéros", Icon: IconSim },
  { href: "/boost", label: "Boost", Icon: IconBoost },
  { href: "/wallet", label: "Solde", Icon: IconWallet },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map(({ href, label, Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 transition-colors ${
                  active ? "text-primary" : "text-muted active:bg-gray-100"
                }`}
              >
                {/* Trait au-dessus de l'onglet actif : l'état ne repose pas
                    uniquement sur la couleur. */}
                <span
                  className={`absolute inset-x-3 top-0 h-0.5 rounded-full ${
                    active ? "bg-primary" : "bg-transparent"
                  }`}
                  aria-hidden="true"
                />
                <Icon className="h-6 w-6" />
                <span className="text-[11px] font-medium leading-none">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
