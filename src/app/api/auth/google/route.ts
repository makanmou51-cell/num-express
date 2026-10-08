import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { googleAuthUrl, googleEnabled } from "@/lib/auth/google";

export const runtime = "nodejs";

const TEN_MIN = 60 * 10;

/** Démarre la connexion Google : pose un état anti-CSRF puis redirige. */
export async function GET(req: Request) {
  if (!googleEnabled()) {
    return NextResponse.redirect(new URL("/login?error=google", req.url));
  }

  const ref = new URL(req.url).searchParams.get("ref")?.trim() ?? "";
  const state = randomBytes(16).toString("hex");

  // On pose les cookies temporaires SUR la réponse de redirection (fiable dans
  // un route handler), plutôt que via next/headers.
  const res = NextResponse.redirect(googleAuthUrl(state));
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set("g_state", state, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: TEN_MIN,
  });
  if (ref) {
    res.cookies.set("g_ref", ref, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: TEN_MIN,
    });
  }
  return res;
}
