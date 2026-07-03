// Types partagés des états de formulaire (server actions + composants client).
// Volontairement hors des fichiers "use server" (qui ne doivent exporter que
// des fonctions async).

export type AuthState = { error?: string } | undefined;
export type ActionState = { error?: string; success?: string } | undefined;
export type ForgotState = { error?: string; sent?: boolean } | undefined;
