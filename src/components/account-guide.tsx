/**
 * « Prendre possession de votre compte » — guide affiché au client après
 * livraison.
 *
 * Il ne couvre qu'une chose : comment se connecter au compte reçu et le
 * mettre à SON nom (changer le mot de passe, sécuriser l'e-mail, activer sa
 * propre double authentification). C'est ce qui évite le plus de
 * réclamations : un client qui ne change rien se fait éjecter à la première
 * vérification, et revient dire « le compte ne marche pas ».
 *
 * Volontairement sobre, replié par défaut : il ne doit pas masquer les
 * identifiants, qui sont ce que le client vient chercher.
 */
export function AccountGuide() {
  return (
    <details className="rounded-xl border border-border bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground">
        <span className="select-none">▸ </span>
        Comment prendre possession du compte
      </summary>
      <div className="space-y-3 border-t border-border px-4 py-3 text-sm text-muted">
        <p className="font-medium text-foreground">
          Faites ces étapes dès maintenant, dans l&apos;ordre. Un compte qu&apos;on
          ne sécurise pas peut se bloquer au premier jour.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Connectez-vous</strong> avec
            l&apos;identifiant (ou l&apos;e-mail du compte) et le mot de passe
            ci-dessus. Depuis un téléphone au repos, pas depuis dix appareils
            à la fois.
          </li>
          <li>
            S&apos;il demande un code à deux facteurs, entrez la{" "}
            <strong className="text-foreground">clé 2FA</strong> fournie dans
            une application comme Google Authenticator pour obtenir le code à
            6&nbsp;chiffres.
          </li>
          <li>
            <strong className="text-foreground">Changez le mot de passe</strong>{" "}
            tout de suite, pour un mot de passe à vous que personne d&apos;autre
            ne connaît.
          </li>
          <li>
            <strong className="text-foreground">
              Prenez la main sur l&apos;e-mail de récupération
            </strong>{" "}
            : connectez-vous à l&apos;e-mail de secours fourni et changez aussi
            son mot de passe. Sans ça, la récupération du compte ne vous
            appartient pas vraiment.
          </li>
          <li>
            <strong className="text-foreground">
              Activez votre propre double authentification
            </strong>{" "}
            avec votre numéro, et retirez l&apos;ancienne clé 2FA. Le compte est
            alors entièrement à vous.
          </li>
        </ol>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Gardez ces identifiants en lieu sûr&nbsp;: ils ne s&apos;affichent que
          sur cette page. Un souci de connexion&nbsp;? Écrivez-nous par le chat
          en bas à droite.
        </p>
      </div>
    </details>
  );
}
