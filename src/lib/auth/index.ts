import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { readSession } from "@/lib/auth/session";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  balance: number;
  emailVerifiedAt: Date | null;
  referralCode: string;
};

/** L'e-mail figure-t-il dans la liste des administrateurs (ADMIN_EMAILS) ? */
export function isAdminEmail(email: string): boolean {
  return env.adminEmails.includes(email.trim().toLowerCase());
}

/**
 * Utilisateur courant ou null. Mémoïsé par requête (React cache) pour éviter
 * de multiplier les lectures DB dans une même page.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      balance: true,
      emailVerifiedAt: true,
      referralCode: true,
      tokenVersion: true,
    },
  });
  if (!user) return null;
  // Session invalidée (ex. après reset de mot de passe) -> déconnexion.
  if (user.tokenVersion !== session.tv) return null;

  const { tokenVersion: _tv, ...safe } = user;
  return safe;
});

/** Exige un utilisateur connecté, redirige vers /login sinon. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige un administrateur. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
