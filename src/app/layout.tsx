import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Clarity } from "@/components/clarity";
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
        {/* Lanceur du chat, placé au-dessus de la barre d'onglets. */}
        <ChatButton />
        {/* Chat client (Tidio). La bulle de Tidio elle-même est masquée par
            <ChatButton/>, qui la remplace par un lanceur maison placé au-dessus
            de la barre d'onglets. Ici on ne fait que forcer le vert de marque
            (--primary) à la place du bleu Tidio.
            Double garde : l'API peut déjà exister quand ce script s'exécute,
            sinon on attend l'événement `tidioChat-ready`. */}
        <Script id="tidio-theme" strategy="afterInteractive">
          {`(function(){
function ready(){try{window.tidioChatApi.setColorPalette('#047857');}catch(e){}}
if(window.tidioChatApi){ready();}
document.addEventListener('tidioChat-ready',ready);
})();`}
        </Script>
        <Script
          id="tidio-chat"
          src="https://code.tidio.co/gnlqkvlsoczuqum0ftaworkr5vpqwtmb.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
