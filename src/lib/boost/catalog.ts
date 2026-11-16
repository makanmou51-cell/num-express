// Catalogue « Boost » CURATED (façon ExoBooster) : sélection FIABLE de services
// Peakerr, 1-2 niveaux de qualité, prix de VENTE clair en F CFA (par 1000).
// `peakerrServiceId` = ID réel Peakerr (vérifié contre la liste live le
// 2026-11-16). Prix RÉVISÉS pour être compétitifs : proches du marché, mais
// toujours bien au-dessus du coût Peakerr (marge conservée, jamais à perte).

export interface BoostTier {
  key: string;
  label: string;
  peakerrServiceId: number;
  min: number;
  max: number;
  pricePer1000Xof: number;
  eta: string;
  refill: string;
}
export interface BoostService {
  key: string;
  label: string;
  linkHint: string;
  tiers: BoostTier[];
}
export interface BoostNetwork {
  key: string;
  label: string;
  icon: string; // code logo (ServiceIcon) : lf, ig, fb, tg, yt, wa
  services: BoostService[];
}

export const BOOST_CATALOG: BoostNetwork[] = [
  {
    key: "tiktok",
    label: "TikTok",
    icon: "lf",
    services: [
      {
        key: "followers",
        label: "Followers",
        linkHint: "Lien de ton PROFIL TikTok (ex. tiktok.com/@ton_compte)",
        tiers: [
          { key: "moyenne", label: "Standard · faible perte · recharge 30 j", peakerrServiceId: 29840, min: 10, max: 1000000, pricePer1000Xof: 2000, eta: "0-1h", refill: "30 jours" },
          { key: "haute", label: "Haute qualité · réels · recharge", peakerrServiceId: 29427, min: 10, max: 500000, pricePer1000Xof: 3000, eta: "0-1h", refill: "10 jours" },
        ],
      },
      {
        key: "likes",
        label: "J'aime",
        linkHint: "Lien de la VIDÉO TikTok",
        tiers: [
          { key: "standard", label: "100% réels · sans chute", peakerrServiceId: 26238, min: 10, max: 1000000, pricePer1000Xof: 400, eta: "0-1h", refill: "Non" },
        ],
      },
      {
        key: "vues",
        label: "Vues",
        linkHint: "Lien de la VIDÉO TikTok",
        tiers: [
          { key: "standard", label: "Standard", peakerrServiceId: 4720, min: 100, max: 1000000, pricePer1000Xof: 100, eta: "0-1h", refill: "Non" },
        ],
      },
      {
        key: "partages",
        label: "Partages",
        linkHint: "Lien de la VIDÉO TikTok",
        tiers: [
          { key: "standard", label: "Sans chute · rapide", peakerrServiceId: 25803, min: 10, max: 1000000, pricePer1000Xof: 300, eta: "0-30 min", refill: "Non" },
        ],
      },
      {
        key: "saves",
        label: "Enregistrements",
        linkHint: "Lien de la VIDÉO TikTok",
        tiers: [
          { key: "standard", label: "Standard", peakerrServiceId: 24544, min: 10, max: 1000000, pricePer1000Xof: 200, eta: "0-1h", refill: "Non" },
        ],
      },
    ],
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: "ig",
    services: [
      {
        key: "followers",
        label: "Followers",
        linkHint: "Lien de ton PROFIL Instagram",
        tiers: [
          { key: "moyenne", label: "Standard · faible perte · recharge 30 j", peakerrServiceId: 31347, min: 10, max: 500000, pricePer1000Xof: 2500, eta: "0-1h", refill: "30 jours" },
          { key: "haute", label: "Haute qualité · faible perte · recharge à vie", peakerrServiceId: 31351, min: 10, max: 500000, pricePer1000Xof: 3500, eta: "0-1h", refill: "À vie" },
        ],
      },
      {
        key: "likes",
        label: "J'aime",
        linkHint: "Lien de la PUBLICATION Instagram",
        tiers: [
          { key: "standard", label: "Standard", peakerrServiceId: 30776, min: 20, max: 100000, pricePer1000Xof: 400, eta: "0-1h", refill: "Non" },
        ],
      },
      {
        key: "vues",
        label: "Vues (Reels/Vidéo)",
        linkHint: "Lien de la VIDÉO / du REEL Instagram",
        tiers: [
          { key: "standard", label: "Standard", peakerrServiceId: 31766, min: 100, max: 500000, pricePer1000Xof: 100, eta: "0-1h", refill: "Non" },
        ],
      },
      {
        key: "vues_story",
        label: "Vues de story",
        linkHint: "Lien de ta STORY Instagram",
        tiers: [
          { key: "standard", label: "Toutes les stories", peakerrServiceId: 10564, min: 100, max: 500000, pricePer1000Xof: 100, eta: "0-1h", refill: "Non" },
        ],
      },
      {
        key: "commentaires",
        label: "Commentaires",
        linkHint: "Lien de la PUBLICATION Instagram",
        tiers: [
          { key: "standard", label: "100% réels · aléatoires", peakerrServiceId: 29484, min: 50, max: 10000, pricePer1000Xof: 1500, eta: "0-1h", refill: "Non" },
        ],
      },
    ],
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: "fb",
    services: [
      {
        key: "followers",
        label: "Abonnés de page",
        linkHint: "Lien de ta PAGE Facebook",
        tiers: [
          { key: "standard", label: "Faible perte · recharge 90 j", peakerrServiceId: 29813, min: 10, max: 1000000, pricePer1000Xof: 1200, eta: "0-1h", refill: "90 jours" },
        ],
      },
      {
        key: "profil",
        label: "Abonnés de profil",
        linkHint: "Lien de ton PROFIL Facebook",
        tiers: [
          { key: "standard", label: "Haute qualité · réels · monde", peakerrServiceId: 32262, min: 10, max: 500000, pricePer1000Xof: 1200, eta: "0-1h", refill: "Non" },
        ],
      },
      {
        key: "likes",
        label: "J'aime de publication",
        linkHint: "Lien de la PUBLICATION Facebook",
        tiers: [
          { key: "standard", label: "Haute qualité · recharge", peakerrServiceId: 29580, min: 10, max: 1000000, pricePer1000Xof: 800, eta: "0-1h", refill: "Oui" },
        ],
      },
      {
        key: "reactions",
        label: "Réactions (emoji)",
        linkHint: "Lien de la PUBLICATION Facebook",
        tiers: [
          { key: "standard", label: "J'aime / J'adore", peakerrServiceId: 32256, min: 10, max: 500000, pricePer1000Xof: 400, eta: "0-30 min", refill: "Non" },
        ],
      },
      {
        key: "group",
        label: "Membres de groupe",
        linkHint: "Lien de ton GROUPE Facebook",
        tiers: [
          { key: "standard", label: "Haute qualité · réels · faible perte", peakerrServiceId: 33440, min: 10, max: 50000, pricePer1000Xof: 800, eta: "0-1h", refill: "Non" },
        ],
      },
      {
        key: "vues",
        label: "Vues vidéo / Reel",
        linkHint: "Lien de la VIDÉO / du REEL Facebook",
        tiers: [
          { key: "standard", label: "Sans chute · à vie", peakerrServiceId: 29450, min: 100, max: 1000000, pricePer1000Xof: 150, eta: "0-1h", refill: "À vie" },
        ],
      },
      {
        key: "commentaires",
        label: "Commentaires",
        linkHint: "Lien de la PUBLICATION Facebook",
        tiers: [
          { key: "standard", label: "Aléatoires", peakerrServiceId: 33700, min: 10, max: 100000, pricePer1000Xof: 2000, eta: "0-1h", refill: "Non" },
        ],
      },
    ],
  },
  {
    key: "telegram",
    label: "Telegram",
    icon: "tg",
    services: [
      {
        key: "membres",
        label: "Membres (canal/groupe)",
        linkHint: "Lien de ton CANAL ou GROUPE Telegram",
        tiers: [
          { key: "standard", label: "Recharge 30 j · rapide", peakerrServiceId: 31029, min: 10, max: 500000, pricePer1000Xof: 800, eta: "0-1h", refill: "30 jours" },
        ],
      },
      {
        key: "vues",
        label: "Vues de post",
        linkHint: "Lien du POST Telegram",
        tiers: [
          { key: "standard", label: "Standard", peakerrServiceId: 15974, min: 100, max: 500000, pricePer1000Xof: 100, eta: "0-1h", refill: "Non" },
        ],
      },
      {
        key: "reactions",
        label: "Réactions",
        linkHint: "Lien du POST Telegram",
        tiers: [
          { key: "standard", label: "Premium", peakerrServiceId: 15396, min: 20, max: 100000, pricePer1000Xof: 300, eta: "Instantané", refill: "Non" },
        ],
      },
      {
        key: "partages",
        label: "Partages de post",
        linkHint: "Lien du POST Telegram",
        tiers: [
          { key: "standard", label: "Réels", peakerrServiceId: 16052, min: 10, max: 100000, pricePer1000Xof: 200, eta: "0-1h", refill: "Non" },
        ],
      },
    ],
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: "yt",
    services: [
      {
        key: "abonnes",
        label: "Abonnés",
        linkHint: "Lien de ta CHAÎNE YouTube",
        tiers: [
          { key: "standard", label: "Rapide", peakerrServiceId: 23304, min: 20, max: 100000, pricePer1000Xof: 2000, eta: "0-6h", refill: "Non" },
        ],
      },
      {
        key: "vues",
        label: "Vues",
        linkHint: "Lien de la VIDÉO YouTube",
        tiers: [
          { key: "standard", label: "Standard", peakerrServiceId: 30204, min: 100, max: 500000, pricePer1000Xof: 1500, eta: "0-1h", refill: "Non" },
        ],
      },
      {
        key: "likes",
        label: "J'aime",
        linkHint: "Lien de la VIDÉO YouTube",
        tiers: [
          { key: "standard", label: "Sans chute · recharge 30 j", peakerrServiceId: 32112, min: 20, max: 100000, pricePer1000Xof: 1500, eta: "0-1h", refill: "30 jours" },
        ],
      },
      {
        key: "commentaires",
        label: "Commentaires",
        linkHint: "Lien de la VIDÉO YouTube",
        tiers: [
          { key: "standard", label: "Personnalisés · sans chute", peakerrServiceId: 32839, min: 10, max: 100000, pricePer1000Xof: 3000, eta: "0-1h", refill: "Non" },
        ],
      },
    ],
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: "wa",
    services: [
      {
        key: "membres",
        label: "Abonnés de canal",
        linkHint: "Lien de ton CANAL WhatsApp",
        tiers: [
          { key: "standard", label: "Standard", peakerrServiceId: 33597, min: 20, max: 20000, pricePer1000Xof: 1500, eta: "0-6h", refill: "Non" },
        ],
      },
      {
        key: "reactions",
        label: "Réactions",
        linkHint: "Lien du POST WhatsApp",
        tiers: [
          { key: "standard", label: "Emoji aléatoire", peakerrServiceId: 33599, min: 20, max: 20000, pricePer1000Xof: 300, eta: "0-6h", refill: "Non" },
        ],
      },
    ],
  },
];

/** Un service est activable seulement si son ID Peakerr est renseigné (> 0). */
export function tierIsLive(t: BoostTier): boolean {
  return t.peakerrServiceId > 0;
}

/** Retrouve un palier précis (réseau + service + tier). */
export function findTier(
  network: string,
  service: string,
  tier: string,
): { network: BoostNetwork; service: BoostService; tier: BoostTier } | null {
  const n = BOOST_CATALOG.find((x) => x.key === network);
  const s = n?.services.find((x) => x.key === service);
  const t = s?.tiers.find((x) => x.key === tier);
  if (!n || !s || !t) return null;
  return { network: n, service: s, tier: t };
}

/** Prix de vente en F CFA pour une quantité (arrondi au multiple de 5). */
export function boostPriceXof(tier: BoostTier, quantity: number): number {
  const raw = (quantity / 1000) * tier.pricePer1000Xof;
  return Math.max(5, Math.ceil(raw / 5) * 5);
}
