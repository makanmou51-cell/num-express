import type { Metadata } from "next";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Mot de passe oublié — num express" };

export default function ForgotPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-muted">
          Entrez votre e-mail, nous vous enverrons un lien de réinitialisation.
        </p>
      </div>
      <ForgotForm />
    </>
  );
}
