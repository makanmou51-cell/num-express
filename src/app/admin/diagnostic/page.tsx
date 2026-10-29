import type { Metadata } from "next";
import { env } from "@/lib/env";
import { grizzly, isGrizzlyMock } from "@/lib/grizzly/client";
import { getCatalogForService } from "@/lib/grizzly/catalog";
import { getSettings } from "@/lib/settings";
import { Alert, Badge, Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import {
  inspectOnlineSim,
  inspectCatalogStrategies,
} from "@/lib/onlinesim/probe";
import { usingOnlineSim, usingHeroSms } from "@/lib/grizzly/catalog";
import { usingAcckitOtp } from "@/lib/acckit/otp-catalog";
import { acckit } from "@/lib/acckit/client";
import { otpCountries } from "@/lib/acckit/otp";
import { Suspense } from "react";
import { RentalsProbe } from "./rentals-probe";
import { RestApiProbe } from "./rest-api-probe";
import { DeliverabilityPanel } from "./deliverability";
import { WebhookStatus } from "./webhook-status";

export const metadata: Metadata = { title: "Admin — Diagnostic Grizzly" };
export const dynamic = "force-dynamic";

async function safe<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* Le fournisseur réellement actif. Cette page affichait « Grizzly SMS » en
   dur dès que ce n'était pas OnlineSim — donc aussi quand HeroSMS tournait,
   ce qui laissait croire à une mauvaise configuration alors que tout était
   correct (le solde affiché était bien celui d'HeroSMS). */
const PROVIDER_LABEL = usingAcckitOtp
  ? "AccKit"
  : usingOnlineSim
    ? "OnlineSim"
    : usingHeroSms
      ? "HeroSMS"
      : "Grizzly SMS";
const PROVIDER_BASE_URL = usingAcckitOtp
  ? env.acckit.baseUrl
  : usingHeroSms
    ? env.heroSms.baseUrl
    : env.grizzly.baseUrl;
const PROVIDER_CURRENCY = usingAcckitOtp
  ? "VND"
  : usingHeroSms
    ? env.heroSms.currency
    : env.grizzly.currency;

export default async function GrizzlyDiagnosticPage() {
  const [settings, balance, countries, catalog, active, os, strategies] =
    await Promise.all([
      getSettings(),
      /* Le solde doit venir du fournisseur ACTIF. La page interrogeait
         toujours grizzly.getBalance(), qui retombe sur Grizzly des que le
         fournisseur n est ni HeroSMS ni OnlineSim : avec AccKit actif, elle
         affichait le solde d un compte Grizzly inutilise — 0,41 USD — en
         laissant croire que les ventes allaient s arreter. */
      safe(() => (usingAcckitOtp ? acckit.balance() : grizzly.getBalance())),
      /* Sous AccKit, grizzly.getCountries() renvoyait les 206 pays d un
         fournisseur qu on n utilise pas. On interroge celui qui sert. */
      safe(async () =>
        usingAcckitOtp
          ? Object.fromEntries(
              (await otpCountries()).map((c) => [c.country, c.name]),
            )
          : grizzly.getCountries(),
      ),
      safe(() => getCatalogForService("wa")),
      /* AccKit n a pas d equivalent « activations en cours » : on n affiche
         donc rien plutot qu un chiffre venu d ailleurs. */
      safe(async () =>
        usingAcckitOtp ? [] : await grizzly.getActiveActivations(),
      ),
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
        <h1 className="text-2xl font-bold">Diagnostic fournisseur</h1>
        <p className="text-muted">
          Vérification en direct de la connexion aux API fournisseurs.
        </p>
      </div>

      {/* SOLDE EN PREMIER : c'est le chiffre qui coupe les ventes quand il
          tombe a zero - tous les achats echouent d'un coup. Il etait enterre
          sous les sondes techniques, Michael a demande a le voir d'abord. */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">
              Solde fournisseur ({PROVIDER_LABEL})
            </p>
            {balance.ok ? (
              <>
                {/* AccKit facture en dongs vietnamiens. « 171 015 VND » ne dit
                    rien a personne ici : on affiche donc d abord le montant en
                    F CFA, la monnaie dans laquelle on vend, puis l equivalent
                    en dollars pour comparer aux autres fournisseurs, et le
                    montant brut du fournisseur en dessous. */}
                {usingAcckitOtp ? (
                  <>
                    <p className="mt-1 text-2xl font-bold">
                      {formatXof(Math.round(balance.value / env.acckit.vndPerXof))}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      soit{" "}
                      {(
                        balance.value /
                        env.acckit.vndPerXof /
                        settings.fxToXof
                      ).toFixed(2)}{" "}
                      USD · {balance.value.toLocaleString("fr-FR")} VND chez
                      AccKit
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-2xl font-bold">
                    {balance.value.toFixed(2)} {PROVIDER_CURRENCY}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-red-600">{balance.error}</p>
            )}
          </div>
          <StatusPill ok={balance.ok} />
        </div>
        {balance.ok && (
          <p className="mt-2 text-xs text-muted">
            {usingAcckitOtp ? (
              <>
                Conversion : {env.acckit.vndPerXof} VND = 1 F CFA · bénéfice
                fixe +{formatXof(env.acckit.profitXof)} par numéro
              </>
            ) : (
              <>
                Conversion : 1 {env.grizzly.currency} = {settings.fxToXof} F CFA
                · bénéfice +{settings.tier1ProfitXof}/{settings.tier2ProfitXof}/
                {settings.tier3ProfitXof} F CFA selon la tranche de coût
              </>
            )}
          </p>
        )}
      </Card>

      {/* Les quatre panneaux qui suivent interrogent HeroSMS. Son domaine
          n existe plus depuis le 18 octobre — « Non-existent domain » — donc
          ils ne peuvent qu echouer. Les afficher quand AccKit est actif
          remplissait la page de « fetch failed » et laissait croire a une
          panne de notre cote. */}
      {!usingAcckitOtp && (
        <>
      {/* Le webhook est-il reellement branche ? Leur API ne permet pas de
          relire le reglage : seul un appel recu le prouve. */}
      <Suspense
        fallback={
          <Card className="p-5">
            <p className="text-sm text-muted">Lecture du témoin webhook…</p>
          </Card>
        }
      >
        <WebhookStatus />
      </Suspense>

      {/* LA donnee qu'on cherchait : la delivrabilite publiee par HeroSMS,
          par pays ET par operateur. En premier, c'est le plus important. */}
      <Suspense
        fallback={
          <Card className="p-5">
            <p className="text-sm text-muted">
              Lecture de la délivrabilité HeroSMS…
            </p>
          </Card>
        }
      >
        <DeliverabilityPanel service="wa" />
      </Suspense>

      {/* API REST moderne de HeroSMS : la piste la plus prometteuse depuis
          aout - elle pourrait donner acces au premium « Mon prix ». */}
      <Suspense
        fallback={
          <Card className="p-5">
            <p className="text-sm text-muted">
              Interrogation de l&apos;API REST HeroSMS…
            </p>
          </Card>
        }
      >
        <RestApiProbe />
      </Suspense>

      {/* Sonde location : montre, duree par duree, ce qu'on peut reellement
          vendre. Repond a « pourquoi la page d'achat dit Indisponible ».
          Sous Suspense : elle interroge HeroSMS pays par pays, le reste de la
          page ne doit pas attendre. */}
      <Suspense
        fallback={
          <Card className="p-5">
            <p className="text-sm text-muted">
              Interrogation des locations chez HeroSMS…
            </p>
          </Card>
        }
      >
        <RentalsProbe service="wa" />
      </Suspense>
        </>
      )}

      <Alert variant={usingOnlineSim ? "info" : "success"}>
        <strong>Fournisseur ACTIF : {PROVIDER_LABEL}</strong> — c&apos;est lui qui
        délivre les numéros vendus sur le site.{" "}
        {usingOnlineSim
          ? "Grizzly reste connecté ci-dessous, mais n'est plus utilisé."
          : `Connecté à ${PROVIDER_BASE_URL}`}
      </Alert>

      {isGrizzlyMock && (
        <Alert variant="info">
          <strong>Mode démo Grizzly</strong> — aucune clé{" "}
          <code>GRIZZLY_API_KEY</code> configurée : les données Grizzly
          ci-dessous sont simulées.
        </Alert>
      )}

      {/* Résumé des appels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <CheckCard
          title={usingAcckitOtp ? "Pays du fournisseur" : "getCountries"}
          ok={countries.ok}
          detail={
            countries.ok
              ? `${Object.keys(countries.value).length} pays`
              : countries.error
          }
        />
        <CheckCard
          title={`Catalogue WhatsApp (${PROVIDER_LABEL})`}
          ok={catalog.ok}
          detail={
            catalog.ok ? `${catalog.value.length} pays dispo` : catalog.error
          }
        />
        <CheckCard
          title={
            usingAcckitOtp ? "Activations en cours" : "getActiveActivations"
          }
          ok={active.ok}
          detail={active.ok ? `${active.value.length} en cours` : active.error}
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
                      (coût {o.rawCost} {env.grizzly.currency} · {o.count}{" "}
                      dispo)
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
          Appels en lecture seule — n&apos;achètent aucun numéro. Sert à vérifier la
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
          On cherche la variante qui renvoie tous les pays d&apos;un service avec
          leur prix. Idéal : beaucoup d&apos;entrées + « prix: oui ».
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
      <p className={`mt-2 text-sm ${ok ? "text-muted" : "text-red-600"}`}>
        {detail}
      </p>
    </Card>
  );
}
