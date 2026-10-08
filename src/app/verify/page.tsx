import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { consumeToken } from "@/lib/auth/tokens";
import { isAdminEmail } from "@/lib/auth";
import { ButtonLink, Card } from "@/components/ui";
import { IconCheckCircle, IconWarnCircle } from "@/components/icons";
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
      {/* C'est un écran de RÉSULTAT, pas un formulaire : le client revient de
          sa boîte mail et doit comprendre en une seconde si c'est bon ou non.
          Il n'affichait qu'un titre et une bande de couleur. */}
      <Card className="w-full max-w-md p-6 text-center sm:p-8">
        {ok ? (
          <>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
              <IconCheckCircle className="h-9 w-9" />
            </span>
            <h1 className="mt-4 text-2xl font-bold">Compte confirmé</h1>
            <p className="mt-2 text-muted">
              Votre adresse e-mail est vérifiée. Vous pouvez acheter votre
              premier numéro.
            </p>
            <ButtonLink
              href="/buy"
              variant="accent"
              size="lg"
              className="mt-6 w-full"
            >
              Acheter un numéro
            </ButtonLink>
            <ButtonLink
              href="/dashboard"
              variant="outline"
              className="mt-2 w-full"
            >
              Aller à mon espace
            </ButtonLink>
          </>
        ) : (
          <>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 text-warning">
              <IconWarnCircle className="h-9 w-9" />
            </span>
            <h1 className="mt-4 text-2xl font-bold">Lien expiré</h1>
            <p className="mt-2 text-muted">
              Un lien de vérification ne reste valable que{" "}
              <strong className="text-foreground">24&nbsp;heures</strong>.
              Connectez-vous et demandez-en un nouveau depuis votre tableau de
              bord — c&apos;est immédiat.
            </p>
            <ButtonLink
              href="/login"
              variant="accent"
              size="lg"
              className="mt-6 w-full"
            >
              Se connecter
            </ButtonLink>
            <p className="mt-4 text-sm text-muted">
              L&apos;e-mail n&apos;arrive pas&nbsp;? Regardez dans vos{" "}
              <strong className="text-foreground">spams</strong> ou vos
              «&nbsp;Promotions&nbsp;».
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
