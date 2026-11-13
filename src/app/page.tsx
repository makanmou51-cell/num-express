import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ButtonLink } from "@/components/ui";
import { Logo } from "@/components/logo";
import { ServiceIcon } from "@/components/service-icon";
import { InstallButton } from "@/components/install-button";
import { HeroFond } from "@/components/hero-fond";
import { FilmAuDefilement } from "@/components/film-au-defilement";
import {
  serviceLabel,
  FEATURED_SERVICES,
  RELIABLE_SERVICES,
} from "@/lib/grizzly/catalog";

/* Page d'accueil — direction « rapide, concret, direct ».
   Le monde du produit : le code SMS qui arrive, le vert du Mobile Money.
   Deux couleurs, deux rôles : le vert est la marque, l'orange l'action.
   Un seul moment riche (l'écran « code reçu »), le reste reste calme. */

export default async function HomePage() {
  const user = await getCurrentUser();
  const cta = user ? "/buy" : "/register";
  const boostCta = user ? "/boost" : "/register";
  const compteCta = user ? "/comptes" : "/register";

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      {/* ═══════════ En-tête + Héros ═══════════ */}
      <div className="relative isolate overflow-hidden text-white">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[#06241A]" />
          <HeroFond />
          <div className="absolute inset-0 bg-[#06241A]/75 sm:bg-gradient-to-r sm:from-[#06241A] sm:via-[#06241A]/85 sm:to-[#06241A]/25" />
        </div>

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Logo className="text-white" />
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#services" className="text-sm text-white/70 transition-colors hover:text-white">Numéros</a>
            <a href="#boost" className="text-sm text-white/70 transition-colors hover:text-white">Boost</a>
            <a href="#comptes" className="text-sm text-white/70 transition-colors hover:text-white">Comptes</a>
            <a href="#tarifs" className="text-sm text-white/70 transition-colors hover:text-white">Tarifs</a>
            <a href="#faq" className="text-sm text-white/70 transition-colors hover:text-white">FAQ</a>
          </nav>
          <nav className="flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-medium text-[#06241A] transition-colors hover:bg-white/90"
              >
                Mon espace
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden text-sm text-white/80 transition-colors hover:text-white sm:block"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-medium text-[#06241A] transition-colors hover:bg-white/90"
                >
                  Créer un compte
                </Link>
              </>
            )}
          </nav>
        </header>

        <section className="mx-auto w-full max-w-6xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:pb-28 lg:pt-24">
          <div className="max-w-2xl">
            <h1 className="text-[clamp(2.4rem,8.5vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
              Recevez le code.
              <br />
              <span className="text-white/45">Faites décoller vos réseaux.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[17px] leading-[1.6] text-white/65">
              Un numéro jetable pour WhatsApp, Telegram, Instagram et{" "}
              <span className="text-white">2 000 services</span>, dans 200 pays —
              sans donner le vôtre. Des abonnés et des vues pour TikTok, Instagram
              et Facebook. Et des{" "}
              <span className="text-white">comptes prêts à l&apos;emploi</span>,
              livrés tout de suite. Payé en{" "}
              <span className="text-white">Mobile Money</span>.
            </p>

            {/* Une action dominante en orange, deux offres secondaires en retrait. */}
            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Link
                href={cta}
                className="inline-flex h-12 items-center justify-center rounded-lg bg-accent px-6 text-[15px] font-medium text-white transition-colors hover:bg-[#9a330a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Acheter un numéro
              </Link>
              <Link
                href={boostCta}
                className="inline-flex h-12 items-center justify-center rounded-lg border border-white/25 px-6 text-[15px] font-medium text-white transition-colors hover:border-white/60"
              >
                Booster mes réseaux
              </Link>
              <Link
                href={compteCta}
                className="inline-flex h-12 items-center justify-center rounded-lg border border-white/25 px-6 text-[15px] font-medium text-white transition-colors hover:border-white/60"
              >
                Comptes prêts
              </Link>
            </div>

            <dl className="mt-14 grid grid-cols-2 border-t border-white/[0.14] sm:grid-cols-4">
              <Repere valeur="200" libelle="pays couverts" />
              <Repere valeur="2 000" libelle="services" />
              <Repere valeur="< 1 min" libelle="réception du code" />
              <Repere valeur="100 %" libelle="remboursé si échec" />
            </dl>

            <div className="mt-10">
              <a
                href="#film"
                className="group inline-flex min-h-11 items-center gap-3 text-[15px] text-white/70 transition-colors hover:text-white"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 transition-colors group-hover:border-white group-hover:bg-white">
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5 fill-current transition-colors group-hover:fill-[#06241A]" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                Voir le film
                <span className="text-white/40">30 s</span>
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* ───── Le film ───── */}
      <section id="film" className="scroll-mt-4 bg-[#06241A]">
        <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
          <FilmAuDefilement />
        </div>
      </section>

      {/* ───── Preuve : chiffres + moyens de paiement ───── */}
      <section className="border-b border-border/60 bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat value="200" label="Pays disponibles" />
            <Stat value="2 000+" label="Services couverts" />
            <Stat value="< 1 min" label="Réception du code" />
            <Stat value="24/7" label="Disponible" />
          </div>
          <div className="mt-8 flex flex-col items-center gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-center">
            <p className="text-sm text-muted">Payez comme vous voulez</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <PayChip label="Moov Money" />
              <PayChip label="MTN Mobile Money" />
              <PayChip label="Celtiis Cash" />
              <PayChip label="Visa / Mastercard" />
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Services (en-tête aligné à gauche) ───────────── */}
      <section id="services" className="mx-auto w-full max-w-6xl scroll-mt-4 px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Un numéro pour chaque service
          </h2>
          <p className="mt-3 text-muted">
            Les plateformes les plus fiables en premier, prêtes à recevoir votre code.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FEATURED_SERVICES.map((code) => (
            <Link
              key={code}
              href={user ? `/buy/${code}` : "/register"}
              className="group relative flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40"
            >
              <ServiceIcon code={code} className="h-10 w-10 text-sm" />
              <span className="font-medium group-hover:text-primary">
                {serviceLabel(code)}
              </span>
              {RELIABLE_SERVICES.includes(code) && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 text-[11px] text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Fiable
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* ───────────── Boost réseaux sociaux ───────────── */}
      <section id="boost" className="scroll-mt-4 border-y border-border/60 bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
                Boostez vos réseaux sociaux
              </h2>
              <p className="mt-3 text-muted">
                Followers, likes et vues pour TikTok, Instagram et Facebook.
                Livraison rapide, refill inclus, payé en Mobile Money.
              </p>
            </div>
            <ButtonLink href={boostCta} size="lg" className="shrink-0">
              Booster mes réseaux
            </ButtonLink>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <OfferCard code="lf" network="TikTok" items="Followers · Likes · Vues" price="dès 700 F CFA / 1k" />
            <OfferCard code="ig" network="Instagram" items="Followers · Likes" price="dès 2 000 F CFA / 1k" />
            <OfferCard code="fb" network="Facebook" items="Abonnés de page" price="dès 3 500 F CFA / 1k" />
          </div>
        </div>
      </section>

      {/* ───────────── Comptes réseaux sociaux ───────────── */}
      <section id="comptes" className="mx-auto w-full max-w-6xl scroll-mt-4 px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
              Des comptes prêts à l&apos;emploi
            </h2>
            <p className="mt-3 text-muted">
              Comptes TikTok, Facebook (France, Allemagne, Royaume-Uni) et
              Instagram, livrés après le paiement et conservés dans votre espace.
            </p>
          </div>
          <ButtonLink href={compteCta} size="lg" className="shrink-0">
            Parcourir les comptes
          </ButtonLink>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <OfferCard code="lf" network="TikTok" items="Comptes US, Japon, Vietnam…" price="dès 2 600 F CFA" />
          <OfferCard code="fb" network="Facebook Europe" items="France · Allemagne · Royaume-Uni" price="dès 5 000 F CFA" />
          <OfferCard code="ig" network="Instagram" items="Comptes anciens et neufs" price="dès 2 600 F CFA" />
        </div>
      </section>

      {/* ───────────── Comment ça marche + le moment « code reçu » ───────────── */}
      <section className="border-y border-border/60 bg-[#f7f9f8]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
                Comment ça marche
              </h2>
              <p className="mt-3 text-muted">Trois étapes, moins d&apos;une minute.</p>
              <div className="mt-8 space-y-6">
                <Step n="01" icon="globe" title="Créez votre compte" desc="Inscription gratuite en quelques secondes, puis rechargez en Mobile Money (MTN, Moov…)." />
                <Step n="02" icon="wallet" title="Choisissez un numéro" desc="Sélectionnez le service et le pays. Le prix s'affiche, vous validez en un clic." />
                <Step n="03" icon="chat" title="Recevez le code" desc="Saisissez le numéro sur le service : le code arrive en direct dans votre espace." />
              </div>
            </div>
            {/* Le seul visuel riche : un vrai écran de code reçu. */}
            <CodeRecu />
          </div>
        </div>
      </section>

      {/* ───────────── Tarifs ───────────── */}
      <section id="tarifs" className="scroll-mt-4 border-b border-border/60 bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
              Un prix clair, selon la destination
            </h2>
            <p className="mt-3 text-muted">
              Le tarif exact s&apos;affiche{" "}
              <span className="text-foreground">avant</span> l&apos;achat. Aucun frais caché.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 lg:grid-cols-3">
            <PackCard zone="Asie & marchés populaires" examples="Vietnam · Indonésie · Inde" price="2 900" href={cta} />
            <PackCard zone="International populaire" examples="USA · Canada · Europe" price="4 100" href={cta} featured />
            <PackCard zone="Afrique & Amérique latine" examples="Nigéria · Brésil · Kenya" price="3 250" href={cta} />
          </div>

          <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted">
            Prix « à partir de ». Le tarif exact de chaque numéro s&apos;affiche au moment de choisir.
          </p>

          <div className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-xl border border-border bg-card p-4">
            <Icon name="refund" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">Garantie remboursement :</span>{" "}
              si vous ne recevez pas votre code, vous êtes remboursé automatiquement.
              Vous ne payez que pour un code reçu.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────── Pourquoi num express ───────────── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Pourquoi num express
          </h2>
          <p className="mt-3 text-muted">Rapide, fiable et pensé pour l&apos;Afrique.</p>
        </div>
        <div className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          <WhyItem title="Activation instantanée" desc="Recevez votre numéro en quelques secondes. Pas d'attente, pas de délai." />
          <WhyItem title="Large couverture" desc="Plus de 100 pays et 2 000 services : Telegram, Google, Instagram, WhatsApp…" />
          <WhyItem title="Prix justes, Mobile Money" desc="À partir de 2 700 F CFA. Payez en Moov, MTN, Celtiis ou carte." />
          <WhyItem title="Sécurisé et anonyme" desc="Protégez votre vrai numéro. Vos données ne sont jamais partagées." />
          <WhyItem title="Remboursement automatique" desc="Code non reçu ? Vous êtes remboursé automatiquement. Zéro risque." />
          <WhyItem title="Support en direct" desc="Une équipe vous répond par le chat, en bas à droite de l'écran." />
        </div>
      </section>

      {/* ───────────── Confiance (honnête, pas de faux avis) ─────────────
          Remplace les témoignages inventés : on n'affiche que des engagements
          vérifiables. L'ancre #avis est gardée pour ne pas casser de liens. */}
      <section id="avis" className="scroll-mt-4 border-y border-border/60 bg-[#06241A] text-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
              La confiance, pas les promesses
            </h2>
            <p className="mt-3 text-white/60">
              Conçu au Bénin, pour l&apos;Afrique francophone. Ce sur quoi vous
              pouvez compter à chaque achat.
            </p>
          </div>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            <Garantie title="Remboursé si échec" desc="Le code n'arrive pas ? Vous êtes recrédité automatiquement. Vous ne payez que pour un code reçu." />
            <Garantie title="Mobile Money" desc="Moov, MTN et Celtiis. Vous payez avec ce que vous avez déjà sur votre téléphone." />
            <Garantie title="Support par chat" desc="Une vraie équipe répond dans le chat en direct, sans quitter le site." />
            <Garantie title="Conçu au Bénin" desc="Pensé pour l'Afrique de l'Ouest francophone, pas un service étranger générique." />
          </div>
        </div>
      </section>

      {/* ───────────── FAQ ───────────── */}
      <section id="faq" className="scroll-mt-4 border-b border-border/60 bg-white">
        <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Questions fréquentes
          </h2>
          <div className="mt-8 space-y-3">
            <Faq q="Et si je ne reçois pas le code ?" a="Vous êtes remboursé automatiquement. Vous ne payez que si un code est bien reçu." />
            <Faq q="En combien de temps je reçois le code ?" a="Généralement en quelques secondes à quelques minutes, dès que vous saisissez le numéro sur le service." />
            <Faq q="Quels moyens de paiement puis-je utiliser ?" a="Mobile Money (Moov, MTN, Celtiis) et cartes Visa/Mastercard, via un paiement sécurisé." />
            <Faq q="Est-ce anonyme et sécurisé ?" a="Oui : vous protégez votre vrai numéro et vos paiements sont chiffrés. Aucune donnée personnelle n'est partagée avec le service." />
            <Faq q="Le numéro est-il réutilisable ?" a="Chaque numéro sert à recevoir le code de vérification d'un service. Vous pouvez en racheter un à tout moment." />
            <Faq q="Comment vous contacter ?" a="Via le chat en direct en bas à droite de l'écran : notre équipe vous répond rapidement." />
          </div>
        </div>
      </section>

      {/* ───────────── Appel à l'action ───────────── */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8 sm:pb-20">
        <div className="rounded-2xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Prêt à recevoir votre code ?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-primary-foreground/90">
            Créez votre compte et achetez votre premier numéro en moins d&apos;une minute.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href={cta}
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-white px-6 text-[15px] font-medium text-primary transition-colors hover:bg-white/90 sm:w-auto"
            >
              Commencer maintenant
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────── Pied de page ───────────── */}
      <footer className="mt-auto border-t border-border/60 bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <Logo />
              <p className="mt-4 max-w-xs text-sm text-muted">
                Numéros virtuels pour recevoir vos codes SMS, boost de réseaux
                sociaux et comptes prêts à l&apos;emploi. Paiement Mobile Money.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["Moov", "MTN", "Celtiis", "Visa"].map((p) => (
                  <span key={p} className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted">
                    {p}
                  </span>
                ))}
              </div>
              <InstallButton className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark" />
            </div>

            <FooterCol title="Produit">
              <FooterLink href="#services">Numéros virtuels</FooterLink>
              <FooterLink href="#boost">Boost réseaux</FooterLink>
              <FooterLink href="#comptes">Comptes</FooterLink>
              <FooterLink href="#tarifs">Tarifs</FooterLink>
              <FooterLink href="#faq">FAQ</FooterLink>
            </FooterCol>

            <FooterCol title="Compte">
              {user ? (
                <FooterLink href="/dashboard">Mon espace</FooterLink>
              ) : (
                <>
                  <FooterLink href="/register">Créer un compte</FooterLink>
                  <FooterLink href="/login">Connexion</FooterLink>
                </>
              )}
              <FooterLink href="/wallet">Recharger</FooterLink>
            </FooterCol>

            <FooterCol title="Aide & légal">
              <FooterLink href="#faq">Centre d&apos;aide</FooterLink>
              <FooterLink href="#faq">Nous contacter (chat)</FooterLink>
              <FooterLink href="/terms">Conditions d&apos;utilisation</FooterLink>
            </FooterCol>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-sm text-muted sm:flex-row">
            <p>© {new Date().getFullYear()} num express · Conçu au Bénin</p>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="shield" className="h-4 w-4 text-primary" />
              Paiement sécurisé
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* Repère chiffré du héros : le chiffre domine, le libellé explique. */
function Repere({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="border-b border-white/[0.14] py-5 pr-5 sm:border-r sm:last:border-r-0">
      <dt className="text-2xl font-medium tracking-tight tabular-nums text-white">{valeur}</dt>
      <dd className="mt-1 text-[13px] leading-snug text-white/50">{libelle}</dd>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground sm:text-[2rem]">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

/* L'écran « code reçu » : le seul moment riche de la page. Un vrai SMS,
   un code à 6 chiffres en mono (la signature), un point vert « reçu ». */
function CodeRecu() {
  return (
    <div className="rounded-2xl bg-[#06241A] p-6 text-white sm:p-8">
      <div className="rounded-xl bg-white/[0.06] p-5 ring-1 ring-white/10">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            SMS · WhatsApp
          </span>
          <span className="tabular-nums">maintenant</span>
        </div>
        <p className="mt-4 text-sm text-white/70">Votre code de vérification est</p>
        <p className="mt-2 font-mono text-[2.5rem] font-medium leading-none tracking-[0.25em] tabular-nums">
          472901
        </p>
      </div>
      <div className="mt-5 flex items-center gap-2 text-sm text-white/60">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Reçu en 28 s, directement dans votre espace
      </div>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  desc,
}: {
  n: string;
  icon: IconName;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-muted">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs text-muted tabular-nums">{n}</span>
          <h3 className="font-medium">{title}</h3>
        </div>
        <p className="mt-1 text-sm text-muted">{desc}</p>
      </div>
    </div>
  );
}

/* Carte d'offre (boost / comptes) : logo réel, libellé, prix. Calme. */
function OfferCard({
  code,
  network,
  items,
  price,
}: {
  code: string;
  network: string;
  items: string;
  price: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        <ServiceIcon code={code} className="h-full w-full border-0" />
      </div>
      <div className="min-w-0">
        <h3 className="font-medium">{network}</h3>
        <p className="truncate text-sm text-muted">{items}</p>
        <p className="mt-1 text-sm font-medium tabular-nums text-primary">{price}</p>
      </div>
    </div>
  );
}

function PackCard({
  zone,
  examples,
  price,
  href,
  featured = false,
}: {
  zone: string;
  examples: string;
  price: string;
  href: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl p-6 sm:p-7 ${
        featured
          ? "bg-[#06241A] text-white"
          : "border border-border bg-white"
      }`}
    >
      {featured && (
        <span className="mb-3 inline-flex w-fit items-center gap-1.5 text-xs text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Le plus demandé
        </span>
      )}
      <p className={`text-sm font-medium ${featured ? "text-white" : "text-foreground"}`}>{zone}</p>
      <p className={`mt-1 text-sm ${featured ? "text-white/60" : "text-muted"}`}>{examples}</p>
      <div className="mt-5 flex items-end gap-1.5">
        <span className={`mb-1.5 text-xs ${featured ? "text-white/60" : "text-muted"}`}>dès</span>
        <span className="text-4xl font-semibold tracking-tight tabular-nums">{price}</span>
        <span className="mb-1.5 text-sm">F CFA</span>
      </div>
      <ul className={`mt-5 space-y-2 text-sm ${featured ? "text-white/75" : "text-muted"}`}>
        <PackFeat featured={featured} label="Livraison instantanée" />
        <PackFeat featured={featured} label="Remboursement automatique" />
        <PackFeat featured={featured} label="Plus de 2 000 services" />
      </ul>
      {featured ? (
        <Link
          href={href}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-white px-5 text-sm font-medium text-[#06241A] transition-colors hover:bg-white/90"
        >
          Acheter
        </Link>
      ) : (
        <ButtonLink href={href} size="sm" className="mt-6 w-full">
          Acheter
        </ButtonLink>
      )}
    </div>
  );
}

function PackFeat({ label, featured }: { label: string; featured?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 shrink-0 ${featured ? "text-emerald-300" : "text-primary"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {label}
    </li>
  );
}

function WhyItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border-t border-border pt-5">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1.5 text-sm text-muted">{desc}</p>
    </div>
  );
}

function Garantie({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border-t border-white/15 pt-5">
      <h3 className="font-medium text-white">{title}</h3>
      <p className="mt-1.5 text-sm text-white/55">{desc}</p>
    </div>
  );
}

function PayChip({ label }: { label: string }) {
  return (
    <span className="rounded-lg border border-border bg-white px-3.5 py-2 text-sm font-medium text-foreground">
      {label}
    </span>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-border bg-card p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
        {q}
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <p className="mt-3 text-sm text-muted">{a}</p>
    </details>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-muted transition-colors hover:text-primary">
        {children}
      </Link>
    </li>
  );
}

/* ───────────── Icônes (SVG inline) ───────────── */
type IconName = "bolt" | "shield" | "globe" | "refund" | "wallet" | "chat";

function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    bolt: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />,
    chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
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
