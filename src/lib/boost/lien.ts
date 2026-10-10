/**
 * Contrôle du lien AVANT de débiter le client et d'envoyer chez Peakerr.
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────
 * Sur 51 commandes Boost, 10 ont été remboursées — 20 %. Aucune n'a échoué
 * faute de solde : Peakerr les a toutes acceptées, puis annulées. En croisant
 * le service demandé avec la forme du lien fourni, la cause saute aux yeux :
 *
 *     Vues TikTok   +  lien de PROFIL        →  0 réussie / 2 annulées
 *     Vues TikTok   +  lien court            →  2 réussies / 2 annulées
 *     Abonnés FB    +  lien de PUBLICATION   →  0 réussie / 1 annulée
 *     Abonnés TikTok+  lien INSTAGRAM        →  0 réussie / 1 annulée
 *     Abonnés canal +  lien wa.me            →  0 réussie / 1 annulée
 *
 * Le client se trompe de lien, Peakerr annule, on rembourse. Entre-temps il a
 * attendu des jours, et il croit que le site ne marche pas. Six des dix
 * remboursements auraient été évités par le contrôle ci-dessous.
 *
 * ── Le principe ────────────────────────────────────────────────────────
 * Refuser tôt, et expliquer COMMENT corriger. Un message qui dit seulement
 * « lien invalide » laisse le client bloqué ; on lui dit donc exactement où
 * aller chercher le bon lien.
 */

/** Ce que le service attend comme cible. */
type Cible = "profil" | "publication";

/* La cle stockee en base est COMPOSEE : « tiktok_followers_moyenne », pas
   « followers ». Une comparaison stricte ne reconnaissait donc aucun service,
   et tout etait traite comme une publication — le rejeu sur l historique a
   montre 23 ventes reussies refusees a tort, soit 28 515 F. On cherche donc
   le mot-cle a l interieur de la cle. */
function cibleAttendue(serviceKey: string): Cible {
  const k = serviceKey.toLowerCase();
  if (/follow|abonn|membre|subscriber/.test(k)) return "profil";
  return "publication";
}

const HOTES: Record<string, string[]> = {
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com", "fb.me", "fb.watch"],
  whatsapp: ["whatsapp.com", "wa.me", "chat.whatsapp.com"],
  youtube: ["youtube.com", "youtu.be"],
  telegram: ["t.me", "telegram.me"],
  twitter: ["twitter.com", "x.com"],
};

const NOMS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  telegram: "Telegram",
  twitter: "X (Twitter)",
};

/**
 * Renvoie un message d'erreur destiné au client, ou `null` si le lien passe.
 * On ne refuse QUE les cas où les données montrent un échec systématique :
 * un contrôle trop zélé bloquerait des ventes qui auraient réussi.
 */
export function verifierLien(
  networkKey: string,
  serviceKey: string,
  lien: string,
): string | null {
  let u: URL;
  try {
    u = new URL(lien);
  } catch {
    return "Ce lien n'est pas valide. Copiez-le depuis la barre d'adresse de votre navigateur.";
  }

  const hote = u.hostname.replace(/^www\./, "").toLowerCase();
  const chemin = u.pathname.replace(/\/+$/, "");

  /* 1. Le lien doit appartenir au bon réseau. Un lien Instagram collé dans
        une commande TikTok est annulé à coup sûr — constaté une fois. */
  const attendus = HOTES[networkKey];
  if (attendus && !attendus.some((h) => hote === h || hote.endsWith("." + h))) {
    return `Ce lien ne vient pas de ${NOMS[networkKey] ?? networkKey}. Collez un lien ${NOMS[networkKey] ?? networkKey}.`;
  }

  const cible = cibleAttendue(serviceKey);

  /* 2. TikTok — c'est là que se concentrent les annulations. */
  if (networkKey === "tiktok") {
    const estVideo = /^\/(@[^/]+\/)?(video|photo)\/\d+/.test(chemin);
    const estProfil = /^\/@[^/]+$/.test(chemin);
    /* Les liens courts (vm.tiktok.com, tiktok.com/t/XXXX) sont TOLERES.
       J avais prevu de les refuser ; le rejeu sur l historique l a interdit :
       trois ventes reussies, dont une de 1 750 F, auraient ete bloquees pour
       deux remboursements evites. Un controle qui refuse de vraies ventes
       coute plus cher que les remboursements qu il evite. */
    const estCourt = hote.startsWith("vm.") || /^\/t\//.test(chemin) || /^\/Z[A-Za-z0-9]{6,}$/.test(chemin);

    if (cible === "publication" && estProfil) {
      return "Pour des vues ou des likes, il faut le lien de la VIDÉO, pas celui du profil. Ouvrez la vidéo, puis Partager → Copier le lien.";
    }
    if (cible === "publication" && !estVideo && !estCourt) {
      return "Collez le lien d'une vidéo TikTok (il contient /video/).";
    }
    if (cible === "profil" && estVideo) {
      return "Pour des abonnés, il faut le lien de votre PROFIL, pas celui d'une vidéo. Il ressemble à tiktok.com/@votrecompte.";
    }
  }

  /* 3. Instagram — même logique, publication contre profil. */
  if (networkKey === "instagram") {
    const estPublication = /^\/(p|reel|reels|tv)\//.test(chemin);
    const estProfil = /^\/[A-Za-z0-9._]+$/.test(chemin) && !estPublication;
    if (cible === "publication" && estProfil) {
      return "Pour des vues ou des likes, il faut le lien de la PUBLICATION, pas celui du profil. Ouvrez la publication, puis ⋯ → Copier le lien.";
    }
    if (cible === "profil" && estPublication) {
      return "Pour des abonnés, il faut le lien de votre PROFIL, pas celui d'une publication.";
    }
  }

  /* 4. WhatsApp — un lien de discussion n'est pas un canal. Constaté une fois :
        wa.me accepté puis annulé. */
  if (networkKey === "whatsapp") {
    if (hote === "wa.me" || hote === "chat.whatsapp.com") {
      return "Ce lien ouvre une discussion, pas un canal. Dans votre canal WhatsApp : ⋮ → Inviter des abonnés → Copier le lien.";
    }
    if (!/^\/channel\//.test(chemin)) {
      return "Collez le lien de votre canal WhatsApp (il contient /channel/).";
    }
  }

  /* 5. Facebook — on se limite au cas prouvé : une publication fournie pour
        une commande d'abonnés de page. Le reste des formes Facebook a
        fonctionné, on ne les bloque donc pas. */
  if (networkKey === "facebook" && cible === "profil") {
    if (/\/(posts|photos?|videos?|permalink|reel)\//.test(chemin)) {
      return "Pour des abonnés, il faut le lien de votre PAGE, pas celui d'une publication.";
    }
  }

  return null;
}
