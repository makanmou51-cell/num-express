"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  cancelActivation,
  purchaseNumber,
  PurchaseError,
} from "@/lib/activations";
import { confirmTopup, startTopup, getPaymentProvider } from "@/lib/payments";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { isGrizzlyMock } from "@/lib/grizzly/client";
import { sendVerificationEmail } from "@/lib/auth/tokens";
import { checkRateLimit } from "@/lib/rate-limit";
import { purchaseSchema, topupSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/forms";

// Détecte l'exception interne lancée par redirect() pour la relancer.
function isRedirectError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function purchaseAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  if (!(await checkRateLimit("purchase", user.id))) {
    redirect(`/buy?error=${encodeURIComponent("Trop de requêtes. Réessayez dans un instant.")}`);
  }

  // Garde optionnelle : e-mail vérifié requis pour acheter.
  if (env.requireEmailVerification && !user.emailVerifiedAt) {
    redirect(
      `/dashboard?error=${encodeURIComponent("Vérifiez votre e-mail avant d'acheter.")}`,
    );
  }

  const parsed = purchaseSchema.safeParse({
    service: formData.get("service"),
    country: formData.get("country"),
  });
  if (!parsed.success) {
    redirect(`/buy?error=${encodeURIComponent("Sélection invalide.")}`);
  }
  const { service, country } = parsed.data;

  try {
    const activation = await purchaseNumber(user.id, service, country);
    redirect(`/numbers/${activation.id}`);
  } catch (e) {
    if (isRedirectError(e)) throw e;
    const msg =
      e instanceof PurchaseError
        ? e.message
        : "Une erreur est survenue lors de l'achat.";
    redirect(`/buy/${service}?error=${encodeURIComponent(msg)}`);
  }
}

export async function topupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!(await checkRateLimit("topup", user.id))) {
    return { error: "Trop de tentatives de recharge. Réessayez dans un instant." };
  }
  const parsed = topupSchema.safeParse({ amount: formData.get("amount") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Montant invalide." };
  }

  let url: string;
  try {
    url = (await startTopup(user, parsed.data.amount)).paymentUrl;
  } catch (e) {
    return {
      error: `Impossible d'initier le paiement : ${(e as Error).message}`,
    };
  }
  redirect(url);
}

export async function cancelActivationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const res = await cancelActivation(user.id, id);
  revalidatePath(`/numbers/${id}`);
  revalidatePath("/numbers");
  return res.ok
    ? { success: "Numéro annulé et remboursé." }
    : { error: res.message };
}

/** DÉMO uniquement : simule la réception du SMS (comme si le numéro venait
 * d'être utilisé sur le service). Passe l'activation à RECEIVED. */
export async function deliverDemoCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!isGrizzlyMock) {
    return { error: "Disponible uniquement en mode démo." };
  }
  const id = String(formData.get("id") ?? "");
  const activation = await prisma.activation.findFirst({
    where: { id, userId: user.id },
  });
  if (!activation || activation.status !== "WAITING_CODE") {
    return { error: "Activation non éligible." };
  }
  const code = String(100000 + Math.floor(Math.random() * 900000));
  await prisma.activation.update({
    where: { id },
    data: { status: "RECEIVED", smsCode: code },
  });
  revalidatePath(`/numbers/${id}`);
  return { success: "Code SMS reçu (démo)." };
}

export async function resendVerificationAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.emailVerifiedAt) {
    return { success: "Votre e-mail est déjà vérifié." };
  }
  try {
    await sendVerificationEmail({ id: user.id, email: user.email });
  } catch {
    return { error: "Envoi impossible pour le moment. Réessayez." };
  }
  return { success: "E-mail de vérification renvoyé." };
}

/** DEV uniquement : simule la confirmation d'une recharge (provider manuel). */
export async function simulateTopupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  // Jamais exploitable en production (défense en profondeur).
  if (process.env.NODE_ENV === "production") {
    return { error: "Indisponible." };
  }
  if (getPaymentProvider().name !== "manual") {
    return { error: "Simulation indisponible : un prestataire réel est actif." };
  }
  const txId = String(formData.get("tx") ?? "");
  // Scope par utilisateur : on ne confirme que SA propre transaction (anti-IDOR).
  const res = await confirmTopup(`manual-${txId}`, true, {
    expectedUserId: user.id,
  });
  revalidatePath("/wallet");
  return res.status === "credited" || res.status === "already"
    ? { success: "Recharge confirmée (simulation)." }
    : { error: "Confirmation impossible." };
}
