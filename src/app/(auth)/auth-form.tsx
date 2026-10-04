"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Alert, Button, Input, Label } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import type { AuthState } from "@/lib/forms";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Veuillez patienter…" : label}
    </Button>
  );
}

function GoogleButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-gray-50"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
        />
      </svg>
      {label}
    </a>
  );
}

export function AuthForm({
  mode,
  action,
  referral,
  googleEnabled = false,
}: {
  mode: "login" | "register";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  referral?: string;
  googleEnabled?: boolean;
}) {
  /* Valeur contrôlée du champ e-mail : indispensable pour que le bouton
     « Oui, corriger » puisse la remplacer. Sans ça on ne pourrait qu'afficher
     un conseil, et le client devrait retaper son adresse à la main sur un
     téléphone — autant dire qu'il abandonnerait. */
  const [email, setEmail] = useState("");
  const [state, formAction] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );
  const isRegister = mode === "register";
  const googleHref = referral
    ? `/api/auth/google?ref=${encodeURIComponent(referral)}`
    : "/api/auth/google";

  return (
    <div className="space-y-4">
      {googleEnabled && (
        <>
          <GoogleButton
            href={googleHref}
            label={
              isRegister ? "S'inscrire avec Google" : "Continuer avec Google"
            }
          />
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            ou avec un e-mail
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form action={formAction} className="space-y-4">
        {state?.suggestEmail ? (
          /* Faute de frappe probable : on PROPOSE, on ne refuse pas. Le
             client garde la main — son adresse est peut-être valide. */
          <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              Vérifiez votre adresse : vouliez-vous dire{" "}
              <strong>{state.suggestEmail}</strong> ?
            </p>
            <p className="text-xs">
              Si l&apos;adresse est fausse, le lien de confirmation ne vous
              parviendra jamais et votre compte restera bloqué.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setEmail(state.suggestEmail!)}
              >
                Oui, corriger
              </Button>
              {/* Renvoyer le formulaire avec ce champ caché vaut
                  confirmation : l'action laisse alors passer l'adresse. */}
              <Button type="submit" size="sm" variant="outline">
                Non, garder mon adresse
              </Button>
            </div>
            <input type="hidden" name="emailConfirme" value={email} />
          </div>
        ) : (
          state?.error && <Alert variant="error">{state.error}</Alert>
        )}

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
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Votre nom"
            />
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
          <PasswordField
            autoComplete={isRegister ? "new-password" : "current-password"}
            showRule={isRegister}
            labelExtra={
              !isRegister ? (
                <Link
                  href="/forgot"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              ) : null
            }
          />
        </div>

        <SubmitButton
          label={isRegister ? "Créer mon compte" : "Se connecter"}
        />

        <p className="text-center text-sm text-muted">
          {isRegister ? (
            <>
              Déjà un compte ?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Se connecter
              </Link>
            </>
          ) : (
            <>
              Pas encore de compte ?{" "}
              <Link
                href="/register"
                className="font-medium text-primary hover:underline"
              >
                Créer un compte
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
