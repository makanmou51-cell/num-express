import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ButtonLink } from "@/components/ui";
import { Logo } from "@/components/logo";
import { ServiceIcon } from "@/components/service-icon";
import { InstallButton } from "@/components/install-button";
import {
  serviceLabel,
  FEATURED_SERVICES,
  RELIABLE_SERVICES,
} from "@/lib/grizzly/catalog";

export default async function HomePage() {
  const user = await getCurrentUser();
  // Le libellé dit « Acheter un numéro » : on envoie donc sur /buy, pas sur le
  // tableau de bord (un détour de plus avant l'achat).
  const cta = user ? "/buy" : "/register";
  const boostCta = user ? "/boost" : "/register";

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      {/* ═══════════ En-tête + Héros (bloc premium sombre) ═══════════ */}
      <div className="relative isolate overflow-hidden text-white">
        {/* Fond dégradé + lueurs + champ d'étoiles
            (la keyframe neFloat vit désormais dans globals.css, avec la garde
            prefers-reduced-motion — elle n'est plus injectée ici en <style>.) */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-dark via-[#0d5a37] to-[#072b18]" />
          <div className="absolute -top-40 right-[-10%] h-[36rem] w-[36rem] rounded-full bg-emerald-500/25 blur-[130px]" />
          <div className="absolute bottom-[-20%] left-[10%] h-80 w-80 rounded-full bg-emerald-400/15 blur-[110px]" />
          <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:34px_34px]" />
        </div>

        {/* Nav */}
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <Logo className="text-white" />
          <nav className="hidden items-center gap-7 md:flex">
            <a
              href="#services"
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              Numéros
            </a>
            <a
              href="#boost"
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              Boost
            </a>
            <a
              href="#tarifs"
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              Tarifs
            </a>
            <a
              href="#faq"
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              FAQ
            </a>
          </nav>
          <nav className="flex items-center gap-2">
            {user ? (
              <ButtonLink
                href="/dashboard"
                size="sm"
                variant="outline"
                className="border-transparent bg-white text-primary-dark hover:bg-white/90"
              >
                Mon espace
              </ButtonLink>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white sm:block"
                >
                  Connexion
                </Link>
                <ButtonLink
                  href="/register"
                  size="sm"
                  variant="outline"
                  className="border-transparent bg-white text-primary-dark hover:bg-white/90"
                >
                  Créer un compte
                </ButtonLink>
              </>
            )}
          </nav>
        </header>

        {/* Héros */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-24 pt-10 sm:pt-16 lg:grid-cols-2">
          {/* Texte */}
          <div className="text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-white backdrop-blur">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Activation en quelques secondes
              </span>
              <a
                href="#boost"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-3 py-1 text-sm font-medium text-emerald-200 backdrop-blur transition-colors hover:bg-emerald-400/25"
              >
                Nouveau : Boost réseaux
              </a>
            </div>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Numéros virtuels
              <br className="hidden sm:block" />{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                &amp; Boost réseaux
              </span>
            </h1>
            {/* Cascade d'entrée. Le <h1> ci-dessus en est EXCLU à dessein :
                c'est le plus gros élément de l'écran, donc celui que Google
                chronomètre (LCP). Le faire démarrer invisible retarderait
                l'affichage perçu de 400 ms, sur une audience déjà en 3G.
                Le titre s'affiche tout de suite ; seul ce qui vient après lui
                se met en mouvement, ce qui guide l'œil vers le bouton.
                "backwards" : l'élément reste invisible pendant son délai,
                sinon il clignote avant de partir. */}
            <p
              className="mx-auto mt-5 max-w-xl text-lg text-white/70 lg:mx-0"
              style={{ animation: "neRise 500ms ease-out 80ms backwards" }}
            >
              Recevez vos codes SMS (Telegram, Google, Instagram…){" "}
              <strong className="text-white">et</strong> boostez TikTok,
              Instagram &amp; Facebook — followers, likes, vues. Payé en{" "}
              <strong className="text-white">Mobile Money</strong>.
            </p>

            {/* UNE SEULE action dominante (orange accent). Le boost devient un
                lien secondaire : deux boutons de même poids = aucun ne ressort. */}
            <div
              className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start"
              style={{ animation: "neRise 500ms ease-out 220ms backwards" }}
            >
              {/* Un battement UNIQUE, une seconde après l'arrivée : le temps
                  que l'œil ait fini de lire le titre et la phrase. Pas de
                  boucle — un bouton principal qui clignote sans fin se lit
                  comme une publicité et finit par être ignoré. */}
              <ButtonLink
                href={cta}
                size="lg"
                variant="accent"
                className="w-full shadow-xl shadow-black/20 sm:w-auto"
                style={{ animation: "nePulseCta 700ms ease-in-out 1200ms" }}
              >
                Acheter un numéro
              </ButtonLink>
              <Link
                href={boostCta}
                className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-white underline decoration-white/40 underline-offset-4 transition-opacity hover:opacity-80"
              >
                Booster mes réseaux
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>

            <div
              className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/60 lg:justify-start"
              style={{ animation: "neRise 500ms ease-out 340ms backwards" }}
            >
              <Trust icon="bolt" label="Instantané" />
              <Trust icon="shield" label="100 % sécurisé" />
              <Trust icon="globe" label="100+ pays" />
              <Trust icon="refund" label="Remboursement auto" />
            </div>
          </div>

          {/* Visuel : téléphone + orbes flottantes + carte boost */}
          <div className="relative flex justify-center lg:justify-end">
            <Orb
              code="wa"
              wrap="left-1 top-6 sm:-left-2"
              glow="bg-emerald-400/50"
              delay="0s"
            />
            <Orb
              code="tg"
              wrap="-left-1 bottom-24"
              glow="bg-sky-400/50"
              delay="1.1s"
            />
            <Orb
              code="ig"
              wrap="right-3 -top-3 sm:right-6"
              glow="bg-pink-400/50"
              delay="0.6s"
            />
            <PhoneMockup />
            {/* Carte « boost » flottante */}
            <div
              className="absolute -bottom-3 left-0 z-20 rounded-2xl border border-black/5 bg-white px-3.5 py-2.5 shadow-2xl"
              style={{
                animation: "neFloat 5.5s ease-in-out infinite",
                animationDelay: "0.9s",
              }}
            >
              <p className="text-[11px] font-medium text-gray-500">
                TikTok · Boost
              </p>
              <p className="text-sm font-extrabold text-primary-dark">
                +2 400 abonnés
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ───── Preuve : chiffres + moyens de paiement ─────
          Les logos de paiement sont REMONTÉS ici (2ᵉ position). Pour un public
          qui paie en Mobile Money, voir « MTN / Moov » EST le signal de
          confiance n°1 : ils étaient auparavant enterrés sous 8 écrans. */}
      <section className="border-b border-border/60 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat value="100+" label="Pays disponibles" />
            <Stat value="2 000+" label="Services couverts" />
            <Stat value="< 1 min" label="Réception du code" />
            <Stat value="24/7" label="Disponible" />
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-center">
            <p className="text-sm font-semibold text-foreground">
              Payez comme vous voulez :
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <PayChip label="Moov Money" />
              <PayChip label="MTN Mobile Money" />
              <PayChip label="Celtiis Cash" />
              <PayChip label="Visa / Mastercard" />
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Services ───────────── */}
      <section
        id="services"
        className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Un numéro pour chaque service
          </h2>
          <p className="mt-3 text-muted">
            Les plateformes les plus fiables en premier, prêtes à recevoir votre
            code.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FEATURED_SERVICES.map((code) => (
            <Link
              key={code}
              href={user ? `/buy/${code}` : "/register"}
              className="group relative flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <ServiceIcon code={code} className="h-10 w-10 text-sm" />
              <span className="font-semibold group-hover:text-primary">
                {serviceLabel(code)}
              </span>
              {RELIABLE_SERVICES.includes(code) && (
                <span className="absolute right-2 top-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Fiable
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* ───────────── Boost réseaux sociaux ───────────── */}
      <section
        id="boost"
        className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            Nouveau
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Boostez vos réseaux sociaux
          </h2>
          <p className="mt-3 text-muted">
            Followers, likes et vues pour TikTok, Instagram et Facebook.
            Livraison rapide, payé en Mobile Money.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <BoostCard
            code="lf"
            network="TikTok"
            items="Followers · Likes · Vues"
            price="dès 700 F CFA / 1k"
          />
          <BoostCard
            code="ig"
            network="Instagram"
            items="Followers · Likes"
            price="dès 2 000 F CFA / 1k"
          />
          <BoostCard
            code="fb"
            network="Facebook"
            items="Abonnés de page"
            price="dès 3 500 F CFA / 1k"
          />
        </div>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href={boostCta} size="lg">
            Booster mes réseaux
          </ButtonLink>
          <p className="text-sm text-muted">
            Refill inclus · Remboursement si annulé
          </p>
        </div>
      </section>

      {/* ───────────── Comment ça marche ───────────── */}
      <section className="border-y border-border/60 bg-gradient-to-b from-white to-[#f4faf6]">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Comment ça marche
            </h2>
            <p className="mt-3 text-muted">Trois étapes, moins d'une minute.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <Step
              n="01"
              icon="globe"
              tone="blue"
              title="1. Créez votre compte"
              desc="Inscription gratuite en quelques secondes, puis rechargez en Mobile Money (MTN, Moov…)."
            />
            <Step
              n="02"
              icon="wallet"
              tone="violet"
              title="2. Choisissez un numéro"
              desc="Sélectionnez le service et le pays. Le prix s'affiche, vous validez en un clic."
            />
            <Step
              n="03"
              icon="chat"
              tone="green"
              title="3. Recevez le code"
              desc="Saisissez le numéro sur le service : le code de vérification arrive en direct sur votre espace."
            />
          </div>
        </div>
      </section>

      {/* ───────────── Tarifs ───────────── */}
      <section id="tarifs" className="border-y border-border/60 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              Tarifs transparents
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Un prix clair, selon la destination
            </h2>
            <p className="mt-3 text-muted">
              Le tarif exact s'affiche{" "}
              <strong className="text-foreground">avant</strong> l'achat. Aucun
              frais caché.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-3 lg:items-center">
            <PackCard
              zone="Asie & marchés populaires"
              examples="Vietnam · Indonésie · Inde"
              price="2 900"
              href={cta}
            />
            <PackCard
              zone="International populaire"
              examples="USA · Canada · Europe"
              price="4 100"
              href={cta}
              featured
            />
            <PackCard
              zone="Afrique & Amérique latine"
              examples="Nigéria · Brésil · Kenya"
              price="3 250"
              href={cta}
            />
          </div>

          <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted">
            Prix indicatifs « à partir de ». Le tarif exact de chaque numéro
            s'affiche au moment de choisir.
          </p>

          <div className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border bg-card p-4">
            <Icon
              name="refund"
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
            />
            <p className="text-sm text-muted">
              <strong className="text-foreground">
                Garantie remboursement :
              </strong>{" "}
              si vous ne recevez pas votre code, vous êtes remboursé
              automatiquement. Vous ne payez que pour un code reçu.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────── Pourquoi nous ───────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Liste numérotée */}
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Pourquoi choisir num express ?
            </h2>
            <p className="mt-3 text-muted">
              Rapide, fiable et pensé pour l'Afrique.
            </p>
            <div className="mt-8 space-y-6">
              <WhyItem
                n="1"
                active
                title="Activation instantanée"
                desc="Recevez votre numéro en quelques secondes. Pas d'attente, pas de délai."
              />
              <WhyItem
                n="2"
                title="Large couverture"
                desc="Plus de 100 pays et 2 000 services : Telegram, Google, Instagram, WhatsApp…"
              />
              <WhyItem
                n="3"
                title="Prix justes & Mobile Money"
                desc="À partir de 2 700 F CFA. Payez en Moov, MTN, Celtiis ou carte."
              />
              <WhyItem
                n="4"
                title="Sécurisé & anonyme"
                desc="Protégez votre vrai numéro. Vos données ne sont jamais partagées."
              />
              <WhyItem
                n="5"
                title="Remboursement automatique"
                desc="Code non reçu ? Vous êtes remboursé automatiquement. Zéro risque."
              />
            </div>
          </div>

          {/* Visuel */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-dark to-[#0d5a37] p-8 text-white shadow-xl">
            <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:28px_28px]" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-emerald-400/25 blur-3xl" />
            <div className="relative flex min-h-[340px] flex-col items-center justify-center">
              <div className="relative flex h-48 w-48 items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-white/15" />
                <div className="absolute inset-6 rounded-full border border-white/10" />
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-400/20 ring-1 ring-emerald-300/40"
                  style={{ animation: "neFloat 6s ease-in-out infinite" }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-12 w-12 text-emerald-300"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <div
                  className="absolute -left-3 top-6 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg ring-1 ring-black/5"
                  style={{
                    animation: "neFloat 5s ease-in-out infinite",
                    animationDelay: "0.5s",
                  }}
                >
                  <ServiceIcon code="tg" className="h-full w-full border-0" />
                </div>
                <div
                  className="absolute -right-3 bottom-6 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg ring-1 ring-black/5"
                  style={{
                    animation: "neFloat 5s ease-in-out infinite",
                    animationDelay: "1.3s",
                  }}
                >
                  <ServiceIcon code="go" className="h-full w-full border-0" />
                </div>
              </div>
              <p className="mt-8 text-center text-lg font-semibold">
                Code reçu en 30 secondes
              </p>
              <p className="mt-1 text-center text-sm text-white/60">
                Fiable, sécurisé, remboursé si échec.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Témoignages ───────────── */}
      <section className="border-y border-border/60 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              Conçu au Bénin, pour l'Afrique
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Ils reçoivent leurs codes avec num express
            </h2>
            <p className="mt-3 text-muted">
              Des centaines de Béninois nous font déjà confiance au quotidien.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Testimonial
              quote="J'ai reçu mon code Telegram en moins d'une minute. Paiement Moov Money, simple et rapide. Je recommande !"
              name="Rachidou A."
              city="Cotonou"
              initial="R"
            />
            <Testimonial
              quote="Parfait pour créer un compte Google avec un numéro étranger. Ça a marché du premier coup, sans carte SIM."
              name="Chimène H."
              city="Abomey-Calavi"
              initial="C"
            />
            <Testimonial
              quote="Une fois le code pas arrivé, j'ai été remboursé automatiquement. Un service sérieux, on ne perd jamais son argent."
              name="Boris K."
              city="Parakou"
              initial="B"
            />
          </div>
        </div>
      </section>

      {/* ───────────── Paiements + FAQ ───────────── */}
      <section id="faq" className="border-t border-border/60 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
          {/* FAQ (les moyens de paiement sont désormais en 2ᵉ position, en haut) */}
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Questions fréquentes
            </h2>
            <div className="mt-8 space-y-3">
              <Faq
                q="Et si je ne reçois pas le code ?"
                a="Vous êtes remboursé automatiquement. Vous ne payez que si un code est bien reçu."
              />
              <Faq
                q="En combien de temps je reçois le code ?"
                a="Généralement en quelques secondes à quelques minutes, dès que vous saisissez le numéro sur le service."
              />
              <Faq
                q="Quels moyens de paiement puis-je utiliser ?"
                a="Mobile Money (Moov, MTN, Celtiis) et cartes Visa/Mastercard, via un paiement 100 % sécurisé."
              />
              <Faq
                q="Est-ce anonyme et sécurisé ?"
                a="Oui : vous protégez votre vrai numéro et vos paiements sont chiffrés. Aucune donnée personnelle n'est partagée avec le service."
              />
              <Faq
                q="Le numéro est-il réutilisable ?"
                a="Chaque numéro sert à recevoir le code de vérification d'un service. Vous pouvez en racheter un à tout moment."
              />
              <Faq
                q="Comment vous contacter ?"
                a="Via le chat en direct en bas à droite de l'écran : notre équipe vous répond rapidement."
              />
            </div>
          </div>
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
        <div className="mx-auto w-full max-w-6xl px-4 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Marque */}
            <div className="lg:col-span-1">
              <Logo />
              <p className="mt-4 max-w-xs text-sm text-muted">
                Numéros virtuels pour recevoir vos codes SMS (Telegram, Google,
                Instagram…) et boost de réseaux sociaux (followers, likes,
                vues). Paiement Mobile Money.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["Moov", "MTN", "Celtiis", "Visa"].map((p) => (
                  <span
                    key={p}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted"
                  >
                    {p}
                  </span>
                ))}
              </div>
              {/* Bouton « Installer l'app » (masqué si déjà installé). */}
              <InstallButton className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-95" />
            </div>

            {/* Produit */}
            <FooterCol title="Produit">
              <FooterLink href="#services">Numéros virtuels</FooterLink>
              <FooterLink href="#boost">Boost réseaux</FooterLink>
              <FooterLink href="#tarifs">Tarifs</FooterLink>
              <FooterLink href="#faq">FAQ</FooterLink>
            </FooterCol>

            {/* Compte */}
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

            {/* Aide & légal */}
            <FooterCol title="Aide & légal">
              <FooterLink href="#faq">Centre d'aide</FooterLink>
              <FooterLink href="#faq">Nous contacter (chat)</FooterLink>
              <FooterLink href="/terms">Conditions d'utilisation</FooterLink>
            </FooterCol>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-sm text-muted sm:flex-row">
            <p>
              © {new Date().getFullYear()} num express · Conçu au Bénin · Tous
              droits réservés.
            </p>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="shield" className="h-4 w-4 text-primary" />
              Paiement 100 % sécurisé
            </span>
          </div>
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
      <p className="bg-gradient-to-br from-primary-dark to-emerald-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

const STEP_TONES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  green: "bg-primary/10 text-primary",
};

function Step({
  n,
  icon,
  tone,
  title,
  desc,
}: {
  n: string;
  icon: IconName;
  tone: keyof typeof STEP_TONES;
  title: string;
  desc: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
      <span className="pointer-events-none absolute right-4 top-1 text-6xl font-black text-black/[0.04]">
        {n}
      </span>
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${STEP_TONES[tone]}`}
      >
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{desc}</p>
    </div>
  );
}

function BoostCard({
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
    <div className="group rounded-2xl border border-border bg-card p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-md">
      {/* Le VRAI logo du réseau, pas un emoji : rendu identique sur tous les
          téléphones et cohérent avec les icônes du reste du site. */}
      <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl transition-transform group-hover:scale-110">
        <ServiceIcon code={code} className="h-full w-full border-0" />
      </div>
      <h3 className="mt-4 text-lg font-bold">{network}</h3>
      <p className="mt-1 text-sm text-muted">{items}</p>
      <p className="mt-3 font-semibold text-primary tabular-nums">{price}</p>
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
      className={`relative flex flex-col rounded-3xl p-6 shadow-sm sm:p-7 ${
        featured
          ? "bg-gradient-to-br from-primary-dark to-[#0d5a37] text-white shadow-xl lg:-translate-y-2 lg:scale-[1.03]"
          : "border border-border bg-white"
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-primary-dark shadow">
          Le plus demandé
        </span>
      )}
      <p
        className={`text-sm font-semibold ${featured ? "text-emerald-300" : "text-primary"}`}
      >
        {zone}
      </p>
      <p
        className={`mt-1 text-sm ${featured ? "text-white/70" : "text-muted"}`}
      >
        {examples}
      </p>
      <div className="mt-5 flex items-end gap-1.5">
        <span
          className={`mb-1.5 text-xs ${featured ? "text-white/70" : "text-muted"}`}
        >
          dès
        </span>
        <span className="text-4xl font-extrabold tracking-tight">{price}</span>
        <span className="mb-1.5 text-sm font-bold">F CFA</span>
      </div>
      <ul
        className={`mt-5 space-y-2 text-sm ${featured ? "text-white/80" : "text-muted"}`}
      >
        <PackFeat featured={featured} label="Livraison instantanée" />
        <PackFeat featured={featured} label="Remboursement automatique" />
        <PackFeat featured={featured} label="Plus de 2 000 services" />
      </ul>
      <ButtonLink
        href={href}
        size="sm"
        variant={featured ? "outline" : "primary"}
        className={`mt-6 w-full ${featured ? "border-transparent bg-white text-primary-dark hover:bg-white/90" : ""}`}
      >
        Acheter
      </ButtonLink>
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
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {label}
    </li>
  );
}

function WhyItem({
  n,
  title,
  desc,
  active = false,
}: {
  n: string;
  title: string;
  desc: string;
  active?: boolean;
}) {
  return (
    <div className="flex gap-4">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          active
            ? "bg-primary text-primary-foreground"
            : "border border-border text-muted"
        }`}
      >
        {n}
      </span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted">{desc}</p>
      </div>
    </div>
  );
}

function Stars() {
  return (
    <div className="flex gap-0.5 text-primary" aria-label="5 étoiles sur 5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="currentColor"
        >
          <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.88-5-4.87 7.1-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function Testimonial({
  quote,
  name,
  city,
  initial,
}: {
  quote: string;
  name: string;
  city: string;
  initial: string;
}) {
  return (
    <figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
      <Stars />
      <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground">
        « {quote} »
      </blockquote>
      <figcaption className="mt-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {initial}
        </span>
        <div>
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-muted">{city} · Bénin</p>
        </div>
      </figcaption>
    </figure>
  );
}

function PayChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-sm">
      {label}
    </span>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-border bg-card p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
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

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-muted transition-colors hover:text-primary"
      >
        {children}
      </Link>
    </li>
  );
}

/* Icône de service flottante et lumineuse (effet « waouh » du héros). */
function Orb({
  code,
  wrap,
  glow,
  delay,
}: {
  code: string;
  wrap: string;
  glow: string;
  delay: string;
}) {
  return (
    <div
      className={`absolute z-10 ${wrap}`}
      style={{
        animation: "neFloat 6s ease-in-out infinite",
        animationDelay: delay,
      }}
    >
      <div className={`absolute inset-0 rounded-full blur-xl ${glow}`} />
      {/* Conteneur rond qui rogne le carré de ServiceIcon en cercle. */}
      <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white shadow-2xl ring-1 ring-black/5">
        <ServiceIcon code={code} className="h-full w-full border-0" />
      </div>
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
            <span className="flex items-center gap-1" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                <path d="M2 20h3v-5H2zm5 0h3V10H7zm5 0h3V5h-3zm5 0h3V2h-3z" />
              </svg>
              <svg
                viewBox="0 0 24 24"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="8" width="17" height="8" rx="2" />
                <path d="M21 11v2" />
              </svg>
            </span>
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
                  T
                </span>
                <span className="text-xs font-semibold text-gray-700">
                  Telegram
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
type IconName = "bolt" | "shield" | "globe" | "refund" | "wallet" | "chat";

function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    bolt: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />,
    chat: (
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    ),
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
