import { Card } from "@/components/ui";
import { grizzly } from "@/lib/grizzly/client";

/**
 * Le FlashCall est-il réellement achetable par l'API HeroSMS ?
 *
 * Pourquoi cette sonde existe : HeroSMS vend « FlashCall + SMS » sur son site,
 * à un tarif distinct du SMS. Mais rien ne garantit que son API l'expose, ni
 * sous quel nom de paramètre. Le cas s'est déjà produit avec le premium
 * « Mon prix » : bien visible sur leur site, totalement inaccessible par
 * l'API — on l'avait appris en dépensant de l'argent sur quatre achats de
 * test. Cette fois on demande AVANT d'écrire la logique d'achat.
 *
 * Toutes les actions ci-dessous sont en LECTURE SEULE : aucune n'achète de
 * numéro, aucune ne débite le solde HeroSMS.
 */

/* Les actions candidates du protocole sms-activate pour la vérification par
   appel. On les essaie toutes : celles qui répondent nous disent ce qui est
   supporté, celles qui échouent nous disent ce qui ne l'est pas. */
const SONDES: ReadonlyArray<{
  action: string;
  params?: Record<string, string | number>;
  quoi: string;
}> = [
  {
    action: "getTopCountriesByService",
    params: { service: "wa" },
    quoi: "LE CLASSEMENT : pays les plus performants pour WhatsApp, selon HeroSMS",
  },
  {
    action: "getTopCountriesByService",
    params: { service: "wa", freePrice: "true" },
    quoi: "Même classement, variante avec prix libre",
  },
  {
    action: "getPricesVerification",
    params: { service: "wa" },
    quoi: "Prix FlashCall — déjà tranché : « Method Not Found »",
  },
  {
    action: "getPrices",
    params: { service: "wa", country: "43" },
    quoi: "Référence : prix SMS Allemagne (doit répondre)",
  },
];

export async function FlashCallProbe() {
  /* En SERIE, espacees. Le premier passage avait lance les cinq appels
     simultanement et HeroSMS avait repondu 429 RATE_LIMIT sur l'un d'eux —
     une limite de debit, pas un refus. On aurait conclu a tort que l'action
     n'existait pas. */
  const resultats: Array<
    (typeof SONDES)[number] & { r: { ok: boolean; body: string } }
  > = [];
  for (const s of SONDES) {
    resultats.push({
      ...s,
      r: await grizzly.probeRaw(s.action, s.params ?? {}),
    });
    await new Promise((r) => setTimeout(r, 1200));
  }

  return (
    <Card className="p-5">
      <h2 className="font-bold">Ce que l&apos;API HeroSMS expose vraiment</h2>
      <p className="mt-1 text-sm text-muted">
        Interrogé en direct chez HeroSMS, en lecture seule. Aucun numéro
        n&apos;est acheté, ton solde n&apos;est pas touché.
      </p>

      <div className="mt-4 space-y-3">
        {resultats.map((x, i) => {
          /* Une clé refusée ou une action inconnue se reconnaît au corps de la
             réponse, pas au code HTTP : HeroSMS répond 200 avec BAD_ACTION. */
          const corps = x.r.body.trim();
          const limite = /RATE_LIMIT|429/i.test(corps);
          const refus =
            !limite &&
            (!x.r.ok ||
              /BAD_ACTION|BAD_KEY|NO_KEY|ERROR_SQL|Unauthorized/i.test(corps));
          return (
            <div
              key={`${x.action}-${i}`}
              className={`rounded-lg border p-3 ${
                limite
                  ? "border-amber-300 bg-amber-50"
                  : refus
                    ? "border-border bg-gray-50"
                    : "border-green-300 bg-green-50"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="text-sm font-semibold">
                  {x.action}
                  {x.params
                    ? ` (${Object.entries(x.params)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")})`
                    : ""}
                </code>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    limite
                      ? "bg-amber-500 text-white"
                      : refus
                        ? "bg-gray-200 text-gray-700"
                        : "bg-green-600 text-white"
                  }`}
                >
                  {limite ? "trop de requêtes" : refus ? "refusé" : "répond"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">{x.quoi}</p>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-white/70 p-2 text-[11px] leading-relaxed">
                {corps.slice(0, 1200) || "(réponse vide)"}
              </pre>
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
        Un encadré <strong>vert</strong> signifie que HeroSMS accepte
        l&apos;action : le FlashCall est alors achetable, et son prix sert de
        base au calcul de ta marge. Tous gris = l&apos;API ne l&apos;expose pas,
        comme pour le premium « Mon prix ».
      </p>
    </Card>
  );
}
