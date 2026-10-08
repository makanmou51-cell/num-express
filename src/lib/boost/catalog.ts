// Catalogue « Boost » CURATED (façon ExoBooster) : sélection FIABLE de services
// Peakerr, 1-2 niveaux de qualité, prix de VENTE clair en F CFA (par 1000).
// `peakerrServiceId` = ID réel Peakerr. Le coût Peakerr est bien sous le prix
// de vente -> ta marge.

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
          { key: "moyenne", label: "Standard · Low Drop · Refill 30j", peakerrServiceId: 29840, min: 10, max: 1000000, pricePer1000Xof: 3500, eta: "0-1h", refill: "30 jours" },
          { key: "haute", label: "HQ réels · Low Drop · Refill", peakerrServiceId: 29427, min: 10, max: 500000, pricePer1000Xof: 4800, eta: "0-1h", refill: "10 jours" },
        ],
      },
      {
        key: "likes",
        label: "Likes",
        linkHint: "Lien de la VIDÉO TikTok",
        tiers: [
          { key: "moyenne", label: "100% réels · Non-drop · Refill", peakerrServiceId: 33159, min: 10, max: 1000000, pricePer1000Xof: 2500, eta: "0-1h", refill: "Oui ✓" },
        ],
      },
      {
        key: "vues",
        label: "Vues",
        linkHint: "Lien de la VIDÉO TikTok",
        tiers: [
          { key: "standard", label: "Standard", peakerrServiceId: 4720, min: 100, max: 1000000, pricePer1000Xof: 700, eta: "0-1h", refill: "Non" },
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
          { key: "moyenne", label: "Standard · Low Drop · Refill 30j", peakerrServiceId: 31347, min: 10, max: 500000, pricePer1000Xof: 3000, eta: "0-1h", refill: "30 jours" },
          { key: "haute", label: "HQ · Low Drop · Refill à vie", peakerrServiceId: 31351, min: 10, max: 500000, pricePer1000Xof: 4200, eta: "0-1h", refill: "À vie" },
        ],
      },
      {
        key: "likes",
        label: "Likes",
        linkHint: "Lien de la PUBLICATION Instagram",
        tiers: [
          { key: "standard", label: "Standard", peakerrServiceId: 30776, min: 20, max: 100000, pricePer1000Xof: 2000, eta: "0-1h", refill: "Non" },
        ],
      },
      {
        key: "vues",
        label: "Vues (Reels/Vidéo)",
        linkHint: "Lien de la VIDÉO / du REEL Instagram",
        tiers: [
          { key: "standard", label: "Standard", peakerrServiceId: 31766, min: 100, max: 500000, pricePer1000Xof: 500, eta: "0-1h", refill: "Non" },
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
        label: "Abonnés Page",
        linkHint: "Lien de ta PAGE Facebook",
        tiers: [
          { key: "standard", label: "Low Drop · Refill 90j", peakerrServiceId: 29813, min: 10, max: 1000000, pricePer1000Xof: 3500, eta: "0-1h", refill: "90 jours" },
        ],
      },
      {
        key: "likes",
        label: "Likes de publication",
        linkHint: "Lien de la PUBLICATION Facebook",
        tiers: [
          { key: "standard", label: "HQ · Refill", peakerrServiceId: 29580, min: 10, max: 1000000, pricePer1000Xof: 4000, eta: "0-1h", refill: "Oui ✓" },
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
          { key: "standard", label: "HQ · Refill 30j", peakerrServiceId: 31210, min: 20, max: 1000000, pricePer1000Xof: 2500, eta: "0-1h", refill: "30 jours" },
        ],
      },
      {
        key: "vues",
        label: "Vues de post",
        linkHint: "Lien du POST Telegram",
        tiers: [
          { key: "standard", label: "Standard", peakerrServiceId: 15974, min: 100, max: 500000, pricePer1000Xof: 500, eta: "0-1h", refill: "Non" },
        ],
      },
      {
        key: "reactions",
        label: "Réactions",
        linkHint: "Lien du POST Telegram",
        tiers: [
          { key: "standard", label: "Premium", peakerrServiceId: 15396, min: 20, max: 100000, pricePer1000Xof: 1500, eta: "Instant", refill: "Non" },
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
          { key: "standard", label: "Rapide", peakerrServiceId: 23304, min: 20, max: 100000, pricePer1000Xof: 5000, eta: "0-6h", refill: "Non" },
        ],
      },
      {
        key: "vues",
        label: "Vues",
        linkHint: "Lien de la VIDÉO YouTube",
        tiers: [
          { key: "standard", label: "Standard", peakerrServiceId: 30204, min: 100, max: 500000, pricePer1000Xof: 2500, eta: "0-1h", refill: "Non" },
        ],
      },
      {
        key: "likes",
        label: "Likes",
        linkHint: "Lien de la VIDÉO YouTube",
        tiers: [
          { key: "standard", label: "Non-drop · Refill 30j", peakerrServiceId: 32112, min: 20, max: 100000, pricePer1000Xof: 3500, eta: "0-1h", refill: "30 jours" },
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
          { key: "standard", label: "Standard", peakerrServiceId: 33597, min: 20, max: 20000, pricePer1000Xof: 4500, eta: "0-6h", refill: "Non" },
        ],
      },
      {
        key: "reactions",
        label: "Réactions",
        linkHint: "Lien du POST WhatsApp",
        tiers: [
          { key: "standard", label: "Emoji aléatoire", peakerrServiceId: 33599, min: 20, max: 20000, pricePer1000Xof: 2000, eta: "0-6h", refill: "Non" },
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
