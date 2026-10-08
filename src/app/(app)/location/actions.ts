"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  createRental,
  cancelRental,
  RentalError,
  isValidDuration,
} from "@/lib/rentals";
import { checkRateLimit } from "@/lib/rate-limit";

function isRedirectError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function rentAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  if (!(await checkRateLimit("purchase", user.id))) {
    redirect(
      `/location?error=${encodeURIComponent("Trop de requêtes. Réessayez dans un instant.")}`,
    );
  }

  const service = String(formData.get("service") ?? "");
  const country = String(formData.get("country") ?? "");
  const durationHours = Number(formData.get("duration") ?? 0);

  if (!service || !country || !isValidDuration(durationHours)) {
    redirect(`/location?error=${encodeURIComponent("Sélection invalide.")}`);
  }

  try {
    const rental = await createRental(user.id, service, country, durationHours);
    redirect(`/location/${rental.id}`);
  } catch (e) {
    if (isRedirectError(e)) throw e;
    const msg =
      e instanceof RentalError
        ? e.message
        : "Une erreur est survenue lors de la location.";
    redirect(
      `/location?service=${encodeURIComponent(service)}&duration=${durationHours}&error=${encodeURIComponent(msg)}`,
    );
  }
}

/**
 * Annule une location et rembourse le client (tant qu'aucun code n'a été reçu).
 * Renvoie un résultat au client (pas de redirection) pour afficher le message.
 */
export async function cancelRentalAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  if (!id) return { ok: false, message: "Location introuvable." };
  return cancelRental(user.id, id);
}
