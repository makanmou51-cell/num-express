"use client";

import { useEffect, useState } from "react";

// Store PARTAGÉ pour l'installation PWA : capture l'événement d'installation une
// seule fois (le plus tôt possible) et le rend disponible à la bannière ET au
// bouton « Installer l'app », où qu'ils soient.

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BIPEvent | null = null;
let started = false;
const subs = new Set<() => void>();
function notify() {
  subs.forEach((f) => f());
}

function startCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch(() => {});
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function detectStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
function detectIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream
  );
}

/** Déclenche l'invite d'installation native (Android/Chrome). */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  try {
    await deferred.userChoice;
  } catch {
    /* ignore */
  }
  deferred = null;
  notify();
  return true;
}

export interface InstallState {
  canPrompt: boolean; // invite native dispo (Android)
  isIOS: boolean;
  isStandalone: boolean; // déjà installé
  installable: boolean; // faut-il proposer l'installation ?
}

export function useInstall(): InstallState {
  // Par défaut « installé » : on n'affiche rien avant l'hydratation côté client.
  const [state, setState] = useState<InstallState>({
    canPrompt: false,
    isIOS: false,
    isStandalone: true,
    installable: false,
  });

  useEffect(() => {
    startCapture();
    const update = () => {
      const standalone = detectStandalone();
      const ios = detectIOS();
      const canPrompt = deferred !== null;
      setState({
        canPrompt,
        isIOS: ios,
        isStandalone: standalone,
        installable: !standalone && (canPrompt || ios),
      });
    };
    update();
    subs.add(update);
    return () => {
      subs.delete(update);
    };
  }, []);

  return state;
}
