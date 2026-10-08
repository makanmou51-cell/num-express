"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { IconBell, IconWarnCircle, IconCheckCircle } from "@/components/icons";

/**
 * Demande d'autorisation aux notifications navigateur.
 *
 * Règle d'or : on ne déclenche JAMAIS la demande automatiquement au
 * chargement. Un navigateur qui affiche la boîte « Autoriser les
 * notifications ? » sans contexte se fait refuser dans la grande majorité des
 * cas — et un refus est quasi définitif : le client devrait aller le changer
 * à la main dans les réglages du navigateur. On la déclenche donc sur un clic
 * explicite, au moment où l'intérêt est évident (juste après un achat).
 *
 * Sur iPhone, Apple n'autorise le push que si la PWA est installée sur
 * l'écran d'accueil — d'où le message dédié.
 */

/**
 * La clé publique VAPID doit être convertie en octets pour l'API Push.
 *
 * On alloue explicitement un `ArrayBuffer` : `new Uint8Array(longueur)` produit
 * un `Uint8Array<ArrayBufferLike>`, que `applicationServerKey` refuse (il exige
 * un tampon non partagé).
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State =
  | "checking"
  | "unsupported"
  | "ios-needs-install"
  | "ready"
  | "granted"
  | "denied"
  | "working";

/** Mémorise un refus de la bannière pour ne pas harceler le visiteur. */
const DISMISS_KEY = "ne_push_banner_dismissed";
/** On la repropose au bout de 14 jours, pas avant. */
const DISMISS_MS = 14 * 24 * 3600_000;

export function PushOptIn({
  compact = false,
  /**
   * "inline" : encadré complet, sur l'écran d'attente du code.
   * "banner" : bandeau fin et refermable, posé sur les pages courantes pour
   * recruter des abonnés sans gêner.
   */
  variant = "inline",
}: {
  compact?: boolean;
  variant?: "inline" | "banner";
}) {
  const [state, setState] = useState<State>("checking");
  const [hidden, setHidden] = useState(variant === "banner");

  // La bannière ne s'affiche que si elle n'a pas été refusée récemment.
  useEffect(() => {
    if (variant !== "banner") return;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      setHidden(Boolean(at) && Date.now() - at < DISMISS_MS);
    } catch {
      setHidden(false);
    }
  }, [variant]);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* navigation privée : elle réapparaîtra, tant pis */
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!supported) {
      // iOS < 16.4, ou Safari dans un onglet normal : le push exige que la
      // PWA soit installée sur l'écran d'accueil.
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;
      setState(isIOS && !standalone ? "ios-needs-install" : "unsupported");
      return;
    }

    if (Notification.permission === "granted") {
      // Déjà autorisé : on revalide l'abonnement en silence. Le navigateur
      // peut avoir fait tourner les clés, ou la base avoir été nettoyée.
      void resubscribeSilently();
      setState("granted");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    setState("ready");
  }, []);

  async function resubscribeSilently() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (!existing) return;
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existing),
      });
    } catch {
      /* sans conséquence : on retentera à la prochaine visite */
    }
  }

  async function enable() {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "ready");
        return;
      }

      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setState("unsupported");
        return;
      }

      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState(res.ok ? "granted" : "ready");
    } catch {
      setState("ready");
    }
  }

  if (state === "checking" || state === "unsupported") return null;

  /* ── Bandeau de recrutement ──────────────────────────────────────────
     Posé sur les pages courantes. Il ne déclenche RIEN tout seul : il
     explique, et la demande du navigateur n'arrive qu'au clic. C'est la
     seule façon d'obtenir un taux d'acceptation correct — une demande
     surgie sans contexte se fait refuser, et le refus est définitif. */
  if (variant === "banner") {
    if (hidden || state === "granted" || state === "denied") return null;
    if (state === "ios-needs-install") return null; // trop long pour un bandeau
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
        <IconBell className="h-5 w-5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm">
          <strong>Sois prévenu dès que ton code arrive</strong>
          <span className="block text-muted">
            Ton téléphone sonne, même si tu as fermé la page.
          </span>
        </p>
        <Button
          type="button"
          variant="accent"
          size="sm"
          className="shrink-0"
          onClick={enable}
          disabled={state === "working"}
        >
          {state === "working" ? "…" : "Activer"}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Masquer"
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors active:bg-gray-100"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
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
    );
  }

  if (state === "granted") {
    if (compact) return null;
    return (
      <p className="flex items-center gap-2 text-sm text-success">
        <IconCheckCircle className="h-4 w-4" />
        Notifications activées — on te préviendra dès que ton code arrive.
      </p>
    );
  }

  if (state === "ios-needs-install") {
    return (
      <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <IconWarnCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Sur iPhone, installe d&apos;abord num express sur ton écran
          d&apos;accueil (<strong>Partager</strong> →{" "}
          <strong>Sur l&apos;écran d&apos;accueil</strong>). Tu pourras ensuite
          activer les notifications.
        </p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-sm text-muted">
        Les notifications sont bloquées pour ce site. Pour les réactiver&nbsp;:
        touche le cadenas à gauche de l&apos;adresse, puis{" "}
        <strong>Notifications → Autoriser</strong>.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
      <p className="text-sm font-semibold">
        Sois prévenu dès que ton code arrive
      </p>
      <p className="mt-1 text-sm text-muted">
        Tu peux fermer cette page et aller sur WhatsApp : ton téléphone sonnera
        à la seconde où le code tombe.
      </p>
      <Button
        type="button"
        variant="accent"
        className="mt-3 w-full sm:w-auto"
        onClick={enable}
        disabled={state === "working"}
      >
        {state === "working" ? (
          <>
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            Activation…
          </>
        ) : (
          "Activer les notifications"
        )}
      </Button>
    </div>
  );
}
