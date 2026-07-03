import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  sendMail,
  verifyEmailTemplate,
  resetPasswordTemplate,
} from "@/lib/mailer";

export type TokenType = "EMAIL_VERIFY" | "PASSWORD_RESET";

const TTL_MS: Record<TokenType, number> = {
  EMAIL_VERIFY: 24 * 60 * 60 * 1000, // 24 h
  PASSWORD_RESET: 60 * 60 * 1000, // 1 h
};

export async function createToken(
  userId: string,
  type: TokenType,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: { token, type, userId, expiresAt: new Date(Date.now() + TTL_MS[type]) },
  });
  return token;
}

/** Valide et consomme un jeton ; retourne l'userId ou null si invalide/expiré. */
export async function consumeToken(
  token: string,
  type: TokenType,
): Promise<string | null> {
  const row = await prisma.verificationToken.findUnique({ where: { token } });
  if (
    !row ||
    row.type !== type ||
    row.consumedAt ||
    row.expiresAt < new Date()
  ) {
    return null;
  }
  await prisma.verificationToken.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });
  return row.userId;
}

export async function sendVerificationEmail(user: {
  id: string;
  email: string;
}): Promise<void> {
  const token = await createToken(user.id, "EMAIL_VERIFY");
  const link = `${env.appUrl}/verify?token=${token}`;
  await sendMail({ to: user.email, ...verifyEmailTemplate(link) });
}

export async function sendPasswordResetEmail(user: {
  id: string;
  email: string;
}): Promise<void> {
  const token = await createToken(user.id, "PASSWORD_RESET");
  const link = `${env.appUrl}/reset?token=${token}`;
  await sendMail({ to: user.email, ...resetPasswordTemplate(link) });
}
