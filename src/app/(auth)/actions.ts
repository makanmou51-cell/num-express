"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, DUMMY_HASH } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth";
import { generateUniqueReferralCode, resolveReferrerId } from "@/lib/affiliate";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  consumeToken,
} from "@/lib/auth/tokens";
import {
  loginSchema,
  registerSchema,
  forgotSchema,
  resetSchema,
} from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import type { AuthState, ForgotState } from "@/lib/forms";

const TOO_MANY = "Trop de tentatives. Réessayez dans quelques minutes.";

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!(await checkRateLimit("auth"))) return { error: TOO_MANY };
  const parsed = registerSchema.safeParse({
    // `?? undefined` : les champs optionnels absents renvoient `null` via
    // FormData, que Zod (.optional()) ne traite pas comme "absent".
    name: formData.get("name") ?? undefined,
    email: formData.get("email"),
    password: formData.get("password"),
    ref: formData.get("ref") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const { name, email, password, ref } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Un compte existe déjà avec cet e-mail." };
  }

  const referredById = await resolveReferrerId(ref);
  const referralCode = await generateUniqueReferralCode();

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash: await hashPassword(password),
      referralCode,
      referredById,
      // Le rôle n'est JAMAIS dérivé de l'e-mail à l'inscription (anti-takeover).
      // La promotion admin ne se fait qu'à la connexion, après vérification e-mail.
      role: "USER",
    },
    select: { id: true, email: true },
  });

  // E-mail de vérification (best-effort).
  try {
    await sendVerificationEmail(user);
  } catch (e) {
    console.error("Envoi e-mail de vérification échoué:", e);
  }

  await createSession(user.id, 0);
  redirect("/dashboard");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!(await checkRateLimit("auth"))) return { error: TOO_MANY };
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      role: true,
      emailVerifiedAt: true,
      tokenVersion: true,
    },
  });
  // Compte inexistant : on exécute quand même un compare bcrypt (hash factice)
  // pour ne pas révéler l'existence du compte par le temps de réponse.
  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    return { error: "E-mail ou mot de passe incorrect." };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return { error: "E-mail ou mot de passe incorrect." };
  }

  // Promotion admin : uniquement si l'e-mail est listé ET vérifié (preuve de
  // possession). Empêche la prise de contrôle par simple inscription.
  if (isAdminEmail(email) && user.emailVerifiedAt && user.role !== "ADMIN") {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
  }

  await createSession(user.id, user.tokenVersion);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function forgotPasswordAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  if (!(await checkRateLimit("reset"))) return { error: TOO_MANY };
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "E-mail invalide" };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true },
  });
  // Best-effort, et réponse générique pour ne pas révéler l'existence du compte.
  if (user) {
    try {
      await sendPasswordResetEmail(user);
    } catch (e) {
      console.error("Envoi e-mail de réinitialisation échoué:", e);
    }
  }
  return { sent: true };
}

export async function resetPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!(await checkRateLimit("reset"))) return { error: TOO_MANY };
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const userId = await consumeToken(parsed.data.token, "PASSWORD_RESET");
  if (!userId) {
    return { error: "Lien invalide ou expiré. Refaites une demande." };
  }

  // Incrémente tokenVersion -> invalide TOUTES les sessions existantes
  // (l'attaquant éventuel est déconnecté), puis on ouvre une session fraîche.
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      tokenVersion: { increment: 1 },
    },
    select: { tokenVersion: true },
  });

  await createSession(userId, updated.tokenVersion);
  redirect("/dashboard");
}
