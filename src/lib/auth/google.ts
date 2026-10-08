import "server-only";
import { env } from "@/lib/env";

// Flux « Authorization Code » standard de Google Identity, en fetch brut
// (aucune dépendance) : /auth -> code -> échange -> profil.
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

/** La connexion Google n'est proposée que si les deux clés sont configurées. */
export function googleEnabled(): boolean {
  return Boolean(env.google.clientId && env.google.clientSecret);
}

/** URI de redirection déclaré côté Google (doit correspondre EXACTEMENT). */
export function googleRedirectUri(): string {
  return `${env.appUrl.replace(/\/+$/, "")}/api/auth/google/callback`;
}

/** URL vers laquelle envoyer l'utilisateur pour choisir son compte Google. */
export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleProfile {
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/** Échange le code d'autorisation contre le profil (e-mail vérifié + nom). */
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Échange du code Google échoué (${tokenRes.status})`);
  }
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) throw new Error("Jeton d'accès Google absent.");

  const infoRes = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) {
    throw new Error(`Lecture du profil Google échouée (${infoRes.status})`);
  }
  const info = (await infoRes.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!info.email) throw new Error("E-mail Google absent.");

  return {
    email: info.email.trim().toLowerCase(),
    // Google renvoie parfois une string "true" -> on gère les deux.
    emailVerified: info.email_verified === true || String(info.email_verified) === "true",
    name: info.name?.trim() || null,
  };
}
