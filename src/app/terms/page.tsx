import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description:
    "Conditions d'utilisation de num express : numéros virtuels, boost de réseaux sociaux, comptes, paiements Mobile Money et remboursements.",
};

/* Date de dernière mise à jour. Affichée en clair : une page de conditions
   sans date fait douter de sa validité, et les programmes partenaires (ex.
   Meta Ads) vérifient qu'une vraie page existe. */
const MAJ = "13 novembre 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* En-tête simple : logo + retour. Pas de grande nav : on est sur une
          page de lecture, pas sur l'accueil. */}
      <header className="border-b border-border/60 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" aria-label="Retour à l'accueil">
            <Logo />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-primary hover:underline"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Conditions d&apos;utilisation
        </h1>
        <p className="mt-2 text-sm text-muted">
          Dernière mise à jour : {MAJ}
        </p>

        <p className="mt-6 leading-relaxed text-foreground">
          En créant un compte ou en utilisant num express (le «&nbsp;Service&nbsp;»),
          vous acceptez les présentes conditions. Si vous n&apos;êtes pas
          d&apos;accord, n&apos;utilisez pas le Service.
        </p>

        <Section n="1" title="Qui nous sommes">
          <p>
            num express est un service en ligne qui propose&nbsp;:
          </p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>
              des numéros de téléphone virtuels temporaires pour recevoir des
              codes de vérification par SMS&nbsp;;
            </li>
            <li>
              des prestations de boost de réseaux sociaux (abonnés, mentions
              j&apos;aime, vues)&nbsp;;
            </li>
            <li>des comptes de réseaux sociaux prêts à l&apos;emploi.</li>
          </ul>
          <p className="mt-2">
            Les paiements se font en F&nbsp;CFA par Mobile Money.
          </p>
        </Section>

        <Section n="2" title="Votre compte">
          <ul className="ml-5 list-disc space-y-1">
            <li>Vous devez avoir au moins 18 ans.</li>
            <li>
              Vous fournissez une adresse e-mail valide et des informations
              exactes.
            </li>
            <li>
              Vous êtes responsable de la confidentialité de vos identifiants et
              de toute activité réalisée depuis votre compte.
            </li>
            <li>
              Un seul compte par personne. La création de comptes multiples pour
              abuser des offres (bonus de bienvenue, parrainage) peut entraîner
              la fermeture des comptes concernés.
            </li>
          </ul>
        </Section>

        <Section n="3" title="Solde et paiements">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Les recharges se font par Mobile Money et créditent un solde en
              F&nbsp;CFA, utilisable uniquement pour payer nos services.
            </li>
            <li>
              Les prix sont affichés <strong>avant</strong> l&apos;achat. Le prix
              exact d&apos;un numéro dépend du pays et du service choisis.
            </li>
            <li>
              Le solde n&apos;est pas convertible en espèces et n&apos;est pas
              transférable d&apos;un compte à un autre.
            </li>
          </ul>
        </Section>

        <Section n="4" title="Numéros virtuels">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Un numéro virtuel sert à recevoir le code de vérification
              d&apos;un service, une fois, pendant une durée limitée.
            </li>
            <li>
              Nous ne contrôlons pas les plateformes tierces (WhatsApp,
              Telegram, Google…)&nbsp;: nous ne pouvons pas garantir qu&apos;un
              service donné acceptera un numéro, ni qu&apos;un compte créé ne
              sera pas restreint par la plateforme.
            </li>
            <li>
              <strong>Remboursement automatique</strong>&nbsp;: si le code
              n&apos;est pas reçu, le montant est recrédité sur votre solde. Vous
              ne payez que pour un code effectivement reçu.
            </li>
          </ul>
        </Section>

        <Section n="5" title="Boost et comptes de réseaux sociaux">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Les prestations de boost sont livrées dans un délai variable selon
              le service&nbsp;; un refill peut être inclus lorsque cela est
              indiqué.
            </li>
            <li>
              Les comptes vendus sont livrés après paiement et conservés dans
              votre espace.
            </li>
            <li>
              Les réseaux sociaux appliquent leurs propres règles. Nous ne
              sommes pas responsables des décisions qu&apos;ils prennent
              (limitation, suspension ou suppression d&apos;un compte ou
              d&apos;un contenu) après la livraison.
            </li>
          </ul>
        </Section>

        <Section n="6" title="Utilisation acceptable">
          <p>
            Vous vous engagez à utiliser le Service dans le respect des lois
            applicables et des conditions des plateformes tierces. Il est
            notamment interdit d&apos;utiliser le Service pour&nbsp;:
          </p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>
              des activités frauduleuses, du harcèlement, de l&apos;usurpation
              d&apos;identité ou toute activité illégale&nbsp;;
            </li>
            <li>
              nuire à autrui ou contourner la sécurité d&apos;un tiers de façon
              illicite.
            </li>
          </ul>
          <p className="mt-2">
            Vous êtes seul responsable de l&apos;usage que vous faites des
            numéros, comptes et prestations obtenus.
          </p>
        </Section>

        <Section n="7" title="Remboursements">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Numéros&nbsp;: remboursement automatique sur le solde si le code
              n&apos;est pas reçu (voir l&apos;article&nbsp;4).
            </li>
            <li>
              Boost&nbsp;: remboursement si la commande est annulée ou non
              livrée, selon le cas.
            </li>
            <li>
              Les sommes remboursées le sont sur votre solde num express.
            </li>
          </ul>
        </Section>

        <Section n="8" title="Disponibilité et responsabilité">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Le Service est fourni «&nbsp;en l&apos;état&nbsp;». Nous faisons de
              notre mieux pour en assurer la disponibilité, sans pouvoir garantir
              un fonctionnement ininterrompu.
            </li>
            <li>
              Dans la limite permise par la loi, num express ne peut être tenu
              responsable des dommages indirects, ni des conséquences des
              décisions prises par des plateformes tierces.
            </li>
            <li>
              Notre responsabilité éventuelle est limitée au montant que vous
              avez payé pour la prestation concernée.
            </li>
          </ul>
        </Section>

        <Section n="9" title="Modification du service et des conditions">
          <p>
            Nous pouvons faire évoluer le Service et ces conditions. La date de
            dernière mise à jour figure en haut de cette page. En continuant à
            utiliser le Service, vous acceptez la version en vigueur.
          </p>
        </Section>

        <Section n="10" title="Données personnelles">
          <p>
            Nous collectons le minimum d&apos;informations nécessaires au
            fonctionnement du Service (adresse e-mail, historique de commandes,
            données de paiement traitées par nos prestataires). Vos données ne
            sont pas vendues à des tiers.
          </p>
        </Section>

        <Section n="11" title="Contact">
          <p>
            Une question&nbsp;? Contactez-nous via le chat en direct, en bas à
            droite de l&apos;écran.
          </p>
        </Section>

        <Section n="12" title="Droit applicable">
          <p>
            Les présentes conditions sont régies par le droit en vigueur au
            Bénin.
          </p>
        </Section>

        <div className="mt-12 border-t border-border/60 pt-6 text-sm text-muted">
          <Link href="/" className="font-medium text-primary hover:underline">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </main>
    </div>
  );
}

/* Un article des conditions : numéro discret + titre + corps. Le corps hérite
   d'une couleur et d'un interligne lisibles via la classe parente. */
function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">
        <span className="mr-2 text-muted">{n}.</span>
        {title}
      </h2>
      <div className="mt-2 leading-relaxed text-muted [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}
