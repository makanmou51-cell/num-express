import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { consumeToken } from "@/lib/auth/tokens";
import { isAdminEmail } from "@/lib/auth";
import { Alert, ButtonLink, Card } from "@/components/ui";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Vérification de l'e-mail — num express" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let ok = false;
  if (token) {
    const userId = await consumeToken(token, "EMAIL_VERIFY");
    if (userId) {
      const u = await prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
        select: { email: true },
      });
      // Promotion admin possible seulement après preuve de possession (ici).
      if (isAdminEmail(u.email)) {
        await prisma.user.update({
          where: { id: userId },
          data: { role: "ADMIN" },
        });
      }
      ok = true;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6">
        <Logo />
      </Link>
      <Card className="w-full max-w-md space-y-4 p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Vérification de l'e-mail</h1>
        {ok ? (
          <>
            <Alert variant="success">
              Votre adresse e-mail est confirmée. Merci&nbsp;!
            </Alert>
            <ButtonLink href="/dashboard" size="lg" className="w-full">
              Accéder à mon espace
            </ButtonLink>
          </>
        ) : (
          <>
            <Alert variant="error">
              Lien de vérification invalide ou expiré.
            </Alert>
            <p className="text-sm text-muted">
              Connectez-vous puis demandez un nouveau lien depuis votre tableau
              de bord.
            </p>
            <ButtonLink href="/login" variant="outline" size="lg" className="w-full">
              Se connecter
            </ButtonLink>
          </>
        )}
      </Card>
    </main>
  );
}
