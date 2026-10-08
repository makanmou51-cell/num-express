"use client";

import { useEffect, useState } from "react";
import { useInstall, promptInstall } from "@/components/use-install";
import { IconShare } from "@/components/icons";

const DISMISS_KEY = "ne_install_dismissed";

export function InstallPrompt() {
  const { installable, isIOS, canPrompt } = useInstall();
  const [dismissed, setDismissed] = useState(true); // masqué avant vérification
  const [ready, setReady] = useState(false);
  const [iosDelayPassed, setIosDelayPassed] = useState(false);

  useEffect(() => {
    let d = false;
    try {
      d = Boolean(localStorage.getItem(DISMISS_KEY));
    } catch {
      /* ignore */
    }
    setDismissed(d);
    setReady(true);
  }, []);

  /* Délai avant d'apparaître — pour TOUT le monde, pas seulement iOS.
     Avant, la bannière recouvrait le bas de la page dès la première seconde :
     un visiteur qui arrive pour acheter se prenait une invitation à installer
     avant même d'avoir lu quoi que ce soit. 20 s = le temps de regarder. */
  useEffect(() => {
    const t = setTimeout(() => setIosDelayPassed(true), 20_000);
    return () => clearTimeout(t);
  }, []);

  if (!ready || dismissed || !installable) return null;
  if (!iosDelayPassed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    /* La bannière se pose AU-DESSUS de la barre d'onglets (bottom-20) et
       respecte la zone sûre de l'iPhone : avant, en `bottom-3`, elle mordait
       sur le trait d'accueil et sur la navigation. */
    <div className="fixed inset-x-3 bottom-20 z-[60] mx-auto mb-[env(safe-area-inset-bottom)] max-w-md rounded-2xl border border-white/10 bg-primary-dark p-4 text-white shadow-2xl md:bottom-3">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
          <span className="text-lg font-extrabold text-primary-dark">N</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Installer num express</p>
          {isIOS ? (
            <p className="mt-0.5 text-sm text-white/70">
              Appuie sur <strong>Partager</strong>{" "}
              <IconShare className="inline h-4 w-4 align-text-bottom" /> puis{" "}
              <strong>«&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;»</strong>
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-white/70">
              Accède à l'app en un clic depuis ton écran d'accueil, sans passer
              par le navigateur.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            {canPrompt && (
              <button
                type="button"
                onClick={() => promptInstall()}
                className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-primary-dark transition-transform active:scale-95"
              >
                Installer
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="min-h-11 rounded-lg border border-white/30 px-4 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
            >
              Plus tard
            </button>
          </div>
        </div>
        {/* Une croix en caractère texte de 14 px se rate au doigt : vrai bouton
            carré de 44 px, avec une icône vectorielle. */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
