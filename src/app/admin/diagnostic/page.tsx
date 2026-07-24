import type { Metadata } from "next";
import { env } from "@/lib/env";
import { grizzly, isGrizzlyMock } from "@/lib/grizzly/client";
import { getCatalogForService } from "@/lib/grizzly/catalog";
import { getSettings } from "@/lib/settings";
import { Alert, Badge, Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { inspectOnlineSim, inspectCatalogStrategies } from "@/lib/onlinesim/probe";

export const metadata: Metadata = { title: "Admin — Diagnostic Grizzly" };
export const dynamic = "force-dynamic";

async function safe<T>(fn: () => Promise<T>): Promise<
  { ok: true; value: T } | { ok: false; error: string }
> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export default async function GrizzlyDiagnosticPage() {
  const [settings, balance, countries, catalog, active, os, strategies] =
    await Promise.all([
      getSettings(),
      safe(() => grizzly.getBalance()),
      safe(() => grizzly.getCountries()),
      safe(() => getCatalogForService("wa")),
      safe(() => grizzly.getActiveActivations()),
      safe(() => inspectOnlineSim(49)),
      safe(() => inspectCatalogStrategies()),
    ]);

  const firstCountryRaw =
    countries.ok && Object.keys(countries.value).length
      ? JSON.stringify(
          countries.value[Object.keys(countries.value)[0]],
          null,
          2,
        )
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Diagnostic Grizzly</h1>
        <p className="text-muted">
          Vérification en direct de la connexion à l'API fournisseur.
        </p>
      </div>

      {isGrizzlyMock ? (
        <Alert variant="info">
          <strong>Mode démo</strong> — aucune clé <code>GRIZZLY_API_KEY</code>{" "}
          configurée : les données ci-dessous sont simulées. Renseignez votre
          clé dans <code>.env</code> pour passer en réel.
        </Alert>
      ) : (
        <Alert variant="success">
          Mode réel — connecté à <code>{env.grizzly.baseUrl}</code>
        </Alert>
      )}

      {/* Solde */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Solde fournisseur (Grizzly)</p>
            {balance.ok ? (
              <p className="mt-1 text-2xl font-bold">
                {balance.value.toFixed(2)} {env.grizzly.currency}
              </p>
            ) : (
              <p className="mt-1 text-sm text-red-600">{balance.error}</p>
            )}
          </div>
          <StatusPill ok={balance.ok} />
        </div>
        {balance.ok && (
          <p className="mt-2 text-xs text-muted">
            Conversion : 1 {env.grizzly.currency} = {settings.fxToXof} F CFA ·
            bénéfice +{settings.tier1ProfitXof}/{settings.tier2ProfitXof}/
            {settings.tier3ProfitXof} F CFA selon la tranche de coût
          </p>
        )}
      </Card>

      {/* Résumé des appels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <CheckCard
          title="getCountries"
          ok={countries.ok}
          detail={
            countries.ok
              ? `${Object.keys(countries.value).length} pays`
              : countries.error
          }
        />
        <CheckCard
          title="getPrices (WhatsApp)"
          ok={catalog.ok}
          detail={
            catalog.ok ? `${catalog.value.length} pays dispo` : catalog.error
          }
        />
        <CheckCard
          title="getActiveActivations"
          ok={active.ok}
          detail={
            active.ok ? `${active.value.length} en cours` : active.error
          }
        />
      </div>

      {/* Aperçu catalogue WhatsApp */}
      {catalog.ok && (
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">
            Aperçu catalogue — WhatsApp (5 moins chers)
          </h2>
          {catalog.value.length === 0 ? (
            <p className="text-sm text-muted">
              Aucune offre WhatsApp disponible actuellement.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {catalog.value.slice(0, 5).map((o) => (
                <li
                  key={o.countryCode}
                  className="flex items-center justify-between py-2"
                >
                  <span>
                    {o.countryName}{" "}
                    <span className="text-muted">
                      (coût {o.rawCost} {env.grizzly.currency} · {o.count} dispo)
                    </span>
                  </span>
                  <strong>{formatXof(o.priceXof)}</strong>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Sonde OnlineSim — vérifie que l'IP Vercel n'est pas bloquée */}
      <Card className="p-5">
        <h2 className="mb-1 font-semibold">
          Sonde OnlineSim (depuis le serveur Vercel)
        </h2>
        <p className="mb-3 text-xs text-muted">
          Appels en lecture seule — n'achètent aucun numéro. Sert à vérifier la
          connectivité et à relever les formats de réponse.
        </p>
        {!os.ok ? (
          <Alert variant="error">{os.error}</Alert>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Info label="Solde OnlineSim" value={`$${os.value.balance}`} />
              <Info
                label="Pays (getTariffs)"
                value={String(os.value.countryCount ?? "?")}
              />
              <Info
                label="Clé service WhatsApp"
                value={os.value.whatsappKey ?? "introuvable"}
              />
            </div>

            <Raw
              title="Entrée WhatsApp (Allemagne) — cherche le champ du PRIX"
              body={os.value.whatsappEntry}
            />
            <Raw
              title="Exemple de pays (getTariffs)"
              body={os.value.countrySample}
            />
            <Raw
              title={`Services disponibles (${os.value.serviceKeys.length})`}
              body={os.value.serviceKeys.join("\n")}
            />

            {os.value.notes.length > 0 && (
              <Alert variant="info">
                {os.value.notes.map((n, i) => (
                  <p key={i}>{n}</p>
                ))}
              </Alert>
            )}
          </div>
        )}
      </Card>

      {/* Quelle requête permet de bâtir le catalogue en 1 appel ? */}
      <Card className="p-5">
        <h2 className="mb-1 font-semibold">
          OnlineSim — stratégie catalogue (tous les pays en 1 appel ?)
        </h2>
        <p className="mb-3 text-xs text-muted">
          On cherche la variante qui renvoie tous les pays d'un service avec
          leur prix. Idéal : beaucoup d'entrées + « prix: oui ».
        </p>
        {!strategies.ok ? (
          <Alert variant="error">{strategies.error}</Alert>
        ) : (
          <div className="space-y-4">
            {strategies.value.map((s) => (
              <div key={s.label}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="text-sm">{s.label}</code>
                  <span className="text-xs text-muted">
                    HTTP {s.status ?? "—"} · {s.bytes} octets ·{" "}
                    <strong>{s.entryCount ?? 0} entrées</strong> · whatsapp:{" "}
                    {s.hasWhatsapp ? "oui" : "non"} · prix:{" "}
                    {s.hasPrice ? "oui" : "non"}
                  </span>
                </div>
                {s.topKeys.length > 0 && (
                  <p className="mt-1 text-xs text-muted">
                    clés racine : <code>{s.topKeys.join(", ")}</code>
                  </p>
                )}
                <pre className="mt-1 max-h-52 overflow-auto rounded-lg bg-gray-900 p-3 text-xs whitespace-pre-wrap break-all text-gray-100">
                  {s.error ? `ERREUR : ${s.error}` : s.snippet}
                </pre>
                {s.whatsappContext && (
                  <>
                    <p className="mt-2 text-xs font-medium">
                      ⬇ Texte brut autour de « whatsapp » (où sont les prix)
                    </p>
                    <pre className="mt-1 max-h-52 overflow-auto rounded-lg bg-emerald-950 p-3 text-xs whitespace-pre-wrap break-all text-emerald-100">
                      {s.whatsappContext}
                    </pre>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Échantillon JSON brut (calibration des formats) */}
      {firstCountryRaw && (
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">
            Échantillon brut getCountries (1er pays)
          </h2>
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
            {firstCountryRaw}
          </pre>
        </Card>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 break-all font-semibold">{value}</p>
    </div>
  );
}

function Raw({ title, body }: { title: string; body: string | null }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{title}</p>
      <pre className="max-h-72 overflow-auto rounded-lg bg-gray-900 p-3 text-xs whitespace-pre-wrap break-all text-gray-100">
        {body || "(vide)"}
      </pre>
    </div>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <Badge
      className={ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}
    >
      {ok ? "OK" : "Erreur"}
    </Badge>
  );
}

function CheckCard({
  title,
  ok,
  detail,
}: {
  title: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <code className="text-sm">{title}</code>
        <StatusPill ok={ok} />
      </div>
      <p
        className={`mt-2 text-sm ${ok ? "text-muted" : "text-red-600"}`}
      >
        {detail}
      </p>
    </Card>
  );
}
