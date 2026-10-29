import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { payReferralCommission } from "@/lib/affiliate";
import { notifyCodeReceived } from "@/lib/activations";
import {
  codeRecu,
  echecTerminal,
  verifier as verifierOrdre,
} from "@/lib/sms1001/client";

export const runtime = "nodejs";

/**
 * Webhook 1001SMS — le code arrive, on le livre immédiatement.
 *
 * ── Pourquoi ça compte ──────────────────────────────────────────────────
 * AccKit n'a aucun webhook : la page d'attente doit interroger le fournisseur
 * en boucle, et si le client FERME la page — ce qu'on lui conseille de faire
 * pour aller sur WhatsApp — plus personne n'interroge. Son code peut donc
 * arriver sans que rien ne le lui dise.
 *
 * 1001SMS pousse l'événement `sms.received` dès réception. C'est le mécanisme
 * qu'on avait avec HeroSMS et qu'on a perdu à leur fermeture.
 *
 * ── Ce qui est mieux que chez HeroSMS ───────────────────────────────────
 * HeroSMS n'authentifiait rien : il fallait se rabattre sur une liste d'IP
 * qu'ils pouvaient changer sans prévenir, puis re-vérifier chaque code auprès
 * d'eux pour ne pas qu'un inconnu injecte un faux code dans le compte d'un
 * client. 1001SMS SIGNE chaque envoi :
 *
 *     X-1001SMS-Signature: t=<secondes unix>,v1=<HMAC-SHA256(secret, "<t>.<corps brut>")>
 *
 * Une signature valide prouve l'origine ET l'intégrité. Plus de liste d'IP,
 * plus d'aller-retour de vérification.
 *
 * ── Les deux pièges, et comment on les traite ───────────────────────────
 * 1. REJEU. Une signature reste valide pour toujours : sans contrôle de
 *    l'horodatage, un envoi capté aujourd'hui pourrait être rejoué demain.
 *    D'où la tolérance de cinq minutes, celle que leur documentation annonce.
 *
 * 2. FORME DU CORPS INCONNUE. Leur spec OpenAPI décrit l'enveloppe
 *    ({id, event, createdAt, data}) mais laisse `data` à « un objet », sans
 *    nommer un seul champ. On essaie donc d'y lire le code ; si on n'y arrive
 *    pas, on interroge `/activations/check`, qui fait autorité. Dans les deux
 *    cas le code est livré au moment où le SMS tombe — ce qui était le but.
 *
 * ── Si 20 envois échouent d'affilée, 1001SMS DÉSACTIVE le webhook ───────
 * On répond donc 200 à tout envoi authentique, même inexploitable. Un 4xx est
 * réservé aux cas où l'alerte est justement ce qu'on veut : signature absente,
 * invalide, ou secret non configuré chez nous.
 */

const CLE_SUCCES = "sms1001_webhook_dernier_succes";
const CLE_REFUS = "sms1001_webhook_dernier_refus";

/** Tolérance de rejeu, alignée sur celle qu'annonce 1001SMS. */
const TOLERANCE_S = 300;

async function tracer(cle: string, etat: string) {
  const value = `${new Date().toISOString()} · ${etat}`;
  await prisma.setting
    .upsert({
      where: { key: cle },
      create: { key: cle, value },
      update: { value },
    })
    .catch(() => {
      /* le témoin ne doit jamais faire échouer un webhook */
    });
}

/** `t=1730200000,v1=ab12…` -> { t, v1 }. Ordre des champs non garanti. */
function lireSignature(entete: string): { t: number; v1: string } | null {
  let t: number | null = null;
  let v1: string | null = null;
  for (const partie of entete.split(",")) {
    const [cle, val] = partie.split("=").map((s) => s?.trim());
    if (cle === "t" && val && /^\d+$/.test(val)) t = Number(val);
    if (cle === "v1" && val) v1 = val;
  }
  return t !== null && v1 ? { t, v1 } : null;
}

function signatureValide(t: number, v1: string, corpsBrut: string): boolean {
  const secret = env.sms1001.webhookSecret;
  if (!secret) return false;
  const attendu = createHmac("sha256", secret)
    .update(`${t}.${corpsBrut}`)
    .digest("hex");
  /* Comparaison à temps constant : une comparaison naïve fuit, octet par
     octet, de quoi reconstruire une signature valide par essais successifs. */
  const a = Buffer.from(attendu, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cherche la première valeur non vide parmi plusieurs noms possibles. */
function premier(o: Record<string, unknown>, noms: string[]): unknown {
  for (const n of noms) {
    const v = o[n];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

export async function POST(req: Request) {
  /* Le corps BRUT, avant tout parsage : la signature porte sur les octets
     exacts. Un JSON.parse suivi d'un JSON.stringify réordonnerait les clés et
     invaliderait une signature pourtant correcte. */
  const corpsBrut = await req.text();

  const entete =
    req.headers.get("x-1001sms-signature") ??
    req.headers.get("X-1001SMS-Signature") ??
    "";
  const sig = entete ? lireSignature(entete) : null;

  if (!env.sms1001.webhookSecret) {
    /* Pas de secret chez nous : on ne crédite RIEN sur parole. Mieux vaut un
       webhook désactivé qu'un faux code injecté dans le compte d'un client. */
    await tracer(CLE_REFUS, "SMS1001_WEBHOOK_SECRET absent — envoi refusé");
    return NextResponse.json({ error: "Secret non configuré" }, { status: 503 });
  }

  if (!sig) {
    await tracer(CLE_REFUS, "signature absente ou illisible");
    return NextResponse.json({ error: "Signature absente" }, { status: 401 });
  }

  const ecart = Math.abs(Math.floor(Date.now() / 1000) - sig.t);
  if (ecart > TOLERANCE_S) {
    await tracer(CLE_REFUS, `horodatage hors tolérance (${ecart} s)`);
    return NextResponse.json({ error: "Horodatage expiré" }, { status: 401 });
  }

  if (!signatureValide(sig.t, sig.v1, corpsBrut)) {
    await tracer(CLE_REFUS, "signature invalide — secret erroné ?");
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  /* À partir d'ici l'envoi est AUTHENTIQUE. On répond 200 quoi qu'il arrive,
     pour ne pas déclencher leur désactivation après 20 échecs. */

  let enveloppe: { event?: string; data?: unknown };
  try {
    enveloppe = JSON.parse(corpsBrut);
  } catch {
    await tracer(CLE_SUCCES, "corps illisible (signature pourtant valide)");
    return NextResponse.json({ ok: true, ignored: "json" });
  }

  const evenement = String(enveloppe.event ?? "");

  /* `ping` vient de /webhooks/test : c'est la preuve que le branchement
     fonctionne de bout en bout, secret compris. */
  if (evenement === "ping") {
    await tracer(CLE_SUCCES, "ping reçu — signature vérifiée, branchement OK");
    return NextResponse.json({ ok: true, pong: true });
  }

  if (evenement && evenement !== "sms.received") {
    await tracer(CLE_SUCCES, `événement ignoré : ${evenement}`);
    return NextResponse.json({ ok: true, ignored: evenement });
  }

  const data = (enveloppe.data ?? {}) as Record<string, unknown>;
  const ordreId = premier(data, [
    "orderId",
    "order_id",
    "id",
    "activationId",
    "reference",
  ]);
  if (ordreId === undefined) {
    /* Forme inattendue : on la journalise ENTIÈREMENT. C'est le seul moyen de
       corriger `premier()` sans attendre qu'un client se plaigne. */
    console.warn(
      "[1001sms] webhook sans identifiant de commande :",
      corpsBrut.slice(0, 600),
    );
    await tracer(CLE_SUCCES, "envoi sans identifiant de commande (voir journaux)");
    return NextResponse.json({ ok: true, ignored: "sans id" });
  }

  const activation = await prisma.activation.findUnique({
    where: { providerActivationId: String(ordreId) },
  });
  if (!activation) {
    await tracer(CLE_SUCCES, `commande ${ordreId} inconnue chez nous`);
    return NextResponse.json({ ok: true, ignored: "inconnue" });
  }

  /* Le code, d'abord depuis le corps signé — c'est le chemin rapide, et la
     signature en garantit déjà l'authenticité. Leur spec ne nommant aucun
     champ, on retombe sur /activations/check, qui fait autorité. */
  let code = String(premier(data, ["code", "smsCode", "sms_code", "otp"]) ?? "").trim();
  let texte = premier(data, ["text", "message", "body", "fullText"]);

  if (!code) {
    try {
      const ordre = await verifierOrdre(String(ordreId));
      if (codeRecu(ordre) && ordre.code) {
        code = ordre.code;
        texte ??= ordre.texte ?? undefined;
      } else if (echecTerminal(ordre)) {
        await tracer(CLE_SUCCES, `commande ${ordreId} close sans code`);
        return NextResponse.json({ ok: true, ignored: "sans code" });
      }
    } catch {
      /* Leur API ne répond pas : le sondage de la page prendra le relais. */
    }
  }

  if (!code) {
    await tracer(CLE_SUCCES, `SMS sans code exploitable · commande ${ordreId}`);
    return NextResponse.json({ ok: true, ignored: "sans code" });
  }

  /* Revendication atomique : le webhook et le sondage de la page arrivent
     SIMULTANÉMENT par conception. Sans cette condition dans le WHERE, les
     deux passeraient le test et verseraient chacun la commission de
     parrainage — le piège qui avait produit 169 250 F de doubles
     remboursements en octobre. */
  const claim = await prisma.activation.updateMany({
    where: { id: activation.id, status: "WAITING_CODE" },
    data: {
      status: "RECEIVED",
      smsCode: code,
      smsText: texte === undefined ? null : String(texte),
    },
  });
  if (claim.count === 0) {
    return NextResponse.json({ ok: true, ignored: "déjà traité" });
  }

  payReferralCommission(
    activation.userId,
    activation.id,
    activation.priceXof,
  ).catch(() => {});

  notifyCodeReceived(activation.userId, code, activation.id);
  await tracer(
    CLE_SUCCES,
    `CODE LIVRÉ — ${activation.serviceCode} · ${activation.countryName ?? activation.countryCode}`,
  );

  return NextResponse.json({ ok: true });
}
