import Script from "next/script";

/**
 * Microsoft Clarity — enregistrements de session et cartes de chaleur.
 *
 * À quoi ça sert ici : l'entonnoir (/admin/funnel) dit OÙ les clients
 * s'arrêtent — 72 % ne tentent jamais un paiement. Il ne peut pas dire
 * POURQUOI. Clarity filme l'écran et le montre.
 *
 * ── Ce qui NE DOIT JAMAIS être enregistré ────────────────────────────────
 * Clarity, par défaut, n'occulte que les champs qu'il juge sensibles : le
 * texte affiché dans la page, lui, part tel quel. Or nos écrans affichent le
 * numéro virtuel et le CODE de vérification WhatsApp du client. Laisser ça
 * partir chez Microsoft serait inacceptable.
 *
 * Trois protections, posées dans le code plutôt que dans le tableau de bord
 * (un réglage distant peut être changé par erreur ; un attribut dans le code
 * est versionné et relu) :
 *   1. `data-clarity-mask` sur la valeur affichée par <CopyField/> — un seul
 *      endroit, qui couvre à la fois le numéro et le code SMS ;
 *   2. le même attribut sur le champ mot de passe, qui bascule en clair
 *      (`type="text"`) quand le client clique sur l'œil ;
 *   3. le même attribut sur TOUT l'espace admin, où s'affichent les e-mails,
 *      soldes et codes de tous les clients.
 *
 * `strategy="lazyOnload"` : le script ne part qu'après le chargement complet.
 * Le public est en 3G à Cotonou — la mesure ne doit pas ralentir l'achat.
 */

const PROJECT_ID = "ypc17gat69";

/**
 * Coupe définitivement l'enregistrement pour la session en cours.
 *
 * Appelée sur les écrans où le code de vérification s'affiche. Pourquoi cette
 * mesure radicale plutôt qu'un simple masquage : sur ces écrans, le code est
 * aussi recopié dans le TITRE de l'onglet — pour que le client le lise depuis
 * WhatsApp sans revenir sur la page. C'est une vraie fonctionnalité, on la
 * garde. Mais Clarity enregistre le titre des pages, et aucun attribut HTML
 * ne peut l'occulter.
 *
 * On ne relance jamais : en cas de doute, la session n'est pas filmée. Le coût
 * est faible — l'écran d'attente du code est après l'achat, alors que ce qu'on
 * cherche à comprendre se joue avant.
 */
export function stopClarityRecording() {
  try {
    (window as unknown as { clarity?: (cmd: string) => void }).clarity?.(
      "stop",
    );
  } catch {
    /* script absent ou bloqué : il n'y a alors rien à arrêter */
  }
}

export function Clarity() {
  // Pas de collecte en développement : sinon nos propres allers-retours
  // polluent les enregistrements et faussent les cartes de chaleur.
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <Script id="ms-clarity" strategy="lazyOnload">
      {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window,document,"clarity","script","${PROJECT_ID}");`}
    </Script>
  );
}
