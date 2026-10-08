import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { BrandIcon } from "@/components/brand-icon";
import { ServiceIcon } from "@/components/service-icon";
import { IconCheckCircle } from "@/components/icons";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Déjà connecté -> on saute la page d'auth.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* ─────────── Colonne formulaire ─────────── */}
      <div className="flex flex-col items-center justify-center px-4 py-10">
        <Link href="/" className="mb-6">
          <Logo />
        </Link>
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {children}
        </div>
        {/* Réassurance sur téléphone. La colonne visuelle de droite est en
            `hidden lg:flex` : sur mobile — c'est-à-dire pour la quasi-totalité
            des clients — il n'y avait sous le formulaire qu'un grand vide
            blanc puis le copyright. Or c'est l'écran où l'on décide de créer
            un compte ou de partir. */}
        <div className="mt-6 w-full max-w-md rounded-2xl border border-border bg-card p-4 lg:hidden">
          <div className="flex items-center justify-center gap-3">
            {["tg", "go", "ig", "wa"].map((c) => (
              <ServiceIcon key={c} code={c} className="h-9 w-9 text-xs" />
            ))}
            <span className="text-sm font-medium text-muted">
              + 2 000 services
            </span>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              "Paiement Mobile Money : Moov, MTN, Celtiis",
              "Code reçu en quelques secondes",
              "Assistance par chat en direct",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          © {new Date().getFullYear()} num express — Conçu au Bénin
        </p>
      </div>

      {/* ─────────── Colonne visuelle : orbites ─────────── */}
      <aside className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:items-center lg:justify-center">
        <style
          dangerouslySetInnerHTML={{
            __html:
              "@keyframes neSpin{to{transform:rotate(360deg)}}@keyframes neFloatB{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}",
          }}
        />
        {/* Fond dégradé + lueurs + champ d'étoiles */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-dark via-[#0d5a37] to-[#072b18]" />
          <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-emerald-500/25 blur-[120px]" />
          <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-emerald-400/15 blur-[110px]" />
          <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:34px_34px]" />
        </div>

        <div className="max-w-sm px-8 text-center">
          <h2 className="text-3xl font-bold leading-tight">
            Tes codes,{" "}
            <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
              en toute sécurité
            </span>
          </h2>
          <p className="mt-3 text-white/70">
            Telegram, Google, Instagram, WhatsApp et plus de 2 000 services.
            Paiement Mobile Money, activation en secondes.
          </p>
        </div>

        {/* Système d'orbites */}
        <div className="relative mt-12 h-80 w-80">
          <div className="absolute inset-0 rounded-full border border-white/15" />
          <div
            className="absolute inset-10 rounded-full border border-dashed border-white/20"
            style={{ animation: "neSpin 40s linear infinite" }}
          />
          <div className="absolute inset-24 rounded-full border border-white/10" />

          {/* Logo central */}
          <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-white shadow-2xl">
            <BrandIcon className="h-12 w-12 rounded-xl" />
          </div>

          {/* Icônes en orbite */}
          <OrbitIcon code="go" className="left-1/2 top-0 -translate-x-1/2" delay="0s" />
          <OrbitIcon code="wa" className="right-0 top-1/4" delay="0.4s" />
          <OrbitIcon code="tg" className="left-0 top-1/4" delay="0.8s" />
          <OrbitIcon code="ig" className="bottom-6 right-6" delay="1.2s" />
          <OrbitIcon code="fb" className="bottom-6 left-6" delay="1.6s" />
          <OrbitIcon
            code="tw"
            className="bottom-0 left-1/2 -translate-x-1/2"
            delay="2s"
          />
        </div>
      </aside>
    </main>
  );
}

/* Icône de service flottante posée sur l'orbite. */
function OrbitIcon({
  code,
  className,
  delay,
}: {
  code: string;
  className: string;
  delay: string;
}) {
  return (
    <div
      className={`absolute ${className}`}
      style={{ animation: "neFloatB 5s ease-in-out infinite", animationDelay: delay }}
    >
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-xl ring-1 ring-black/5">
        <ServiceIcon code={code} className="h-full w-full border-0" />
      </div>
    </div>
  );
}
