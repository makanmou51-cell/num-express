"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Alert, Button, Input, Label } from "@/components/ui";
import type { AuthState } from "@/lib/forms";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Veuillez patienter…" : label}
    </Button>
  );
}

export function AuthForm({
  mode,
  action,
  referral,
}: {
  mode: "login" | "register";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  referral?: string;
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );
  const isRegister = mode === "register";

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      {isRegister && referral && (
        <>
          <input type="hidden" name="ref" value={referral} />
          <Alert variant="success">
            Vous avez été parrainé · code {referral}
          </Alert>
        </>
      )}

      {isRegister && (
        <div>
          <Label htmlFor="name">Nom (optionnel)</Label>
          <Input id="name" name="name" autoComplete="name" placeholder="Votre nom" />
        </div>
      )}

      <div>
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vous@exemple.com"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label htmlFor="password" className="mb-0">
            Mot de passe
          </Label>
          {!isRegister && (
            <Link
              href="/forgot"
              className="text-xs font-medium text-primary hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          )}
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete={isRegister ? "new-password" : "current-password"}
          placeholder="••••••••"
        />
      </div>

      <SubmitButton label={isRegister ? "Créer mon compte" : "Se connecter"} />

      <p className="text-center text-sm text-muted">
        {isRegister ? (
          <>
            Déjà un compte ?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Se connecter
            </Link>
          </>
        ) : (
          <>
            Pas encore de compte ?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Créer un compte
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
