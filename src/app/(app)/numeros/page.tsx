import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Card, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Numéros virtuels" };

const TONES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-600",
};

function OptionCard({
  tone,
  iconPath,
  title,
  desc,
  href,
  cta,
  outline = false,
}: {
  tone: keyof typeof TONES;
  iconPath: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
  outline?: boolean;
}) {
  return (
    <Card className="flex flex-col p-5">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${TONES[tone]}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={iconPath} />
        </svg>
      </div>
      <p className="mt-4 text-lg font-semibold">{title}</p>
      <p className="mt-1 flex-1 text-sm text-muted">{desc}</p>
      <ButtonLink
        href={href}
        size="sm"
        variant={outline ? "outline" : "primary"}
        className="mt-4 self-start"
      >
        {cta}
      </ButtonLink>
    </Card>
  );
}

export default async function NumerosPage() {
  await requireUser();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Numéros virtuels</h1>
        <p className="text-muted">
          Choisissez l&apos;option qui correspond à votre besoin.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <OptionCard
          tone="blue"
          iconPath="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"
          title="Acheter un numéro"
          desc="Recevez votre code par SMS ou par appel. Code unique (~20 min) ou numéro dédié en location (1 à 30 jours) — tout au même endroit."
          href="/buy"
          cta="Acheter"
        />
        <OptionCard
          tone="slate"
          iconPath="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l2 4v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"
          title="Mes numéros"
          desc="Retrouvez vos activations, vos locations et tous les codes reçus (SMS et appels)."
          href="/numbers"
          cta="Voir mes numéros"
          outline
        />
      </div>
    </div>
  );
}
