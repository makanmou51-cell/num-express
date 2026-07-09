import { cn } from "@/lib/utils";

// Pastille colorée aux couleurs de la marque (fiable partout, sans image externe).
const ICONS: Record<string, { bg: string; label: string }> = {
  wa: { bg: "#25D366", label: "Wa" },
  tg: { bg: "#229ED9", label: "Tg" },
  ig: { bg: "#E1306C", label: "Ig" },
  fb: { bg: "#1877F2", label: "f" },
  go: { bg: "#4285F4", label: "G" },
  tw: { bg: "#0f0f0f", label: "X" },
  ds: { bg: "#5865F2", label: "Dc" },
  ot: { bg: "#64748b", label: "•••" },
  vi: { bg: "#7360F2", label: "Vi" },
  mm: { bg: "#0067b8", label: "Ms" },
  am: { bg: "#ff9900", label: "Az" },
  nf: { bg: "#e50914", label: "N" },
  ub: { bg: "#0f0f0f", label: "Ub" },
  ya: { bg: "#fc3f1d", label: "Ya" },
  lf: { bg: "#0f0f0f", label: "Tk" },
  wb: { bg: "#07c160", label: "Wc" },
  vk: { bg: "#0077ff", label: "Vk" },
};

export function ServiceIcon({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const it = ICONS[code] ?? {
    bg: "#16a34a",
    label: code.slice(0, 2).toUpperCase(),
  };
  return (
    <span
      aria-hidden
      style={{ backgroundColor: it.bg }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-bold leading-none text-white",
        className,
      )}
    >
      {it.label}
    </span>
  );
}
