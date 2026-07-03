import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

const COOKIE_NAME = "ne_session";
const MAX_AGE_S = 60 * 60 * 24 * 7; // 7 jours

function secretKey(): Uint8Array {
  const secret = env.authSecret;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET manquant ou trop court (>= 32 caractères recommandés).",
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  uid: string;
  tv: number; // tokenVersion — permet d'invalider les sessions au reset
}

export async function createSession(
  userId: string,
  tokenVersion = 0,
): Promise<void> {
  const token = await new SignJWT({ uid: userId, tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.uid !== "string") return null;
    return {
      uid: payload.uid,
      tv: typeof payload.tv === "number" ? payload.tv : 0,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
