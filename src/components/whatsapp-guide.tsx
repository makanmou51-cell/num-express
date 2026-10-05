import { IconWarnCircle } from "@/components/icons";

/**
 * Encadré d'aide WhatsApp (français simple, court). La cause n°1 d'un code qui
 * « n'arrive pas » = l'antifraude WhatsApp bloque quand l'IP du client ne
 * correspond pas au pays du numéro. Parade : un VPN réglé sur le pays du numéro.
 *
 * Instructions données par le support HeroSMS le 2026-10-05 (agent Logan),
 * mot pour mot : « You must use a VPN or proxy so that your IP address matches
 * the number's geolocation. And change your IP address FOR EACH NEW NUMBER. …
 * When you change your IP address, the app where you are requesting the code
 * must be COMPLETELY CLOSED. »
 *
 * Ces deux précisions manquaient et expliquent les échecs en série : un client
 * qui réessaie sans changer d'IP se fait bloquer à chaque fois pour la même
 * raison. Constaté en production — un client a brûlé 11 numéros allemands en
 * 13 heures, presque certainement sur la même adresse.
 *
 * Compromis assumé : déplié, ce pavé d'étapes occupait tout le premier
 * écran et repoussait LE NUMÉRO sous la ligne de flottaison. Mais le tout
 * replier ferait baisser la conversion, puisque c'est LE conseil qui décide
 * qu'un code WhatsApp arrive ou non. Donc : la consigne VPN — la seule qui
 * compte vraiment — reste toujours lisible dans l'en-tête, et seul le détail
 * en 4 étapes se replie. Le `<details>` natif ne coûte aucun JavaScript, le
 * composant reste sans état et utilisable côté serveur.
 */
export function WhatsAppGuide({
  countryName,
}: {
  countryName?: string | null;
}) {
  const country = countryName?.trim();
  return (
    <details className="group rounded-2xl border border-amber-300 bg-amber-50 text-sm">
      {/* min-h-11 : la zone de dépliage reste une cible tactile correcte. */}
      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 p-4 text-amber-900">
        <IconWarnCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <span className="flex-1">
          <span className="block font-semibold">
            Allume un VPN sur{" "}
            {country ? (
              <>le pays du numéro&nbsp;: {country}</>
            ) : (
              "le pays du numéro"
            )}
          </span>
          <span className="mt-0.5 block text-amber-900/80">
            Sans ça, WhatsApp bloque le code. Voir les 5 étapes
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className="mt-0.5 h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <div className="px-4 pb-4">
        <ol className="list-decimal space-y-1.5 pl-5 text-amber-900/90">
          <li>
            Recharge et achète le numéro <strong>sans VPN</strong>.
          </li>
          <li>
            <strong>Ferme complètement WhatsApp.</strong> Pas seulement réduire
            : sors-le des applications récentes.
          </li>
          <li>
            Allume un <strong>VPN sur le pays du numéro</strong>
            {country ? (
              <>
                {" "}
                (ici&nbsp;: <strong>{country}</strong>)
              </>
            ) : null}
            . Prends un VPN de type <strong>VLESS</strong>.
          </li>
          <li>
            Rouvre WhatsApp, mets le numéro, demande le code (ou{" "}
            <strong>«&nbsp;Appelez-moi&nbsp;»</strong>).
          </li>
          <li>
            Reviens ici, <strong>copie le code</strong> et colle-le dans
            WhatsApp.
          </li>
        </ol>

        {/* LE conseil qui change tout, et celui qu'on n'avait jamais donné.
            Réessayer sans changer d'adresse, c'est se faire bloquer pour la
            même raison : un client a brûlé 11 numéros comme ça. */}
        <p className="mt-3 rounded-xl bg-amber-900/10 p-3 text-amber-900">
          <strong>Si le code n&apos;arrive pas :</strong> change d&apos;adresse
          dans ton VPN <strong>avant</strong> d&apos;essayer un autre numéro
          (autre serveur, ou coupe et rallume). Avec la même adresse, le
          deuxième numéro échouera pour la même raison que le premier.
        </p>

        <p className="mt-2 text-xs text-amber-900/70">
          Astuce&nbsp;: recharge toujours <strong>sans VPN</strong>, puis allume
          le VPN juste pour WhatsApp.
        </p>
      </div>
    </details>
  );
}
