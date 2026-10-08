import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth";
import { generateUniqueReferralCode, resolveReferrerId } from "@/lib/affiliate";

/**
 * Connecte l'utilisateur à partir d'un e-mail PROUVÉ par un fournisseur externe
 * (Google). Crée le compte s'il n'existe pas, sinon relie par e-mail.
 *
 * Sécurité : l'e-mail étant vérifié côté Google, quiconque se connecte ainsi en
 * possède réellement la boîte — relier par e-mail ne permet donc aucune prise de
 * contrôle. Un compte créé via Google reçoit un mot de passe aléatoire
 * inutilisable ; l'utilisateur pourra en définir un via « mot de passe oublié ».
 */
export async function loginWithVerifiedEmail(opts: {
  email: string;
  name: string | null;
  ref?: string;
}): Promise<void> {
  const email = opts.email.trim().toLowerCase();

  let user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      name: true,
      emailVerifiedAt: true,
      tokenVersion: true,
    },
  });

  if (!user) {
    const referredById = await resolveReferrerId(opts.ref);
    const referralCode = await generateUniqueReferralCode();
    const randomSecret = randomBytes(32).toString("hex");
    user = await prisma.user.create({
      data: {
        email,
        name: opts.name,
        passwordHash: await hashPassword(randomSecret),
        emailVerifiedAt: new Date(), // e-mail prouvé par Google
        referralCode,
        referredById,
        role: "USER",
      },
      select: {
        id: true,
        role: true,
        name: true,
        emailVerifiedAt: true,
        tokenVersion: true,
      },
    });
  } else {
    // Compte existant : on complète ce qui manque (e-mail vérifié, nom).
    const patch: { emailVerifiedAt?: Date; name?: string } = {};
    if (!user.emailVerifiedAt) patch.emailVerifiedAt = new Date();
    if (!user.name && opts.name) patch.name = opts.name;
    if (Object.keys(patch).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: patch });
    }
  }

  // Promotion admin : même règle que le login classique (e-mail listé + prouvé,
  // ce qui est garanti ici puisque Google a vérifié l'e-mail).
  if (isAdminEmail(email) && user.role !== "ADMIN") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  }

  await createSession(user.id, user.tokenVersion);
}
