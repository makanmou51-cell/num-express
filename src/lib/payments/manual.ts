import "server-only";
import { env } from "@/lib/env";
import type {
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
} from "@/lib/payments/types";

/**
 * Prestataire « manuel » de secours quand aucune clé FedaPay n'est configurée.
 * Il renvoie vers une page de simulation de paiement (utile en développement).
 * À NE PAS utiliser tel quel en production : la confirmation n'y est pas réelle.
 */
export const manualProvider: PaymentProvider = {
  name: "manual",

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const providerRef = `manual-${input.reference}`;
    const paymentUrl = `${env.appUrl}/wallet/simulate?tx=${input.reference}`;
    return { providerRef, paymentUrl };
  },

  async parseWebhook() {
    // Pas de webhook entrant pour le mode manuel.
    return null;
  },
};
