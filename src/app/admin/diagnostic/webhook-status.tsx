import { Card } from "@/components/ui";
import { prisma } from "@/lib/db";

/**
 * Le webhook HeroSMS est-il réellement branché ?
 *
 * L'URL se configure dans le compte HeroSMS, et leur API n'expose aucun moyen
 * de relire ce réglage. Impossible donc de vérifier qu'il est enregistré —
 * sauf en constatant un appel. Les journaux Vercel ne sont gardés qu'une
 * heure sur le plan Hobby, ils ne servent à rien pour ça.
 *
 * Le webhook écrit donc une trace à chaque appel reçu, quel qu'en soit le
 * sort : acceptée, refusée pour IP inconnue, ou activation introuvable. Ce
 * panneau l'affiche. Tant qu'il reste vide, c'est que HeroSMS n'a jamais
 * appelé — soit l'URL n'est pas enregistrée chez eux, soit aucun code n'est
 * arrivé depuis.
 */
export async function WebhookStatus() {
  const [trace, enAttente] = await Promise.all([
    prisma.setting.findUnique({
      where: { key: "herosms_webhook_dernier_appel" },
    }),
    prisma.activation.count({ where: { status: "WAITING_CODE" } }),
  ]);

  const recu = Boolean(trace);

  return (
    <Card className="p-5">
      <h2 className="font-bold">Webhook HeroSMS — temps réel</h2>

      <p
        className={`mt-3 rounded-lg px-3 py-2.5 text-sm ${
          recu ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"
        }`}
      >
        {recu ? (
          <>
            <strong>Branché.</strong> Dernier appel reçu&nbsp;:{" "}
            <code className="text-xs">{trace?.value}</code>
          </>
        ) : (
          <>
            <strong>Aucun appel reçu à ce jour.</strong> Soit l&apos;URL
            n&apos;est pas enregistrée chez HeroSMS, soit aucun code n&apos;est
            arrivé depuis sa mise en service — les deux se ressemblent tant
            qu&apos;un SMS n&apos;est pas tombé.
          </>
        )}
      </p>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">URL à déclarer chez HeroSMS</dt>
          <dd className="text-right">
            <code className="text-xs">
              https://num-express.com/api/webhooks/herosms
            </code>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Activations en attente d&apos;un code</dt>
          <dd className="font-semibold tabular-nums">{enAttente}</dd>
        </div>
      </dl>

      {!recu && enAttente === 0 && (
        <p className="mt-3 text-xs text-muted">
          Aucune activation en cours&nbsp;: HeroSMS n&apos;a rien à envoyer pour
          l&apos;instant. Le premier achat qui reçoit son code tranchera.
        </p>
      )}
    </Card>
  );
}
