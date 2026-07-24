// Accès centralisé et typé aux variables d'environnement.
// On ne jette pas au chargement du module pour ne pas casser le build ;
// chaque service vérifie ce dont il a besoin au moment de l'appel.

function str(key: string, fallback?: string): string {
  // .trim() : évite qu'un espace/retour-ligne parasite (copié-collé, pipe CLI)
  // ne casse une URL ou une clé.
  const v = process.env[key]?.trim();
  if (v === undefined || v === "") {
    return fallback ?? "";
  }
  return v;
}

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function list(key: string): string[] {
  return str(key)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const env = {
  // ── Application ──
  appUrl: str("APP_URL", "http://localhost:3000"),
  authSecret: str("AUTH_SECRET"),
  // E-mails promus automatiquement administrateurs (à la connexion/inscription).
  adminEmails: list("ADMIN_EMAILS"),
  // Exiger la vérification de l'e-mail avant d'acheter.
  requireEmailVerification: bool("REQUIRE_EMAIL_VERIFICATION", false),
  // Secret protégeant les routes cron.
  cronSecret: str("CRON_SECRET"),

  // ── Grizzly SMS ──
  grizzly: {
    apiKey: str("GRIZZLY_API_KEY"),
    baseUrl: str("GRIZZLY_BASE_URL", "https://api.grizzlysms.com/stubs/handler_api.php"),
    // Devise dans laquelle Grizzly facture le compte (pour la conversion en F CFA).
    currency: str("GRIZZLY_CURRENCY", "USD"),
    // Force le mode démo (données simulées) même si une clé est présente.
    mock: bool("GRIZZLY_MOCK", false),
  },

  // ── OnlineSim (fournisseur alternatif, en évaluation) ──
  onlinesim: {
    apiKey: str("ONLINESIM_API_KEY"),
  },

  // ── Tarification : bénéfice fixe par tranche de coût ──
  pricing: {
    // Taux de conversion devise fournisseur -> F CFA (coût converti).
    fxToXof: num("FX_TO_XOF", 620),
    // Tranche 1 : coût < tier1MaxXof -> +tier1ProfitXof.
    tier1MaxXof: num("TIER1_MAX_XOF", 1000),
    tier1ProfitXof: num("TIER1_PROFIT_XOF", 2500),
    // Tranche 2 : tier1MaxXof <= coût <= tier2MaxXof -> +tier2ProfitXof.
    tier2MaxXof: num("TIER2_MAX_XOF", 7000),
    tier2ProfitXof: num("TIER2_PROFIT_XOF", 2500),
    // Tranche 3 : coût > tier2MaxXof -> +tier3ProfitXof.
    tier3ProfitXof: num("TIER3_PROFIT_XOF", 2500),
    // Arrondi du prix public au multiple supérieur (F CFA).
    roundToXof: num("PRICE_ROUND_XOF", 5),
    // Prix public minimum (F CFA).
    minPriceXof: num("MIN_PRICE_XOF", 300),
    // Micro-variation déterministe par pays (F CFA) : évite que des pays au
    // coût de gros identique affichent exactement le même prix. 0 = désactivé.
    jitterMaxXof: num("PRICE_JITTER_XOF", 300),
    // Palier de prix visé chez Grizzly (getPricesV3) : 0 = le moins cher,
    // 1 = le plus cher. Les fournisseurs premium délivrent le code beaucoup
    // plus vite ; le client étant facturé sur le palier choisi, la marge est
    // préservée. 1 par défaut = fiabilité maximale.
    tierLevel: num("PRICE_TIER_LEVEL", 1),
    // Petite tolérance au-dessus du palier visé (dérive de prix entre
    // l'affichage et l'achat). Le palier fait déjà plafond : 5 % suffit.
    maxPriceBuffer: num("MAX_PRICE_BUFFER", 0.05),
    // Stock minimum pour qu'un pays soit proposé (fiabilité).
    minStockCount: num("MIN_STOCK_COUNT", 500),
    // Stock minimum pour qu'un FOURNISSEUR soit ciblable. Bas (20) car sur
    // WhatsApp les fournisseurs FIABLES sont les chers, à petit stock (20-37) —
    // les gros lots bon marché ne délivrent pas. On les rend donc ciblables.
    minProviderStock: num("MIN_PROVIDER_STOCK", 20),
  },

  // ── Affiliation ──
  affiliate: {
    // Part de chaque achat d'un filleul reversée au parrain (0..1).
    commissionRate: num("AFFILIATE_COMMISSION_RATE", 0.1),
  },

  // ── E-mail ──
  mail: {
    provider: str("MAIL_PROVIDER", "log"), // log | resend
    from: str("MAIL_FROM", "num express <no-reply@num-express.local>"),
    resendApiKey: str("RESEND_API_KEY"),
  },

  // ── Paiement ──
  payment: {
    provider: str("PAYMENT_PROVIDER", "manual"), // moneyfusion | leekpay | fedapay | manual
    moneyfusion: {
      // URL de l'API de paiement du marchand (tableau de bord MoneyFusion).
      apiUrl: str("MONEYFUSION_API_URL"),
      // Base de vérification du statut par token.
      statusUrl: str(
        "MONEYFUSION_STATUS_URL",
        "https://www.pay.moneyfusion.net/paiementNotif",
      ),
    },
    leekpay: {
      secretKey: str("LEEKPAY_SECRET_KEY"),
      publicKey: str("LEEKPAY_PUBLIC_KEY"),
      // Secret DÉDIÉ pour vérifier la signature du webhook (jamais la clé publique).
      webhookSecret: str("LEEKPAY_WEBHOOK_SECRET"),
      baseUrl: str("LEEKPAY_BASE_URL", "https://leekpay.fr"),
      currency: str("LEEKPAY_CURRENCY", "XOF"),
    },
    fedapay: {
      secretKey: str("FEDAPAY_SECRET_KEY"),
      environment: str("FEDAPAY_ENVIRONMENT", "sandbox"), // sandbox | live
      webhookSecret: str("FEDAPAY_WEBHOOK_SECRET"),
      currency: str("FEDAPAY_CURRENCY", "XOF"),
    },
  },
};

export function requireGrizzlyKey(): string {
  if (!env.grizzly.apiKey) {
    throw new Error(
      "GRIZZLY_API_KEY manquant. Renseigne ta clé API Grizzly dans .env",
    );
  }
  return env.grizzly.apiKey;
}
