import { Card } from "@/components/ui";
import { grizzly } from "@/lib/grizzly/client";

/**
 * La SECONDE API de HeroSMS — celle que num express n'utilise pas.
 *
 * Découverte le 2026-10-04, par Michael, en interrogeant leur support : tout
 * notre code parle à l'ancienne `stubs/handler_api.php` (protocole
 * sms-activate), alors qu'il existe une API REST moderne, documentée en
 * OpenAPI 3.2 sur `hero-sms.com/<langue>/api`, serveur
 * `https://hero-sms.com/api/v1`.
 *
 * Son sommaire annonce des choses que l'ancienne n'a pas :
 *   · « Recevoir des offres d'activation » — potentiellement l'accès au
 *     premium « Mon prix », resté hors de portée par l'ancienne API (prouvé
 *     par 4 achats réels) et soupçonné d'être la cause des 8 % de réussite ;
 *   · « Demander un changement de numéro » — rendre un numéro qui ne reçoit
 *     rien et en obtenir un autre, au lieu de rembourser ;
 *   · Statistics — peut-être des taux de réussite par pays ;
 *   · Webhooks — le code poussé en temps réel, au lieu d'interroger en boucle.
 *
 * Cette sonde appelle les endpoints DOCUMENTÉS, en lecture seule, avec notre
 * clé. Le schéma d'authentification n'étant pas public, elle essaie les trois
 * conventions usuelles et retient celle qui répond. Aucun achat, aucun débit.
 */

const APPELS: ReadonlyArray<{ path: string; quoi: string }> = [
  {
    path: "/activations/offers/sms",
    quoi: "LES OFFRES SMS — paliers de prix. C'est ici que se joue le premium.",
  },
  {
    path: "/activations/offers/flashcall",
    quoi: "Offres FlashCall (l'endpoint donné par leur support)",
  },
  {
    path: "/statistics",
    quoi: "Statistiques — taux de réussite par pays ?",
  },
];

export async function RestApiProbe() {
  const resultats: Array<{
    path: string;
    quoi: string;
    essais: Array<{ auth: string; status: number; body: string }>;
  }> = [];
  for (const a of APPELS) {
    resultats.push({ ...a, essais: await grizzly.probeRest(a.path) });
  }

  return (
    <Card className="p-5">
      <h2 className="font-bold">
        API REST HeroSMS (<code className="text-sm">/api/v1</code>) — celle
        qu&apos;on n&apos;utilise pas
      </h2>
      <p className="mt-1 text-sm text-muted">
        Lecture seule, avec notre clé. Aucun numéro acheté, solde intact. Trois
        conventions d&apos;authentification sont essayées&nbsp;; la première qui
        répond est la bonne.
      </p>

      <div className="mt-4 space-y-3">
        {resultats.map((r) => {
          const gagnant = r.essais.find((e) => e.status === 200);
          return (
            <div
              key={r.path}
              className={`rounded-lg border p-3 ${
                gagnant
                  ? "border-green-300 bg-green-50"
                  : "border-border bg-gray-50"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="text-sm font-semibold">GET {r.path}</code>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    gagnant
                      ? "bg-green-600 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {gagnant ? `répond · ${gagnant.auth}` : "aucune réponse"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">{r.quoi}</p>
              <div className="mt-2 space-y-1.5">
                {r.essais.map((e, i) => (
                  <div key={`${e.auth}-${i}`}>
                    <p className="text-[11px] font-medium text-muted">
                      {e.auth} → HTTP {e.status || "erreur"}
                    </p>
                    <pre className="max-h-32 overflow-auto rounded bg-white/70 p-2 text-[11px] leading-relaxed">
                      {e.body || "(vide)"}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
        Un <strong>vert</strong> sur <code>/activations/offers/sms</code>{" "}
        signifie qu&apos;on peut enfin voir — et donc acheter — autre chose que
        le numéro le moins cher. C&apos;est le mur contre lequel on bute depuis
        août.
      </p>
    </Card>
  );
}
