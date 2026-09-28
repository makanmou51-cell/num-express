import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { getFunnel, libelleStatut } from "@/lib/funnel";

export const metadata: Metadata = { title: "Admin — Entonnoir" };

const PERIODES = [
  { jours: 7, label: "7 jours" },
  { jours: 30, label: "30 jours" },
  { jours: 90, label: "90 jours" },
  { jours: 0, label: "Tout" },
] as const;

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ j?: string }>;
}) {
  const { j } = await searchParams;
  const jours = j === "0" ? 0 : Number(j) || 30;
  const data = await getFunnel(jours || null);

  // La plus grosse fuite : c'est LE chiffre à regarder. On la calcule ici pour
  // la désigner explicitement, au lieu de laisser chercher dans le tableau.
  let pire = 1;
  for (let i = 2; i < data.steps.length; i++) {
    if (data.steps[i].fromPrev < data.steps[pire].fromPrev) pire = i;
  }
  const fuite = data.steps[pire];
  const avant = data.steps[pire - 1];
  const perdus = avant.count - fuite.count;

  const tauxPaiement =
    data.paiementsReussis + data.paiementsEchoues
      ? Math.round(
          (data.paiementsReussis /
            (data.paiementsReussis + data.paiementsEchoues)) *
            100,
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Entonnoir</h1>
        <p className="text-muted">
          Où tes clients s&apos;arrêtent, calculé sur ta propre base.
        </p>
      </div>

      {/* Sélecteur de période — de simples liens : la page est rendue côté
          serveur, pas besoin de JavaScript pour changer de fenêtre. */}
      <div
        role="tablist"
        aria-label="Période"
        className="inline-flex gap-1 rounded-lg bg-gray-100 p-1"
      >
        {PERIODES.map((p) => {
          const on = (p.jours || 0) === (jours || 0);
          return (
            <Link
              key={p.jours}
              role="tab"
              aria-selected={on}
              href={`/admin/funnel?j=${p.jours}`}
              className={`flex min-h-11 items-center rounded-md px-4 text-sm font-medium transition-all ${
                on
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted active:bg-white/60"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {/* ── La fuite principale, annoncée en clair ───────────────────────── */}
      {perdus > 0 && (
        <Card className="border-l-4 border-l-red-500 p-5">
          <p className="text-sm font-semibold text-muted">
            Ta plus grosse perte
          </p>
          <p className="mt-1 text-lg font-bold">
            {perdus} client{perdus > 1 ? "s" : ""} perdu
            {perdus > 1 ? "s" : ""} entre «&nbsp;{avant.label}&nbsp;» et «&nbsp;
            {fuite.label}&nbsp;»
          </p>
          <p className="mt-1 text-sm text-muted">
            Seulement <strong>{fuite.fromPrev} %</strong> franchissent cette
            étape. C&apos;est là que tu gagnes le plus à corriger quelque chose.
          </p>
        </Card>
      )}

      {/* ── L'entonnoir ──────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="space-y-4">
          {data.steps.map((s, i) => {
            const estFuite = i === pire && perdus > 0;
            return (
              <div key={s.label}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span className="text-sm tabular-nums">
                    <strong className="text-base">{s.count}</strong>
                    <span className="text-muted"> · {s.fromTop} %</span>
                  </span>
                </div>
                <div className="h-8 w-full overflow-hidden rounded-lg bg-gray-100">
                  <div
                    className={`flex h-full items-center rounded-lg transition-[width] duration-700 ${
                      estFuite ? "bg-red-500" : "bg-primary"
                    }`}
                    style={{ width: `${Math.max(s.fromTop, 1)}%` }}
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-xs text-muted">{s.hint}</span>
                  {i > 0 && (
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        estFuite ? "text-red-600" : "text-muted"
                      }`}
                    >
                      {s.fromPrev} % de l&apos;étape précédente
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-5 border-t border-border pt-4 text-xs text-muted">
          Les six étapes portent sur les <strong>mêmes clients</strong> : ceux
          inscrits pendant la période. Un client inscrit en janvier qui achète
          en mars ne fausse donc pas le taux de janvier.
        </p>
      </Card>

      {/* ── Paiements : l'étape qui coûte le plus cher ───────────────────── */}
      <Card className="p-5">
        <h2 className="font-bold">Paiements Mobile Money</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Chiffre label="Encaissé" value={formatXof(data.encaisse)} fort />
          <Chiffre
            label="Paiements réussis"
            value={`${data.paiementsReussis}`}
          />
          <Chiffre
            label="Paiements échoués"
            value={`${data.paiementsEchoues}`}
            rouge={data.paiementsEchoues > data.paiementsReussis}
          />
          <Chiffre label="Taux de réussite" value={`${tauxPaiement} %`} />
        </div>
        {data.montantPerdu > 0 && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <strong>{formatXof(data.montantPerdu)}</strong> ont été lancés en
            paiement sans jamais aboutir. Une partie est normale (le client
            change d&apos;avis), mais au-delà de la moitié c&apos;est le
            paiement lui-même qui bloque.
          </p>
        )}
        {data.credite > 0 && (
          <p className="mt-3 text-xs text-muted">
            Hors encaissement : {formatXof(data.credite)} crédités à la main
            (dédommagements, cadeaux).
          </p>
        )}
      </Card>

      {/* ── Activations : où partent les numéros ─────────────────────────── */}
      <Card className="p-5">
        <h2 className="font-bold">Que deviennent les numéros achetés</h2>
        <div className="mt-4 space-y-2">
          {data.activations.map((a) => {
            const total =
              data.activations.reduce((n, x) => n + x.count, 0) || 1;
            const pct = Math.round((a.count / total) * 100);
            const bon = a.status === "RECEIVED" || a.status === "COMPLETED";
            return (
              <div key={a.status} className="flex items-center gap-3">
                <span className="w-44 shrink-0 text-sm">
                  {libelleStatut(a.status)}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${bon ? "bg-success" : "bg-gray-400"}`}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-sm tabular-nums">
                  {a.count}
                  <span className="text-muted"> · {pct} %</span>
                </span>
              </div>
            );
          })}
          {!data.activations.length && (
            <p className="text-sm text-muted">
              Aucune activation sur cette période.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function Chiffre({
  label,
  value,
  fort = false,
  rouge = false,
}: {
  label: string;
  value: string;
  fort?: boolean;
  rouge?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-0.5 font-bold tabular-nums ${
          rouge ? "text-red-600" : ""
        } ${fort ? "text-xl" : "text-lg"}`}
      >
        {value}
      </p>
    </div>
  );
}
