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
      });
      ok = true;
    }
  } catch (e) {
    console.error("Google OAuth callback:", e);
  }

  redirect(ok ? "/dashboard" : "/login?error=google");
}
