import {
  siWhatsapp,
  siTelegram,
  siInstagram,
  siFacebook,
  siGoogle,
  siX,
  siDiscord,
  siViber,
  siNetflix,
  siUber,
  siTiktok,
  siWechat,
  siVk,
} from "simple-icons";
import { cn } from "@/lib/utils";

// Vrais logos officiels (Simple Icons) pour la plupart des services.
const SI: Record<string, { path: string; hex: string }> = {
  wa: siWhatsapp,
  tg: siTelegram,
  ig: siInstagram,
  fb: siFacebook,
  go: siGoogle,
  tw: siX,
  ds: siDiscord,
  vi: siViber,
  nf: siNetflix,
  ub: siUber,
  lf: siTiktok,
  wb: siWechat,
  vk: siVk,
};

// Ceux absents de Simple Icons : repli propre en couleur de marque.
const FALLBACK: Record<string, { color: string; label: string }> = {
  am: { color: "#FF9900", label: "a" },
  ya: { color: "#FC3F1D", label: "Я" },
  ot: { color: "#64748b", label: "•••" },
};

export function ServiceIcon({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white",
        className,
      )}
    >
      <Glyph code={code} />
    </span>
  );
}

function Glyph({ code }: { code: string }) {
  if (code === "mm") return <MicrosoftGlyph />;

  const brand = SI[code];
  if (brand) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-[58%] w-[58%]"
        style={{ fill: `#${brand.hex}` }}
        aria-hidden
      >
        <path d={brand.path} />
      </svg>
    );
  }

  const fb = FALLBACK[code] ?? {
    color: "#16a34a",
    label: code.slice(0, 2).toUpperCase(),
  };
  return (
    <span className="text-sm font-bold" style={{ color: fb.color }} aria-hidden>
      {fb.label}
    </span>
  );
}

function MicrosoftGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" aria-hidden>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
