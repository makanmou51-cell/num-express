import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ButtonLink } from "@/components/ui";
import { Logo } from "@/components/logo";
import { serviceLabel, FEATURED_SERVICES } from "@/lib/grizzly/catalog";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      {/* En-tête */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-3">
          {user ? (
            <ButtonLink href="/dashboard">Mon espace</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost">
                Connexion
              </ButtonLink>
              <ButtonLink href="/register">Créer un compte</ButtonLink>
            </>
          )}
        </nav>
      </header>

      {/* Héros */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            Activation en quelques secondes
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            Un numéro virtuel pour recevoir vos{" "}
            <span className="text-primary">codes SMS</span>
          </h1>
          <p className="mt-5 text-lg text-muted">
            WhatsApp, Telegram, Instagram et plus de 2 000 services. Choisissez
            un pays, payez en Mobile Money, recevez votre code instantanément.
            Sans carte SIM.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={user ? "/buy" : "/register"} size="lg">
              Acheter un numéro
            </ButtonLink>
            <ButtonLink href="#services" variant="outline" size="lg">
              Voir les services
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto w-full max-w-6xl px-4 pb-20">
        <h2 className="text-2xl font-bold">Services populaires</h2>
        <p className="mt-1 text-muted">Une sélection parmi les plus demandés.</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FEATURED_SERVICES.map((code) => (
            <Link
              key={code}
              href={user ? `/buy/${code}` : "/register"}
              className="rounded-xl border bg-card px-4 py-5 text-center font-medium shadow-sm transition-colors hover:border-primary"
            >
              {serviceLabel(code)}
            </Link>
          ))}
        </div>
      </section>

      {/* Étapes */}
      <section className="border-t bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:grid-cols-3">
          {[
            ["1. Créez un compte", "Inscription gratuite en quelques secondes."],
            ["2. Rechargez", "Mobile Money (MTN, Moov) ou carte bancaire."],
            [
              "3. Recevez le code",
              "Choisissez le service, le code arrive en direct.",
            ],
          ].map(([title, desc]) => (
            <div key={title}>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} num express. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
