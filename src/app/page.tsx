import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ButtonLink } from "@/components/ui";
import { Logo } from "@/components/logo";
import { serviceLabel, FEATURED_SERVICES } from "@/lib/grizzly/catalog";

export default async function HomePage() {
  const user = await getCurrentUser();
  const cta = user ? "/dashboard" : "/register";

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      {/* ───────────── En-tête ───────────── */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3.5">
          <Logo />
          <nav className="flex items-center gap-2">
            {user ? (
              <ButtonLink href="/dashboard" size="sm">
                Mon espace
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm">
                  Connexion
                </ButtonLink>
                <ButtonLink href="/register" size="sm">
                  Créer un compte
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ───────────── Héros ───────────── */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-2 lg:gap-6">
          {/* Texte */}
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Activation en quelques secondes
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Recevez vos codes SMS
              <br className="hidden sm:block" /> sur un{" "}
              <span className="text-primary">numéro virtuel</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted lg:mx-0">
              WhatsApp, Telegram, Instagram et plus de 2 000 services. Choisissez
              un pays, payez en <strong className="text-foreground">Mobile Money</strong>,
              recevez votre code instantanément. Sans carte SIM.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <ButtonLink href={cta} size="lg" className="w-full sm:w-auto">
                Acheter un numéro
              </ButtonLink>
              <ButtonLink
                href="#services"
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
              >
                Voir les services
              </ButtonLink>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted lg:justify-start">
              <Trust icon="bolt" label="Instantané" />
              <Trust icon="shield" label="100 % sécurisé" />
              <Trust icon="globe" label="100+ pays" />
              <Trust icon="refund" label="Remboursement auto" />
            </div>
          </div>

          {/* Visuel : téléphone */}
          <div className="flex justify-center lg:justify-end">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ───────────── Bandeau chiffres ───────────── */}
      <section className="border-y border-border/60 bg-white">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4">
          <Stat value="100+" label="Pays disponibles" />
          <Stat value="2 000+" label="Services couverts" />
          <Stat value="< 1 min" label="Réception du code" />
          <Stat value="24/7" label="Disponible" />
        </div>
      </section>

      {/* ───────────── Services ───────────── */}
      <section id="services" className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Un numéro pour chaque service
          </h2>
          <p className="mt-3 text-muted">
            Les plateformes les plus demandées, prêtes à recevoir votre code.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FEATURED_SERVICES.map((code) => (
            <Link
              key={code}
              href={user ? `/buy/${code}` : "/register"}
              className="group rounded-2xl border border-border bg-card px-4 py-6 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <span className="font-semibold group-hover:text-primary">
                {serviceLabel(code)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ───────────── Comment ça marche ───────────── */}
      <section className="border-y border-border/60 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Comment ça marche
            </h2>
            <p className="mt-3 text-muted">Trois étapes, moins d'une minute.</p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <Step
              n="1"
              title="Créez votre compte"
              desc="Inscription gratuite en quelques secondes, puis rechargez en Mobile Money (MTN, Moov…)."
            />
            <Step
              n="2"
              title="Choisissez un numéro"
              desc="Sélectionnez le service et le pays. Le prix s'affiche, vous validez en un clic."
            />
            <Step
              n="3"
              title="Recevez le code"
              desc="Saisissez le numéro sur le service : le code de vérification arrive en direct sur votre espace."
            />
          </div>
        </div>
      </section>

      {/* ───────────── Pourquoi nous ───────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Pourquoi num express
          </h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon="bolt"
            title="Instantané"
            desc="Numéro attribué immédiatement, code reçu en temps réel."
          />
          <Feature
            icon="shield"
            title="Sécurisé & anonyme"
            desc="Protégez votre vrai numéro. Aucune donnée personnelle exposée."
          />
          <Feature
            icon="wallet"
            title="Mobile Money"
            desc="Payez en MTN, Moov ou carte. Simple et local."
          />
          <Feature
            icon="refund"
            title="Remboursé si échec"
            desc="Pas de code reçu ? Vous êtes remboursé automatiquement."
          />
        </div>
      </section>

      {/* ───────────── Appel à l'action ───────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground shadow-lg sm:px-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10" />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
            Prêt à recevoir votre code ?
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-primary-foreground/90">
            Créez votre compte et achetez votre premier numéro en moins d'une
            minute.
          </p>
          <div className="relative mt-8 flex justify-center">
            <ButtonLink
              href={cta}
              size="lg"
              variant="outline"
              className="w-full border-transparent bg-white text-primary hover:bg-white/90 sm:w-auto"
            >
              Commencer maintenant
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ───────────── Pied de page ───────────── */}
      <footer className="mt-auto border-t border-border/60 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} num express. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

/* ───────────────────────── Sous-composants ───────────────────────── */

function Trust({ icon, label }: { icon: IconName; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon name={icon} className="h-4 w-4 text-primary" />
      {label}
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="relative text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
        {n}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{desc}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: IconName;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
        <Icon name={icon} className="h-5 w-5 text-primary" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted">{desc}</p>
    </div>
  );
}

/* Maquette de téléphone (visuel héros, 100% CSS/SVG, sans image externe). */
function PhoneMockup() {
  return (
    <div className="relative w-[260px] sm:w-[300px]">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-primary/15 blur-2xl" />
      <div className="relative rounded-[2.6rem] border-[10px] border-gray-900 bg-gray-900 shadow-2xl">
        <div className="absolute left-1/2 top-0 z-10 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-gray-900" />
        <div className="overflow-hidden rounded-[1.9rem] bg-gray-50">
          {/* barre d'état */}
          <div className="flex items-center justify-between px-6 pb-2 pt-3 text-[11px] font-semibold text-gray-500">
            <span>9:41</span>
            <span className="tracking-tight">📶 🔋</span>
          </div>
          {/* numéro */}
          <div className="px-4 pb-3">
            <p className="text-[11px] text-gray-400">Votre numéro</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-gray-800">
                +1 202 345 3494
              </span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                Actif
              </span>
            </div>
          </div>
          {/* messages */}
          <div className="space-y-2.5 bg-white px-3 pb-8 pt-3">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                  W
                </span>
                <span className="text-xs font-semibold text-gray-700">
                  WhatsApp
                </span>
                <span className="ml-auto text-[10px] text-gray-400">
                  à l'instant
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                Votre code est{" "}
                <span className="font-mono text-base font-bold tracking-widest text-primary">
                  336-291
                </span>
              </p>
            </div>

            <MsgRow letter="T" name="Telegram" text="Login code : 55193" />
            <MsgRow letter="ig" name="Instagram" text="827 401 — code" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MsgRow({
  letter,
  name,
  text,
}: {
  letter: string;
  name: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-gray-50 p-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-200 text-[10px] font-bold text-gray-600">
        {letter}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-700">{name}</p>
        <p className="truncate text-[11px] text-gray-500">{text}</p>
      </div>
    </div>
  );
}

/* ───────────── Icônes (SVG inline) ───────────── */
type IconName = "bolt" | "shield" | "globe" | "refund" | "wallet";

function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    bolt: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />,
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20z" />
      </>
    ),
    refund: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
      </>
    ),
    wallet: (
      <>
        <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M16 12h.01M3 9h18" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
