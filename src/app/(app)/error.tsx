"use client";

import { Button, Card } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-12">
      <Card className="space-y-3 p-6 text-center">
        <h2 className="text-xl font-bold">Une erreur est survenue</h2>
        <p className="text-sm text-muted">
          {error?.message || "Erreur inattendue."}
        </p>
        {error?.digest && (
          <p className="text-xs text-muted">Référence : {error.digest}</p>
        )}
        <Button onClick={reset} className="mt-2">
          Réessayer
        </Button>
      </Card>
    </div>
  );
}
