"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { TimeLeftBar } from "@/components/time-left-bar";

type Sms = { code?: string; text?: string; date?: string; sender?: string };
type RentalState = {
  status: string;
  endsAt: string;
  phoneNumber: string;
  sms: Sms[];
};

/* Le CopyButton local a été supprimé : il redéclarait un appel à
   `navigator.clipboard.writeText` SANS try/catch, alors que `CopyField`
   existe et gère le repli (sélection + appui long) quand le presse-papiers
   est refusé — cas courant dans le navigateur interne de WhatsApp. */

export function RentalLive({
  id,
  startedAt,
  initial,
}: {
  id: string;
  /** Début de la location : sert uniquement à la part écoulée de la barre. */
  startedAt: string;
  initial: RentalState;
}) {
  const router = useRouter();
  const [state, setState] = useState<RentalState>(initial);
  const active = state.status === "ACTIVE";

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/rentals/${id}/status`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<RentalState>;
      setState((p) => ({ ...p, ...data, sms: data.sms ?? p.sms }));
    } catch {
      /* on réessaiera */
    }
  }, [id]);

  useEffect(() => {
    if (!active) {
      router.refresh();
      return;
    }
    const t = setInterval(poll, 6000);
    return () => clearInterval(t);
  }, [active, poll, router]);

  const smsList = state.sms ?? [];

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${active ? "animate-pulse bg-green-500" : "bg-gray-400"}`}
          />
          {active ? "Actif" : "Terminé"}
        </span>
      </div>

      {/* Temps restant — sur un produit vendu à la durée, c'est l'information
          numéro un. Elle se résumait à « Expire dans 6j 3h » en gris clair
          dans un coin, et la date de fin réelle n'apparaissait nulle part. */}
      {active && (
        <TimeLeftBar
          startedAt={startedAt}
          endsAt={state.endsAt}
          endedLabel="Location terminée"
          showEndDate
        />
      )}

      {/* Le numéro : c'est le produit acheté, celui qu'on revient consulter
          pendant des jours. Il était plus petit que le code SMS affiché
          juste en dessous. */}
      <CopyField
        label="Votre numéro dédié"
        value={`+${state.phoneNumber}`}
        size="lg"
      />

      {/* SMS reçus */}
      {smsList.length > 0 ? (
        /* Occulté en bloc dans les enregistrements de session : on affiche ici
           le TEXTE COMPLET des SMS reçus sur un numéro loué, pas seulement le
           code. Masquer le conteneur couvre aussi les messages sans code
           détecté, affichés bruts juste en dessous. */
        <div className="space-y-2" data-clarity-mask="true">
          <p className="text-sm font-semibold text-muted">
            SMS reçus ({smsList.length})
          </p>
          {smsList.map((sms, i) =>
            sms.code ? (
              <div key={i}>
                <CopyField
                  label={sms.date ? `Code reçu · ${sms.date}` : "Code reçu"}
                  value={sms.code}
                  tone="success"
                  grouped={false}
                  size="lg"
                />
                {sms.text && (
                  <p className="mt-1 text-sm text-muted">{sms.text}</p>
                )}
              </div>
            ) : (
              <div
                key={i}
                className="rounded-xl border border-green-200 bg-green-50 p-4"
              >
                <p className="text-sm text-green-900/80">
                  {sms.text || "Message reçu sans code détecté."}
                </p>
                {sms.date && (
                  <p className="mt-1 text-xs text-muted">{sms.date}</p>
                )}
              </div>
            ),
          )}
        </div>
      ) : active ? (
        <div className="flex items-center gap-3 rounded-xl border bg-gray-50 p-4">
          <span className="h-3 w-3 animate-pulse rounded-full bg-amber-500" />
          <p className="text-sm text-muted">
            En attente d&apos;un SMS… Saisissez ce numéro sur le service ;
            chaque code reçu s&apos;affichera ici automatiquement (le numéro
            reste à vous toute la durée).
          </p>
        </div>
      ) : (
        <p className="rounded-xl border bg-gray-50 p-4 text-sm text-muted">
          Aucun SMS reçu pendant la location.
        </p>
      )}
    </Card>
  );
}
