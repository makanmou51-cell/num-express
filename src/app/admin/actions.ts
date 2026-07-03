"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { manualAdjustBalance, setUserRole } from "@/lib/admin";
import { updateSettings, SETTING_KEYS, type AppSettings } from "@/lib/settings";
import { InsufficientFundsError } from "@/lib/wallet";
import type { ActionState } from "@/lib/forms";

const adjustSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().int().refine((n) => n !== 0, "Montant non nul requis"),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function adjustBalanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = adjustSchema.safeParse({
    userId: formData.get("userId"),
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  try {
    await manualAdjustBalance(
      parsed.data.userId,
      parsed.data.amount,
      parsed.data.reason || "Ajustement administrateur",
    );
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      return { error: "Solde insuffisant pour ce débit." };
    }
    return { error: "Opération impossible." };
  }

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { success: "Solde mis à jour." };
}

export async function setRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || (role !== "USER" && role !== "ADMIN")) {
    return { error: "Paramètres invalides." };
  }
  await setUserRole(userId, role);
  revalidatePath(`/admin/users/${userId}`);
  return { success: `Rôle mis à jour : ${role}.` };
}

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const patch: Partial<AppSettings> = {};
  for (const key of SETTING_KEYS) {
    const raw = formData.get(key);
    if (raw === null || raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return { error: `Valeur invalide pour ${key}.` };
    }
    patch[key] = n;
  }

  await updateSettings(patch);
  revalidatePath("/admin/settings");
  return { success: "Réglages enregistrés." };
}
