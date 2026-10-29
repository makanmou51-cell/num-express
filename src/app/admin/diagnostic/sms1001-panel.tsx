import { Card } from "@/components/ui";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { formatXof } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import {
  configWebhook,
  detailPays,
  tauxMesure,
  type Sms1001ConfigWebhook,
  type Sms1001Operateur,
} from "@/lib/sms1001/client";
import { choisirLigne, encoderLigne } from "@/lib/sms1001/catalog";

/**
 * État de la liaison 1001SMS.
 *
 * Trois questions auxquelles ce panneau répond, et qu'on ne peut pas se poser
 * depuis leur interface :
 *
 * 1. LE WEBHOOK EST-IL ARMÉ ? C'est l'intérêt principal de ce fournisseur :
 *    il pousse le code au lieu de nous faire l'attendre. Contrairement à
 *    HeroSMS, leur API permet de RELIRE le réglage — on affiche donc l'URL
 *    enregistrée chez eux, pas seulement notre témoin de réception. Ils
 *    désactivent après 20 échecs consécutifs, en silence : le compteur est
 *    affiché avant qu'il soit trop tard.
 *
 * 2. LE SECRET EST-IL EN PLACE DE NOTRE CÔTÉ ? Sans lui le webhook refuse
 *    tout — c'est voulu, on ne crédite pas un code sur parole — mais il faut
 *    pouvoir le constater d'un coup d'œil.
 *
 * 3. QUELLE LIGNE ACHÈTE-T-ON VRAIMENT ? Un pays expose jusqu'à 21 lignes sur
 *    quatre pools de gros. Le panneau montre ce que `choisirLigne` retient et
 *    pourquoi, sur un pays témoin.
 */

/** Pays témoin : c'est là que leurs mesures sont les plus parlantes. */
const PAYS_TEMOIN = "philippines";

async function sans<T>(fn: () => Promise<T>): Promise<T | { erreur: string }> {
  try {
    return await fn();
  } catch (e) {
    return { erreur: (e as Error).message };
  }
}

function estErreur<T>(v: T | { erreur: string }): v is { erreur: string } {
  return Boolean(v) && typeof v === "object" && "erreur" in (v as object);
}

export async function Sms1001Panel() {
  const [config, ops, succes, refus, reglages] = await Promise.all([
    sans(configWebhook),
    sans(() => detailPays(PAYS_TEMOIN, "whatsapp")),
    prisma.setting.findUnique({
      where: { key: "sms1001_webhook_dernier_succes" },
    }),
    prisma.setting.findUnique({
      where: { key: "sms1001_webhook_dernier_refus" },
    }),
    getSettings(),
  ]);

  const secretPresent = Boolean(env.sms1001.webhookSecret);

  return (
    <Card className="space-y-5 p-5">
      <h2 className="font-bold">1001SMS — liaison</h2>

      <EtatWebhook
        config={config}
        secretPresent={secretPresent}
        dernierSucces={succes?.value}
        dernierRefus={refus?.value}
      />

      <LignesPays ops={ops} fx={reglages.fxToXof} />
    </Card>
  );
}

function EtatWebhook({
  config,
  secretPresent,
  dernierSucces,
  dernierRefus,
}: {
  config: Sms1001ConfigWebhook | { erreur: string };
  secretPresent: boolean;
  dernierSucces?: string;
  dernierRefus?: string;
}) {
  if (estErreur(config)) {
    return (
      <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-900">
        <strong>Webhook&nbsp;: état illisible.</strong> {config.erreur}
      </div>
    );
  }

  const arme = config.status === "active" && Boolean(config.url);
  const desactive = config.status === "disabled";

  return (
    <div className="space-y-2">
      <p
        className={`rounded-lg px-3 py-2.5 text-sm ${
          desactive
            ? "bg-red-50 text-red-900"
            : arme && secretPresent
              ? "bg-green-50 text-green-900"
              : "bg-amber-50 text-amber-900"
        }`}
      >
        {desactive ? (
          <>
            <strong>Webhook DÉSACTIVÉ par 1001SMS</strong> après{" "}
            {config.failures} échecs consécutifs. Il faut réenregistrer l&apos;URL
            pour le réarmer — aucun code ne sera poussé d&apos;ici là.
          </>
        ) : !config.url ? (
          <>
            <strong>Webhook non configuré.</strong> Les codes ne sont récupérés
            que par interrogation, comme chez AccKit. Enregistre l&apos;URL pour
            qu&apos;ils soient poussés dès l&apos;arrivée du SMS.
          </>
        ) : !secretPresent ? (
          <>
            <strong>URL enregistrée, mais SMS1001_WEBHOOK_SECRET manque.</strong>{" "}
            Tout envoi est refusé — c&apos;est voulu&nbsp;: sans la signature, on
            ne crédite pas un code sur parole.
          </>
        ) : (
          <>
            <strong>Armé.</strong> Les codes sont poussés dès l&apos;arrivée du
            SMS, signature vérifiée.
          </>
        )}
      </p>

      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted">URL chez eux</dt>
        <dd className="break-all">
          <code>{config.url ?? "—"}</code>
        </dd>
        <dt className="text-muted">Événements</dt>
        <dd>{config.events.length ? config.events.join(", ") : "—"}</dd>
        <dt className="text-muted">Secret (notre côté)</dt>
        <dd>{secretPresent ? "présent" : "ABSENT"}</dd>
        <dt className="text-muted">Échecs consécutifs</dt>
        <dd>
          {config.failures}
          {config.failures > 0 && (
            <span className="text-muted"> — coupure à 20</span>
          )}
        </dd>
        <dt className="text-muted">Dernier envoi accepté</dt>
        <dd>{dernierSucces ?? "aucun à ce jour"}</dd>
        <dt className="text-muted">Dernier envoi refusé</dt>
        <dd>{dernierRefus ?? "aucun"}</dd>
      </dl>
    </div>
  );
}

/**
 * Ce qu'on achète réellement sur un pays, et ce qu'on écarte.
 *
 * Le champ `deliverability` de 1001SMS ne mesure presque rien : 0 = jamais
 * mesuré, 30 = valeur par défaut collée sur le pool MAIN. Ce tableau
 * distingue donc les deux, sans quoi on croirait avoir 53 pays mesurés à
 * 30 % alors qu'on en a trois mesurés tout court.
 */
function LignesPays({
  ops,
  fx,
}: {
  ops: Sms1001Operateur[] | { erreur: string };
  fx: number;
}) {
  if (estErreur(ops)) {
    return (
      <p className="text-sm text-red-600">
        Lignes {PAYS_TEMOIN}&nbsp;: {ops.erreur}
      </p>
    );
  }

  const retenue = choisirLigne(ops);
  const triees = [...ops].sort((a, b) => a.price - b.price).slice(0, 8);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">
        Lignes WhatsApp · {PAYS_TEMOIN} ({ops.length} au total)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-1 pr-3 font-medium">Pool</th>
              <th className="py-1 pr-3 font-medium">Opérateur</th>
              <th className="py-1 pr-3 text-right font-medium">Coût</th>
              <th className="py-1 pr-3 text-right font-medium">Stock</th>
              <th className="py-1 font-medium">Taux</th>
            </tr>
          </thead>
          <tbody>
            {triees.map((o, i) => {
              const taux = tauxMesure(o);
              const choisie =
                retenue &&
                retenue.provider === o.provider &&
                retenue.operator === o.operator &&
                retenue.price === o.price;
              return (
                <tr
                  key={`${o.provider}:${o.operator}:${i}`}
                  className={choisie ? "font-semibold text-green-800" : ""}
                >
                  <td className="py-1 pr-3">{o.provider}</td>
                  <td className="py-1 pr-3">
                    {o.operator}
                    {choisie && " ←"}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {o.price.toFixed(2)} $
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {o.count.toLocaleString("fr-FR")}
                  </td>
                  <td className="py-1">
                    {taux !== undefined ? (
                      <span>{taux.toFixed(0)} % mesuré</span>
                    ) : (
                      <span className="text-muted">
                        {o.deliverability === 30
                          ? "30 % (valeur par défaut, pas une mesure)"
                          : "jamais mesuré"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {retenue && (
        <p className="text-xs text-muted">
          Ligne retenue&nbsp;: <code>{encoderLigne(retenue)}</code> à{" "}
          {retenue.price.toFixed(2)} $, soit {formatXof(Math.round(retenue.price * fx))}{" "}
          de coût.{" "}
          {retenue.taux !== undefined
            ? `Choisie sur son taux mesuré (${retenue.taux.toFixed(0)} %).`
            : "Aucune mesure exploitable sur ce pays : on prend la moins chère."}
        </p>
      )}
    </div>
  );
}
