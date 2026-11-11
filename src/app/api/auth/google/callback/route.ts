import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { exchangeGoogleCode } from "@/lib/auth/google";
import { loginWithVerifiedEmail } from "@/lib/auth/oauth";

export const runtime = "nodejs";

/** Retour de Google : vérifie l'état, échange le code, ouvre la session. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const store = await cookies();
  const expectedState = store.get("g_state")?.value;
  const ref = store.get("g_ref")?.value || undefined;
  // Provenance mesuree a la 1re page vue (cookie pose par SuiviSource). Google
  // n'a pas de formulaire, donc pas de reponse declaree : on garde au moins ca,
  // sinon toute inscription Google apparait « avant la mesure » dans l'admin.
  let source: string | undefined;
  try {
    const brut = store.get("ne_src")?.value;
    if (brut) source = decodeURIComponent(brut).slice(0, 40);
  } catch {
    /* Cookie illisible : on connecte quand meme. */
  }
  // Cookies temporaires devenus inutiles.
  store.delete("g_state");
  store.delete("g_ref");

  // NB : redirect() lève une exception -> toujours HORS du try/catch.
  if (
    oauthError ||
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState
  ) {
    redirect("/login?error=google");
  }

  let ok = false;
  try {
    const profile = await exchangeGoogleCode(code);
    if (profile.emailVerified) {
      await loginWithVerifiedEmail({
        email: profile.email,
        name: profile.name,
        ref,
        source,
      });
      ok = true;
    }
  } catch (e) {
    console.error("Google OAuth callback:", e);
  }

  redirect(ok ? "/dashboard" : "/login?error=google");
}
