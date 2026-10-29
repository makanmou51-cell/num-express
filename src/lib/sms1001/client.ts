import "server-only";
import { env } from "@/lib/env";

/**
 * Client 1001SMS — API REST revendeur (https://www.1001sms.com/api/v1).
 *
 * ── Ce qui change par rapport aux fournisseurs précédents ───────────────
 * Grizzly et HeroSMS parlent le protocole sms-activate (`handler_api.php`,
 * réponses en texte brut « ACCESS_NUMBER:123:+33… »). AccKit a son propre
 * JSON. 1001SMS est une vraie API REST :
 *
 *   - authentification `Authorization: Bearer <clé>` ;
 *   - toute réponse est enveloppée : {success:true, data} ou
 *     {success:false, error:"…"} ;
 *   - un SEUL appel `/informative/pricing?service=whatsapp` rend les 79 pays
 *     avec prix, stock et opérateurs. AccKit en demandait 194, soit 23 s de
 *     reconstruction du catalogue ; ici c'est une requête.
 *
 * ── Le trou dans leur documentation, et comment on s'en protège ─────────
 * Leur spec OpenAPI décrit précisément les requêtes, mais laisse le corps des
 * réponses de commande à `data: {}` — littéralement « un objet ». Aucune
 * indication du nom des champs (`id` ? `orderId` ? `phone` ? `number` ?), ni
 * des valeurs de statut.
 *
 * Deviner UN jeu de noms et s'y tenir, c'est risquer qu'un achat réel parte
 * en erreur alors que le numéro a été acheté et facturé. On fait donc deux
 * choses : `normaliserOrdre` accepte toutes les graphies plausibles, et le
 * tout PREMIER corps de commande reçu est journalisé en entier. La forme
 * réelle sera donc visible dès la première vente, sans l'avoir payée d'un
 * échec.
 *
 * ── Règle d'or, héritée d'AccKit ────────────────────────────────────────
 * `/activations/order` n'a pas de clé d'idempotence. En cas de timeout ou
 * d'erreur réseau, on NE RENVOIE JAMAIS la requête : la commande a pu être
 * créée et débitée. On préfère perdre une vente que payer deux numéros.
 */

export type Sms1001Code =
  | "NO_KEY"
  | "API"
  | "PARSE"
  | "TIMEOUT"
  | "NETWORK"
  | "NO_STOCK"
  | "NO_FUNDS"
  | "RATE_LIMIT";

export class Sms1001Error extends Error {
  code: Sms1001Code;
  constructor(code: Sms1001Code, message: string) {
    super(message);
    this.name = "Sms1001Error";
    this.code = code;
  }
}

function cle(): string {
  const k = env.sms1001.apiKey;
  if (!k) {
    throw new Sms1001Error(
      "NO_KEY",
      "SMS1001_API_KEY manquante. Renseigne ta clé 1001SMS dans les variables d'environnement.",
    );
  }
  return k;
}

/**
 * Classe un message d'erreur métier. Leur API répond `{success:false, error}`
 * avec un texte libre : c'est tout ce qu'on a pour distinguer « plus de
 * stock » (le client doit changer de pays) de « notre compte est vide » (le
 * client n'y peut rien et il faut nous alerter).
 */
function classer(message: string): Sms1001Code {
  const m = message.toLowerCase();
  if (/insufficient|balance|fund|deposit|top ?up|credit/.test(m)) {
    return "NO_FUNDS";
  }
  if (/no number|out of stock|sold out|unavailable|not available|no_numbers/.test(m)) {
    return "NO_STOCK";
  }
  return "API";
}

/**
 * Limite de débit, mesurée le 29 octobre : TRENTE requêtes, puis HTTP 429
 * « Too many requests » avec `Retry-After: 5`. Le seau se remplit ensuite.
 *
 * C'est ce qui a condamné l'idée d'un catalogue construit pays par pays :
 * 86 appels, même par lots de 20, n'en faisaient passer que 30 — les 56
 * autres revenaient en 429 et le catalogue n'affichait que les pays dont le
 * nom commence par A, B ou C. Un échec silencieux et parfaitement trompeur.
 *
 * Les lectures sont rejouées en respectant leur `Retry-After`. Les ÉCRITURES,
 * jamais : une commande a pu aboutir malgré le 429.
 */
const RETRY_MAX = 2;

const dors = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function appel(
  chemin: string,
  options: {
    methode?: "GET" | "POST" | "PUT";
    corps?: unknown;
    timeoutMs?: number;
    essai?: number;
  } = {},
): Promise<unknown> {
  const { methode = "GET", corps, timeoutMs = 30_000, essai = 0 } = options;
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${env.sms1001.baseUrl}${chemin}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${cle()}`,
        Accept: "application/json",
        ...(corps === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      cache: "no-store",
      signal: ctrl.signal,
    });
  } catch (e) {
    const abandon = (e as Error).name === "AbortError";
    throw new Sms1001Error(
      abandon ? "TIMEOUT" : "NETWORK",
      abandon
        ? "1001SMS n'a pas répondu à temps."
        : `Erreur réseau vers 1001SMS : ${(e as Error).message}`,
    );
  } finally {
    clearTimeout(minuteur);
  }

  /* 429 : on respecte leur `Retry-After` et on rejoue — mais seulement une
     LECTURE. Rejouer une commande, c'est risquer de payer deux numéros. */
  if (res.status === 429) {
    const attente = Number(res.headers.get("retry-after")) || 5;
    if (methode === "GET" && essai < RETRY_MAX) {
      await dors(Math.min(attente, 8) * 1000);
      return appel(chemin, { ...options, essai: essai + 1 });
    }
    throw new Sms1001Error(
      "RATE_LIMIT",
      `1001SMS limite le débit (30 requêtes par fenêtre). Réessayer dans ${attente} s.`,
    );
  }

  const texte = (await res.text()).trim();

  /* Le corps porte le vrai message d'erreur même sur un 4xx : on le parse
     AVANT de regarder le statut HTTP, sinon on perd « insufficient balance »
     au profit d'un « HTTP 402 » qui ne dit rien à personne. */
  let json: unknown;
  try {
    json = JSON.parse(texte);
  } catch {
    /* Page HTML : leur routeur Next.js rend une page d'erreur quand le chemin
       n'existe pas. Mesuré : /api/v1/balance (chemin inexistant) renvoie du
       HTML, pas du JSON. */
    throw new Sms1001Error(
      "PARSE",
      res.ok
        ? `Réponse 1001SMS illisible : ${texte.slice(0, 120)}`
        : `1001SMS HTTP ${res.status}`,
    );
  }

  const enveloppe = json as { success?: boolean; error?: string; data?: unknown };
  if (enveloppe.success === false || !res.ok) {
    const msg = enveloppe.error || `1001SMS HTTP ${res.status}`;
    throw new Sms1001Error(classer(msg), msg);
  }
  return enveloppe.data;
}

// ── Consultation (scope lecture) ──────────────────────────────────────────

export interface Sms1001Balance {
  balance: number; // USD
  username?: string;
  email?: string;
}

export function solde(): Promise<Sms1001Balance> {
  return appel("/informative/balance") as Promise<Sms1001Balance>;
}

export interface Sms1001Pays {
  name: string;
  code: string; // ISO alpha-2, ex "pt"
  slug: string; // ex "portugal"
  phoneCode?: string;
  continent?: string;
}

export function pays(): Promise<Sms1001Pays[]> {
  return appel("/informative/countries") as Promise<Sms1001Pays[]>;
}

export interface Sms1001Operateur {
  operator: string; // ex "Charlie", ou "default"
  price: number; // USD
  count: number; // numéros disponibles
  /** Voir `tauxMesure` : 0 et 30 ne sont PAS des mesures. */
  deliverability: number;
  provider: "NEW" | "MAIN" | "EXTRA" | "EXTRA 2" | string;
}

export interface Sms1001LignePays {
  country: string; // nom anglais
  countryCode: string; // ISO alpha-2
  countrySlug: string;
  operators: Sms1001Operateur[];
}

/**
 * Prix d'un service dans TOUS les pays, en un appel.
 *
 * Leur spec marque `country` obligatoire, mais la mesure dit le contraire :
 * `?service=whatsapp` seul renvoie les 79 pays. C'est ce qui rend le
 * catalogue tenable (un appel au lieu des 194 d'AccKit). On passe donc le
 * service seul, et le filtre par pays se fait chez nous.
 */
export async function tarifs(serviceSlug: string): Promise<Sms1001LignePays[]> {
  const d = (await appel(
    `/informative/pricing?service=${encodeURIComponent(serviceSlug)}`,
    { timeoutMs: 45_000 },
  )) as { countries?: Sms1001LignePays[] };
  return d?.countries ?? [];
}

/**
 * Lignes opérateur d'UN pays — la vue détaillée.
 *
 * À ne pas confondre avec `tarifs()` : la vue d'ensemble est un résumé qui
 * masque des lignes et surévalue les prix (voir le commentaire en tête de
 * `catalog.ts`). C'est CELLE-CI qui fait foi pour acheter.
 */
export async function detailPays(
  country: string,
  serviceSlug: string,
): Promise<Sms1001Operateur[]> {
  const d = (await appel(
    `/informative/pricing?country=${encodeURIComponent(country)}&service=${encodeURIComponent(serviceSlug)}`,
  )) as { operators?: Sms1001Operateur[] };
  return d?.operators ?? [];
}

/**
 * Le taux de réussite annoncé, UNIQUEMENT quand c'en est un.
 *
 * Mesure du 29 octobre sur WhatsApp, 158 lignes opérateur :
 *
 *     deliverability = 0   →  102 lignes
 *     deliverability = 30  →   53 lignes
 *     31 / 33 / 58         →    3 lignes
 *
 * Autrement dit « 30 » est une valeur par défaut estampillée sur le pool
 * MAIN, et « 0 » veut dire « jamais mesuré ». Trois lignes sur 158 portent
 * un vrai chiffre. S'en servir pour classer les pays reviendrait à peindre
 * un badge « Fiable » sur des pays que personne n'a testés — exactement
 * l'erreur qui a coûté 678 ventes à 8 % chez HeroSMS, et qui a imposé
 * d'écrire `mesures-maison.ts`.
 */
export function tauxMesure(o: Sms1001Operateur): number | undefined {
  const d = o.deliverability;
  if (!Number.isFinite(d) || d <= 0 || d === 30) return undefined;
  return d;
}

// ── Commandes (scope `activate`) ──────────────────────────────────────────

export interface Sms1001Ordre {
  id: string;
  phone: string | null;
  /** Statut brut du fournisseur, tel quel — leur vocabulaire n'est pas documenté. */
  statut: string;
  code: string | null;
  texte: string | null;
  expireLe: Date | null;
}

/** Première commande vue : on journalise le corps entier une seule fois. */
let formeJournalisee = false;

function premier(o: Record<string, unknown>, noms: string[]): unknown {
  for (const n of noms) {
    const v = o[n];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/**
 * Transforme le corps d'une commande en objet exploitable.
 *
 * Leur spec dit `data: {}` sans décrire un seul champ. On accepte donc toutes
 * les graphies plausibles plutôt que de parier sur une seule : un mauvais
 * pari ferait échouer un achat DÉJÀ facturé, et le numéro serait perdu pour
 * le client comme pour nous.
 *
 * Le code est cherché dans le champ direct ET dans la liste de messages, que
 * leur documentation mentionne (« Full order details with every stored
 * message ») sans en donner la forme.
 */
export function normaliserOrdre(brut: unknown): Sms1001Ordre {
  if (!brut || typeof brut !== "object") {
    throw new Sms1001Error("PARSE", "1001SMS n'a pas renvoyé de commande.");
  }
  const o = (("order" in (brut as object) ? (brut as { order: unknown }).order : brut) ??
    brut) as Record<string, unknown>;

  if (!formeJournalisee) {
    formeJournalisee = true;
    /* Leur spec ne décrit pas ce corps. Cette ligne, une fois par instance,
       rend la forme réelle visible dans les journaux Vercel dès la première
       vente — au lieu de la découvrir sur une réclamation client. */
    console.log("[1001sms] forme d'une commande :", JSON.stringify(o).slice(0, 800));
  }

  const id = premier(o, ["id", "orderId", "order_id", "reference", "uuid"]);
  if (id === undefined) {
    throw new Sms1001Error(
      "PARSE",
      `1001SMS n'a pas renvoyé d'identifiant de commande : ${JSON.stringify(o).slice(0, 200)}`,
    );
  }

  const tel = premier(o, ["phone", "number", "phoneNumber", "phone_number", "msisdn"]);
  const statut = String(premier(o, ["status", "state"]) ?? "").toUpperCase();

  let code = premier(o, ["code", "smsCode", "sms_code", "otp"]);
  let texte = premier(o, ["text", "message", "smsText", "sms_text", "fullText"]);
  const messages = premier(o, ["messages", "sms", "smsList"]);
  if (Array.isArray(messages)) {
    for (const m of messages) {
      if (!m || typeof m !== "object") continue;
      const mo = m as Record<string, unknown>;
      code ??= premier(mo, ["code", "smsCode", "sms_code", "otp"]);
      texte ??= premier(mo, ["text", "message", "body", "fullText"]);
    }
  }

  return {
    id: String(id),
    phone: tel === undefined ? null : String(tel),
    statut,
    code: code === undefined ? null : String(code).trim() || null,
    texte: texte === undefined ? null : String(texte),
    expireLe: lireDate(
      premier(o, ["expiresAt", "expires_at", "expiresAtIso", "expiry", "expiresTs", "expires_ts"]),
    ),
  };
}

function lireDate(v: unknown): Date | null {
  if (v === undefined || v === null) return null;
  /* Horodatage unix (secondes ou millisecondes) ou chaîne ISO : les deux
     existent dans la nature et leur spec n'en documente aucun. */
  if (typeof v === "number" || /^\d+$/.test(String(v))) {
    const n = Number(v);
    const ms = n > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Un code a-t-il été reçu ?
 *
 * On se fie à la PRÉSENCE DU CODE, pas au mot de statut : leur vocabulaire
 * n'est documenté nulle part (`RECEIVED` ? `COMPLETED` ? `SUCCESS` ?), alors
 * qu'un code présent est un fait vérifiable. Le statut ne sert qu'aux états
 * d'échec, pour lesquels il n'existe aucune autre trace.
 */
export function codeRecu(o: Sms1001Ordre): boolean {
  return Boolean(o.code);
}

/** Commande close sans code : le fournisseur a remboursé de son côté. */
export function echecTerminal(o: Sms1001Ordre): boolean {
  return !o.code && /CANCEL|EXPIR|REFUND|FAIL|TIMEOUT/.test(o.statut);
}

/**
 * Achète un numéro. `provider` est OBLIGATOIRE côté 1001SMS (EXTRA, MAIN,
 * EXTRA 2 ou NEW) ; `operator` affine le pool quand on le connaît.
 *
 * Timeout 50 s pour rester sous la coupe Vercel (60 s). Aucun retry : voir la
 * règle d'or en tête de fichier.
 */
export async function commander(
  country: string,
  serviceSlug: string,
  provider: string,
  operator?: string,
): Promise<Sms1001Ordre> {
  const data = await appel("/activations/order", {
    methode: "POST",
    corps: {
      country,
      service: serviceSlug,
      provider,
      purchaseType: "activation",
      ...(operator && operator !== "default" ? { operator } : {}),
    },
    timeoutMs: 50_000,
  });
  return normaliserOrdre(data);
}

/** Demande les nouveaux SMS au fournisseur et renvoie l'état courant. */
export async function verifier(orderId: string): Promise<Sms1001Ordre> {
  const data = await appel("/activations/check", {
    methode: "POST",
    corps: { orderId },
  });
  return normaliserOrdre(data);
}

/** Détail complet d'une commande, messages compris. */
export async function lireOrdre(orderId: string): Promise<Sms1001Ordre> {
  const data = await appel(`/activations/${encodeURIComponent(orderId)}`);
  return normaliserOrdre(data);
}

/**
 * Annule une commande. Remboursement intégral seulement si aucun SMS n'est
 * arrivé. Leur documentation prévient que certains fournisseurs refusent une
 * annulation dans les deux premières minutes — et qu'une commande expirée est
 * de toute façon remboursée automatiquement dix minutes plus tard.
 */
export async function annuler(orderId: string): Promise<void> {
  await appel("/activations/cancel", { methode: "POST", corps: { orderId } });
}

// ── Webhooks ──────────────────────────────────────────────────────────────

export interface Sms1001ConfigWebhook {
  url: string | null;
  events: string[];
  secretHint: string | null;
  status: string; // "unset" | "active" | "disabled"
  failures: number;
  disabledAt: string | null;
  availableEvents?: string[];
}

export function configWebhook(): Promise<Sms1001ConfigWebhook> {
  return appel("/webhooks/config") as Promise<Sms1001ConfigWebhook>;
}

/**
 * Enregistre l'URL et les événements. La PREMIÈRE écriture renvoie le secret
 * de signature — UNE SEULE FOIS. Il faut le ranger dans
 * SMS1001_WEBHOOK_SECRET immédiatement : pour le revoir il faudra le faire
 * tourner (`/webhooks/config/rotate-secret`), ce qui invalide l'ancien.
 *
 * Enregistrer une URL remet aussi à zéro le compteur d'échecs et réactive un
 * webhook désactivé — 1001SMS coupe après 20 échecs consécutifs.
 */
export async function reglerWebhook(
  url: string | null,
  events: string[],
): Promise<{ secret?: string } & Sms1001ConfigWebhook> {
  const d = await appel("/webhooks/config", {
    methode: "PUT",
    corps: { url, events },
  });
  return d as { secret?: string } & Sms1001ConfigWebhook;
}

export function testerWebhook(): Promise<unknown> {
  return appel("/webhooks/test", { methode: "POST", corps: {} });
}

export function livraisonsWebhook(): Promise<unknown> {
  return appel("/webhooks/deliveries");
}
