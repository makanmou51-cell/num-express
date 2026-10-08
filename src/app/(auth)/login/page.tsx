import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { loginAction } from "../actions";
import { googleEnabled } from "@/lib/auth/google";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Connexion — num express" };

const ERRORS: Record<string, string> = {
  google:
    "La connexion Google n'a pas abouti. Réessayez, ou connectez-vous avec votre e-mail.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] : undefined;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Connexion</h1>
        <p className="mt-1 text-sm text-muted">
          Accédez à votre compte num express.
        </p>
      </div>
      {message && (
        <div className="mb-4">
          <Alert variant="error">{message}</Alert>
        </div>
      )}
      <AuthForm mode="login" action={loginAction} googleEnabled={googleEnabled()} />
    </>
  );
}
