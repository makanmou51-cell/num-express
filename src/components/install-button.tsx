"use client";

import { useState } from "react";
import { useInstall, promptInstall } from "@/components/use-install";

/**
 * Bouton « Installer l'app » réutilisable (pied de page, menu…). Ne s'affiche
 * que si l'installation est possible et que l'app n'est pas déjà installée.
 * Sur iOS (pas d'invite native), un clic montre les instructions.
 */
export function InstallButton({ className }: { className?: string }) {
  const { installable, isIOS, canPrompt } = useInstall();
  const [showHint, setShowHint] = useState(false);

  if (!installable) return null;

  const onClick = async () => {
    if (canPrompt) {
      await promptInstall();
      return;
    }
    if (isIOS) setShowHint((v) => !v);
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        }
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        Installer l&apos;app
      </button>

      {isIOS && showHint && (
        <div className="absolute bottom-full left-0 mb-2 w-60 rounded-xl border border-border bg-white p-3 text-xs text-muted shadow-lg">
          Sur iPhone : appuie sur <strong>Partager</strong>{" "}
          <span aria-hidden>⎋</span> en bas, puis{" "}
          <strong>« Sur l'écran d'accueil »</strong>.
        </div>
      )}
    </div>
  );
}
