import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { Clarity } from "@/components/clarity";
import { MetaPixel } from "@/components/meta-pixel";
import { SuiviSource } from "@/components/suivi-source";
import { MetaPageViews } from "@/components/meta-track";
import "./globals.css";
import { InstallPrompt } from "@/components/install-prompt";
import { ChatButton } from "@/components/chat-button";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Base des URL absolues des métadonnées (og:image, canonical…). Sans elle,
  // l'aperçu de partage WhatsApp/Facebook reçoit une URL d'image relative
  // qu'il ne sait pas résoudre → pas d'image. On la fixe sur le domaine de
  // production. L'image elle-même est générée par `opengraph-image.tsx`.
  metadataBase: new URL("https://num-express.com"),
  title: {
    default: "num express — Numéros virtuels pour Telegram, Google & plus",
    template: "%s — num express",
  },
  description:
    "Achetez un numéro virtuel et recevez votre code de vérification SMS en quelques secondes. Paiement Mobile Money.",
  applicationName: "num express",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "num express",
    statusBarStyle: "black-translucent",
  },
  // Aperçu quand on partage le lien (WhatsApp, Facebook, Telegram, Messenger…).
  // Pas de champ `images` ici : Next ajoute automatiquement l'image produite
  // par `opengraph-image.tsx`.
  openGraph: {
    type: "website",
    siteName: "num express",
    locale: "fr_FR",
    url: "/",
    title: "num express — Numéros virtuels, codes SMS en Mobile Money",
    description:
      "Achetez un numéro virtuel et recevez votre code de vérification SMS en quelques secondes. Telegram, WhatsApp, Google et 2 000 services. Paiement Mobile Money.",
  },
  // Carte « grande image » sur X/Twitter. En l'absence d'image Twitter dédiée,
  // la plupart des plateformes retombent sur l'image Open Graph ci-dessus.
  twitter: {
    card: "summary_large_image",
    title: "num express — Numéros virtuels, codes SMS en Mobile Money",
    description:
      "Un numéro jetable pour recevoir vos codes SMS en quelques secondes. Paiement Mobile Money.",
  },
  // Empêche la traduction auto du navigateur, qui casse React (removeChild) et
  // rend les boutons non cliquables. L'app est déjà en français.
  other: { google: "notranslate" },
};

export const viewport: Viewport = {
  themeColor: "#0B3D24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      translate="no"
      suppressHydrationWarning
      className={`notranslate ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
        {/* Bannière « Installer l'application » (PWA) — Android + iOS. */}
        <InstallPrompt />
        {/* Mesure d'audience (Clarity). Voir le composant : numero, code SMS et
            espace admin sont occultes avant tout envoi. */}
        <Clarity />
        {/* Pixel Meta. Le SCRIPT reste hors Suspense : useSearchParams fait
            sortir son sous-arbre du rendu serveur, et le pixel n'arrivait
            alors jamais dans la page. Seul le suivi de navigation, qui lit
            l'URL, est isole. */}
        <MetaPixel />
        <SuiviSource />
        <Suspense fallback={null}>
          <MetaPageViews />
        </Suspense>
        {/* Lanceur du chat, placé au-dessus de la barre d'onglets. */}
        <ChatButton />
        {/* Chat client — Tawk.to.
            Retour à Tawk après Tidio : le plan gratuit de Tidio s'arrête à
            50 conversations par mois, et le chat s'est coupé le 31 octobre.
            Tawk n'a aucun plafond de conversations ; c'est leur modèle, ils
            vendent des agents humains en option, pas le logiciel.
            Le compte et l'identifiant sont ceux d'avant le 28 septembre.
            La bulle de Tawk elle-même est masquée par <ChatButton/>, qui la
            remplace par un lanceur maison placé au-dessus de la barre
            d'onglets — sans ça elle recouvre « Boost » et « Solde ». */}
        <Script id="tawk-to" strategy="afterInteractive">
          {`var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/6a4b718e4b956a1d4cbbda3c/1jsrb75an';
s1.charset='UTF-8';
s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);
})();`}
        </Script>
      </body>
    </html>
  );
}
