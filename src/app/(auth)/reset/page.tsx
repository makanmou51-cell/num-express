import Link from "next/link";
import type { Metadata } from "next";
import { Alert } from "@/components/ui";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nouveau mot de passe — num express" };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
        <p className="mt-1 text-sm text-muted">
          Choisissez un nouveau mot de passe pour votre compte.
        </p>
      </div>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <Alert variant="error">
          Lien invalide. Veuillez{" "}
          <Link href="/forgot" className="font-medium underline">
            refaire une demande
          </Link>
          .
        </Alert>
      )}
    </>
  );
}
