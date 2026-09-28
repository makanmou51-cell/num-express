import type { Metadata } from "next";
import { countRecipients } from "@/lib/admin";
import { Alert, Card } from "@/components/ui";
import { env } from "@/lib/env";
import {
  currentBroadcast,
  broadcastProgress,
  sentToday,
  DAILY_LIMIT,
} from "@/lib/broadcast";
import { BroadcastForm } from "./broadcast-form";
import { BroadcastProgress } from "./broadcast-progress";
import { PushBroadcastForm } from "./push-form";
import { countActiveSubscriptions } from "@/lib/push";

export const metadata: Metadata = { title: "Admin — Messages" };
// Un lot d'envois prend plusieurs dizaines de secondes.
export const maxDuration = 60;

export default async function BroadcastPage() {
  const [recipientCount, subscribers, enCours, envoyesAujourdhui] =
    await Promise.all([
      countRecipients(),
      countActiveSubscriptions(),
      currentBroadcast(),
      sentToday(),
    ]);
  const quotaRestant = Math.max(0, DAILY_LIMIT - envoyesAujourdhui);
  const mailReady =
    env.mail.provider === "resend" && Boolean(env.mail.resendApiKey);

  const progress = enCours ? await broadcastProgress(enCours.id) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages aux utilisateurs</h1>
        <p className="text-muted">
          Envoyez un e-mail à tous vos utilisateurs (annonces, promotions,
          nouveautés).
        </p>
      </div>

      {!mailReady && (
        <Alert variant="error">
          L&apos;envoi d&apos;e-mails n&apos;est pas configuré
          (MAIL_PROVIDER=resend + RESEND_API_KEY). Les messages seront seulement
          journalisés.
        </Alert>
      )}

      {enCours && progress ? (
        <BroadcastProgress
          id={enCours.id}
          subject={enCours.subject}
          quotaRestant={quotaRestant}
          {...progress}
        />
      ) : (
        <>
          <Card className="max-w-2xl p-6">
            <BroadcastForm
              recipientCount={recipientCount}
              quotaRestant={quotaRestant}
            />
          </Card>
          <p className="max-w-2xl text-xs text-muted">
            Le message part à <strong>{recipientCount}</strong> destinataire(s),
            par lots. Vérifiez bien le sujet et le texte : une fois le premier
            lot parti, il est irréversible — mais vous pourrez arrêter les
            suivants.
          </p>
        </>
      )}

      <div className="max-w-2xl border-t border-border pt-6">
        <h2 className="text-lg font-bold">Notification navigateur</h2>
        <p className="mt-1 text-sm text-muted">
          Arrive sur le téléphone même quand le site est fermé. Réservée aux
          annonces qui font revenir : nouveaux stocks, nouveau pays.
        </p>
        <Card className="mt-4 p-6">
          <PushBroadcastForm subscribers={subscribers} />
        </Card>
        <p className="mt-3 text-xs text-muted">
          Une notification de trop et le client retire l&apos;autorisation — et
          elle ne se redemande pas. Une annonce par semaine au maximum.
        </p>
      </div>
    </div>
  );
}
