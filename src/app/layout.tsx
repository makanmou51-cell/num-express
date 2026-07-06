import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

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
    default: "num express — Numéros virtuels pour WhatsApp & plus",
    template: "%s — num express",
  },
  description:
    "Achetez un numéro virtuel et recevez votre code de vérification SMS en quelques secondes. Paiement Mobile Money.",
  // Empêche la traduction auto du navigateur, qui casse React (removeChild) et
  // rend les boutons non cliquables. L'app est déjà en français.
  other: { google: "notranslate" },
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
        {/* Chat client (Tawk.to) — service clientèle en direct sur tout le site. */}
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
