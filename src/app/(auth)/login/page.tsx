import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Connexion — num express" };

export default function LoginPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Connexion</h1>
        <p className="mt-1 text-sm text-muted">
          Accédez à votre compte num express.
        </p>
      </div>
      <AuthForm mode="login" action={loginAction} />
    </>
  );
}
