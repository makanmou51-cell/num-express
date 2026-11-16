import { cn } from "@/lib/utils";

/**
 * Statut d'une activation / location.
 *
 * Avant : une pastille pastel pleine par statut (bleu « Remboursé », ambre
 * « En attente », vert « Reçu »…). Quatre teintes différentes empilées sur
 * chaque écran → l'effet « template » arc-en-ciel, et le bleu ne voulait rien
 * dire (remboursé n'est ni une info, ni une erreur).
 *
 * Maintenant : un POINT vivant + un libellé en texte discret. Le point porte
 * le sens, tiré des couleurs sémantiques de la marque (vert = bon, ambre =
 * en cours, gris = clos). C'est la signature de l'app : un registre d'opérateur
 * où l'on lit l'état d'un coup d'œil, pas une collection de badges.
 */

type Tone = "success" | "warning" | "muted";

const MAP: Record<string, { label: string; tone: Tone }> = {
  WAITING_CODE: { label: "En attente", tone: "warning" },
  RECEIVED: { label: "Code reçu", tone: "success" },
  COMPLETED: { label: "Terminé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "muted" },
  REFUNDED: { label: "Remboursé", tone: "muted" },
  EXPIRED: { label: "Expiré · remboursé", tone: "muted" },
};

const DOT: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-gray-300",
};

export function StatusDot({
  tone,
  pulse = false,
  className,
}: {
  tone: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        DOT[tone],
        pulse && "animate-pulse",
        className,
      )}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, tone: "muted" as Tone };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <StatusDot tone={s.tone} />
      {s.label}
    </span>
  );
}
