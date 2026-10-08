"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { refillBoostOrder } from "@/lib/boost/orders";
import type { ActionState } from "@/lib/forms";

export async function refillBoostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const res = await refillBoostOrder(id);
  revalidatePath("/admin/boost");
  return res.ok ? { success: res.message } : { error: res.message };
}
