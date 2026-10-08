"use server";

import { requireUser } from "@/lib/auth";
import { placeBoostOrder, BoostError } from "@/lib/boost/orders";

export type BoostActionState =
  | { error: string }
  | { success: true; id: string }
  | undefined;

export async function placeBoostOrderAction(
  _prev: BoostActionState,
  formData: FormData,
): Promise<BoostActionState> {
  const user = await requireUser();
  const network = String(formData.get("network") ?? "");
  const service = String(formData.get("service") ?? "");
  const tier = String(formData.get("tier") ?? "");
  const link = String(formData.get("link") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);

  try {
    const bo = await placeBoostOrder(user.id, {
      network,
      service,
      tier,
      link,
      quantity,
    });
    return { success: true, id: bo.id };
  } catch (e) {
    if (e instanceof BoostError) return { error: e.message };
    console.error("placeBoostOrder:", e);
    return { error: "Une erreur est survenue. Réessayez." };
  }
}
