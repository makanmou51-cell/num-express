import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { Logo } from "@/components/logo";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Déjà connecté -> on saute la page d'auth.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6">
        <Logo />
      </Link>
      <Card className="w-full max-w-md p-6 sm:p-8">{children}</Card>
      <p className="mt-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} num express — Numéros virtuels
      </p>
    </main>
  );
}
