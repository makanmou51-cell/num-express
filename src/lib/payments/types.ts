/** Contrat commun à tous les prestataires de paiement (FedaPay, KkiaPay, …). */
export interface CreateChargeInput {
  amountXof: number;
  description: string;
  customer: { email: string; name?: string | null };
  /** URL de retour après paiement. */
  callbackUrl: string;
  /** Référence interne (transaction locale). */
  reference: string;
}

export interface CreateChargeResult {
  /** Identifiant de la transaction côté prestataire (sert de providerRef). */
  providerRef: string;
  /** URL vers laquelle rediriger l'utilisateur pour payer. */
  paymentUrl: string;
}

export interface WebhookResult {
  /** Référence prestataire de la transaction concernée. */
  providerRef: string;
  /** true si le paiement est confirmé/approuvé. */
  approved: boolean;
  /** Montant confirmé (F CFA), si fourni par le prestataire. */
  amountXof?: number;
}

export interface ChargeStatus {
  approved: boolean; // payé
  failed: boolean; // échoué / annulé / expiré (état terminal négatif)
  amountXof?: number;
}

export interface PaymentProvider {
  readonly name: string;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  /** Vérifie la signature et extrait l'évènement. Retourne null si non pertinent. */
  parseWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<WebhookResult | null>;
  /** Interroge le statut d'une charge côté prestataire (réconciliation au retour). */
  fetchChargeStatus?(providerRef: string): Promise<ChargeStatus>;
}
