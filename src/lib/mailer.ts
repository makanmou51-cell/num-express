import "server-only";
import { env } from "@/lib/env";

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function sendViaResend(m: MailInput): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.mail.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.mail.from,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend a échoué: ${res.status} ${await res.text()}`);
  }
}

/** Envoie un e-mail via le prestataire configuré (resend), ou journalise (log). */
export async function sendMail(m: MailInput): Promise<void> {
  if (env.mail.provider === "resend" && env.mail.resendApiKey) {
    await sendViaResend(m);
    return;
  }
  // Mode dev : on journalise (le lien est ainsi récupérable dans les logs).
  console.log(
    `\n[mailer:log] ─────────────────────────────\nÀ      : ${m.to}\nSujet  : ${m.subject}\n${m.text}\n──────────────────────────────────────\n`,
  );
}

function layout(title: string, body: string, cta: { label: string; href: string }) {
  return `<!doctype html><html lang="fr"><body style="font-family:system-ui,sans-serif;background:#f7f8fa;padding:24px;color:#0f172a">
  <div style="max-width:480px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px">
    <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
    <p style="color:#475569;line-height:1.5">${body}</p>
    <p style="margin:24px 0">
      <a href="${cta.href}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;display:inline-block;font-weight:600">${cta.label}</a>
    </p>
    <p style="color:#94a3b8;font-size:12px">Ou copiez ce lien : ${cta.href}</p>
  </div></body></html>`;
}

export function verifyEmailTemplate(link: string) {
  return {
    subject: "Confirmez votre adresse e-mail — num express",
    text: `Bienvenue sur num express !\nConfirmez votre adresse e-mail en ouvrant ce lien : ${link}\n(valable 24 h)`,
    html: layout(
      "Confirmez votre adresse e-mail",
      "Bienvenue sur num express ! Cliquez ci-dessous pour activer votre compte. Lien valable 24 heures.",
      { label: "Confirmer mon e-mail", href: link },
    ),
  };
}

export function resetPasswordTemplate(link: string) {
  return {
    subject: "Réinitialisation de votre mot de passe — num express",
    text: `Vous avez demandé à réinitialiser votre mot de passe.\nOuvrez ce lien : ${link}\n(valable 1 h). Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    html: layout(
      "Réinitialiser votre mot de passe",
      "Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
      { label: "Choisir un nouveau mot de passe", href: link },
    ),
  };
}
