"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { IconCheck, IconCopy } from "@/components/icons";
import { copyText } from "@/lib/clipboard";

/**
 * Bouton « Copier » simple, pour les valeurs courtes (code de parrainage, lien).
 * Pour un numéro ou un code SMS — les valeurs qu'on vient chercher sur la page —
 * utiliser plutôt `CopyField`, qui rend toute la zone tapable.
 *
 * Le `catch` était vide : quand le presse-papiers est refusé (navigateur
 * interne de WhatsApp, vieille WebView), le client appuyait et rien ne se
 * passait, sans explication. La copie passe maintenant par `copyText`, et
 * l'échec dit quoi faire.
 */
export function CopyButton({
  value,
  label = "Copier",
  copiedLabel = "Copié",
  size = "sm",
  variant = "outline",
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "selected">("idle");
  // Valeur cachée : cible de la sélection quand le presse-papiers est refusé.
  const holder = useRef<HTMLSpanElement>(null);

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={async () => {
          const r = await copyText(value, holder.current);
          setState(r === "copied" ? "copied" : "selected");
          if (r === "copied") setTimeout(() => setState("idle"), 1800);
        }}
      >
        {state === "copied" ? (
          <>
            <IconCheck className="h-4 w-4" />
            {copiedLabel}
          </>
        ) : (
          <>
            <IconCopy className="h-4 w-4" />
            {label}
          </>
        )}
      </Button>

      {/* Hors flux mais sélectionnable : sert de repli à l'appui long. */}
      <span ref={holder} className="sr-only">
        {value}
      </span>

      {state === "selected" && (
        <p className="mt-2 text-sm font-medium text-warning" role="status">
          Copie automatique bloquée par votre navigateur — faites un{" "}
          <strong>appui long</strong> sur la valeur puis «&nbsp;Copier&nbsp;».
        </p>
      )}
    </>
  );
}
