import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { registerAction } from "../actions";

export const metadata: Metadata = { title: "Créer un compte — num express" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Créer un compte</h1>
        <p className="mt-1 text-sm text-muted">
          Quelques secondes suffisent pour commencer.
        </p>
      </div>
      <AuthForm mode="register" action={registerAction} referral={ref} />
    </>
  );
}
