"use client";

import { useEffect, useState } from "react";

/**
 * Barre « temps restant » partagée entre une activation (quelques minutes) et
 * une location (jusqu'à 30 jours).
 *
 * Elle n'existait que dans l'écran d'activation ; la location, pourtant le
 * produit le plus cher, se contentait d'un « Expire dans 6j 3h » gris de 14 px
 * en haut à droite — et la date de fin réelle n'était écrite nulle part.
 *
 * Deux garde-fous :
 *  - l'horloge démarre à `null` puis se remplit dans un effet : rendre
 *    `Date.now()` au premier rendu créerait un écart entre le HTML du serveur
 *    et celui du client (erreur d'hydratation) ;
 *  - `endsAt` reste la seule source de la date affichée. On ne recalcule
 *    jamais une fin à partir d'une durée côté client, sinon l'affichage dérive
 *    par rapport au serveur.
 */

/** m:ss — pour les courtes durées (activation). */
function mmss(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** « 6 j 03 h » / « 4 h 12 min » — pour les longues durées (location). */
function longSpan(ms: number): string {
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d} j ${String(h).padStart(2, "0")} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m} min`;
}

export function TimeLeftBar({
  startedAt,
  endsAt,
  format = "long",
  urgentMs,
  endedLabel,
  showEndDate = false,
}: {
  /** Début, pour calculer la part écoulée. */
  startedAt: string;
  /** Fin — seule source de vérité de la date affichée. */
  endsAt: string;
  format?: "short" | "long";
  /** Seuil de bascule en orange (défaut : 2 min en court, 24 h en long). */
  urgentMs?: number;
  /** Phrase affichée une fois le délai écoulé. */
  endedLabel?: string;
  /** Écrit la date de fin en toutes lettres sous la barre. */
  showEndDate?: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);
  const endMs = new Date(endsAt).getTime();
  const startMs = new Date(startedAt).getTime();
  const left = now !== null ? Math.max(0, endMs - now) : null;

  useEffect(() => {
    setNow(Date.now());
    if (Date.now() >= endMs) return;
    // Sur une location de 30 jours, un tick par seconde ne sert à rien ;
    // sur une activation de 20 minutes, il est indispensable. Et dans la
    // dernière heure d'une location, on repasse à la seconde.
    const fast = format === "short" || endMs - Date.now() < 3_600_000;
    const t = setInterval(() => setNow(Date.now()), fast ? 1000 : 30_000);
    return () => clearInterval(t);
  }, [endMs, format]);

  if (left === null) {
    // Réserve la hauteur : sans ça, la carte sursaute à l'hydratation.
    return <div className="h-12" aria-hidden="true" />;
  }

  const total = Math.max(1, endMs - startMs);
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  const threshold = urgentMs ?? (format === "short" ? 120_000 : 86_400_000);
  const urgent = left <= threshold;
  const ended = left <= 0;

  return (
    <div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label="Temps restant"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            urgent ? "bg-warning" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2 text-sm text-muted">
        {ended ? (
          <strong className="text-base text-foreground">
            {endedLabel ?? "Terminé"}
          </strong>
        ) : (
          <>
            Il reste{" "}
            <strong
              className={`text-base tabular-nums ${urgent ? "text-warning" : "text-foreground"}`}
            >
              {format === "short" ? mmss(left) : longSpan(left)}
            </strong>
          </>
        )}
      </p>

      {showEndDate && !ended && (
        <p className="mt-0.5 text-sm text-muted">
          Se termine le{" "}
          {new Date(endsAt).toLocaleString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
