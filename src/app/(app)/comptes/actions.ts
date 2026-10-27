"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { placeAccountOrder, AccountError } from "@/lib/acckit/orders";

export type AccountActionState =
  | { error: string }
  | { success: true; id: string }
  | undefined;

export async function buyAccountAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const user = await requireUser();

  if (!(await checkRateLimit("purchase", user.id))) {
    return { error: "Trop de requêtes. Réessayez dans un instant." };
  }
  // Même garde que l'achat de numéros : e-mail vérifié exigé si réglé ainsi.
  if (env.requireEmailVerification && !user.emailVerifiedAt) {
    return { error: "Vérifiez votre e-mail avant d'acheter." };
  }

  try {
    const o = await placeAccountOrder(user.id, {
      productId: Number(formData.get("product")),
      quantity: Number(formData.get("quantity") ?? 1),
    });
    revalidatePath("/comptes");
    return { success: true, id: o.id };
  } catch (e) {
    if (e instanceof AccountError) return { error: e.message };
    console.error("buyAccount:", e);
    return { error: "Une erreur est survenue. Réessayez." };
  }
}
