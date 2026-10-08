import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatXof } from "@/lib/pricing";
import { IconArrowLeft } from "@/components/icons";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        // text-base (16px) : en dessous, iOS zoome tout seul au focus.
        // min-h-11 (44px) : cible tactile minimale. Pas d'`outline-none` :
        // l'anneau de focus global doit rester visible au clavier.
        "w-full min-h-11 rounded-lg border bg-white px-3 py-2.5 text-base",
        "placeholder:text-muted focus:border-primary",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium", className)}
      {...props}
    />
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-60 disabled:hover:shadow-none",
  // Réservé à l'action qui fait gagner de l'argent (Acheter, Louer, Recharger) :
  // une seule action dominante par écran, sinon plus rien ne ressort.
  accent:
    "bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/25 disabled:opacity-60 disabled:hover:shadow-none",
  outline:
    "border bg-white hover:border-primary/40 hover:bg-gray-50 hover:shadow-sm disabled:opacity-60",
  ghost: "hover:bg-gray-100 disabled:opacity-60",
  danger:
    "bg-red-600 text-white hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/25 disabled:opacity-60",
};
// min-h-11 = 44px : cible tactile minimale imposée sur TOUTES les tailles —
// le public est à ~100 % mobile, un bouton de 32px se rate au doigt.
const SIZES = {
  sm: "min-h-11 px-3 py-2 text-sm",
  md: "min-h-11 px-4 py-2.5 text-sm",
  lg: "min-h-12 px-5 py-3 text-base",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ComponentProps<typeof Link> & {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 active:scale-[0.97]",
        VARIANTS[variant ?? "primary"],
        SIZES[size ?? "md"],
        className,
      )}
      {...props}
    />
  );
}

export function Alert({
  variant = "error",
  children,
}: {
  variant?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "bg-red-50 text-red-700 border-red-200",
    success: "bg-green-50 text-green-700 border-green-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
  }[variant];
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", styles)}>
      {children}
    </div>
  );
}

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

/* ══════════════════ Motifs partagés ══════════════════
   Ces cinq primitives existaient en copier-coller dans l'application : le même
   sélecteur d'onglets dans 3 fichiers, la même pastille de choix dans 4, le
   même encadré de solde dans 3, la même flèche retour en caractère « ← » dans
   2. À chaque écran ajouté, la divergence s'aggravait. Les corriger ici les
   corrige partout — et empêche la prochaine divergence. */

/**
 * Sélecteur à onglets (« Actives / Toutes »).
 * Les copies manuelles faisaient `px-3 py-1` ≈ 24 px de haut : trop petit
 * pour être touché du premier coup. Ici, 44 px imposés.
 */
export function Segmented({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-lg bg-gray-100 p-1"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-md px-4 text-sm font-medium transition-all",
              on
                ? "bg-white text-foreground shadow-sm"
                : "text-muted active:bg-white/60",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Montant en F CFA. `tabular-nums` n'était appliqué nulle part de façon
 * systématique : les colonnes de prix dansaient d'une ligne à l'autre dès
 * qu'un chiffre changeait de largeur.
 */
export function Amount({
  value,
  className,
  signed = false,
}: {
  value: number;
  className?: string;
  /** Préfixe explicite + / − (historique de portefeuille). */
  signed?: boolean;
}) {
  const sign = signed ? (value >= 0 ? "+" : "−") : "";
  return (
    <span className={cn("tabular-nums", className)}>
      {sign}
      {formatXof(Math.abs(value))}
    </span>
  );
}

/** Encadré « Votre solde » — même forme sur tous les écrans d'achat. */
export function BalancePill({
  balance,
  label = "Votre solde",
  className,
}: {
  balance: number;
  label?: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "shrink-0 rounded-xl border border-border bg-card px-3 py-2 text-right",
        className,
      )}
    >
      <span className="block text-xs text-muted">{label}</span>
      <strong className="block text-base font-bold tabular-nums">
        {formatXof(balance)}
      </strong>
    </p>
  );
}

/** Retour en arrière : un vrai bouton bordé, pas un caractère « ← » de 14 px. */
export function BackLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-sm font-medium text-foreground transition-colors active:bg-gray-100",
        className,
      )}
    >
      <IconArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}

/**
 * Classes d'une pastille de choix (service, durée, quantité…).
 * Renvoie une chaîne plutôt qu'un composant : ces pastilles sont tantôt des
 * `<button>`, tantôt des `<Link>` qui relancent un rendu serveur.
 * L'état sélectionné ne repose plus sur la seule couleur (une coche doit être
 * ajoutée par l'appelant) et un retour tactile `active:` est garanti.
 */
export function chipClasses(selected: boolean, className?: string): string {
  return cn(
    "relative inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 px-4 text-sm font-semibold transition-all active:scale-[0.98]",
    selected
      ? "border-primary bg-primary/10 text-primary"
      : "border-border bg-white text-foreground active:bg-gray-100",
    className,
  );
}
