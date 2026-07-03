import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(80).optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  password: z.string().min(6, "Mot de passe : 6 caractères minimum").max(200),
  ref: z.string().trim().max(20).optional().or(z.literal("")),
});

export const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
});

export const resetSchema = z.object({
  token: z.string().trim().min(10, "Jeton invalide"),
  password: z.string().min(6, "Mot de passe : 6 caractères minimum").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const purchaseSchema = z.object({
  service: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(10),
});

export const topupSchema = z.object({
  amount: z.coerce
    .number()
    .int("Montant invalide")
    .min(200, "Minimum 200 F CFA")
    .max(1_000_000, "Montant trop élevé"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
