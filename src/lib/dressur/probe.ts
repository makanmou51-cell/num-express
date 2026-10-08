/**
 * Sonde Dressur — LECTURE SEULE, à exécuter en local avant toute intégration.
 *
 *     npx tsx src/lib/dressur/probe.ts
 *
 * Elle ne passe AUCUNE commande et ne dépense rien. Elle répond aux trois
 * questions qui décident si Dressur vaut la peine d'être branché :
 *
 *   1. La clé fonctionne-t-elle, et quel est le solde ?
 *   2. Quels services, à quel prix — et la marge tient-elle face au catalogue
 *      public actuel (src/lib/boost/catalog.ts, prix de vente en F CFA) ?
 *   3. Quelles formules exigent des commentaires (`commentsRequired`) ? Le
 *      formulaire boost actuel n'en collecte pas : ces formules seraient
 *      invendables en l'état.
 *
 * Clé lue depuis .env : DRESSUR_API_KEY (commence par `drk_`).
 */
import { readFileSync } from "node:fs";
import { BOOST_CATALOG } from "@/lib/boost/catalog";

const BASE = "https://dressur.site/api/v1/developer";

function apiKey(): string {
  // On lit .env directement : ce script tourne hors du runtime Next.
  const env = readFileSync(".env", "utf8");
  const k = env
    .match(/^DRESSUR_API_KEY=(.*)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "");
  if (!k) {
    throw new Error(
      "DRESSUR_API_KEY absent de .env — ajoute la ligne DRESSUR_API_KEY=drk_…",
    );
  }
  return k;
}

async function call<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/json",
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${path} → HTTP ${res.status} : ${body.slice(0, 200)}`);
  }
  return JSON.parse(body) as T;
}

type CatalogService = {
  id: number;
  title: string;
  referenceQuantity: number;
  minimumQuantity: number;
  maximumQuantity?: number;
  price: number;
  currency: string;
  commentsRequired: boolean;
};

async function main() {
  console.log("=== 1. Solde ===");
  const bal = await call<{ error: boolean; soldeDressur?: number }>("/balance");
  console.log(JSON.stringify(bal), "\n");

  console.log("=== 2. Catalogue ===");
  const cat = await call<{ error: boolean; services: CatalogService[] }>(
    "/catalog",
  );
  const services = cat.services ?? [];
  console.log(`${services.length} formules\n`);

  console.log(
    "id".padStart(5),
    "titre".padEnd(38),
    "prix/1000".padStart(10),
    "min".padStart(7),
    "max".padStart(9),
    "comm.".padStart(6),
  );
  for (const s of services) {
    console.log(
      String(s.id).padStart(5),
      String(s.title).slice(0, 38).padEnd(38),
      `${s.price} ${s.currency}`.padStart(10),
      String(s.minimumQuantity).padStart(7),
      String(s.maximumQuantity ?? "—").padStart(9),
      (s.commentsRequired ? "OUI" : "-").padStart(6),
    );
  }

  console.log("\n=== 3. Formules exigeant des commentaires ===");
  const needComments = services.filter((s) => s.commentsRequired);
  console.log(
    needComments.length
      ? `${needComments.length} formules — INVENDABLES en l'état, le formulaire boost ne collecte pas de commentaires :\n  ` +
          needComments.map((s) => `${s.id} ${s.title}`).join("\n  ")
      : "aucune — le formulaire actuel suffit",
  );

  console.log("\n=== 4. Marge face à tes prix de vente actuels ===");
  console.log(
    "Ton prix public".padEnd(46),
    "coût Dressur".padStart(13),
    "marge".padStart(10),
  );
  for (const net of BOOST_CATALOG) {
    for (const svc of net.services) {
      for (const tier of svc.tiers) {
        // Rapprochement par libellé : approximatif, sert juste à repérer les
        // formules où la marge serait négative.
        const needle = `${net.label} ${svc.label}`.toLowerCase();
        const match = services.find((s) =>
          needle.split(" ").every((w) => s.title.toLowerCase().includes(w)),
        );
        const mine = `${net.label} · ${svc.label} (${tier.label})`;
        if (!match) {
          console.log(mine.slice(0, 46).padEnd(46), "—".padStart(13), "—".padStart(10));
          continue;
        }
        const marge = tier.pricePer1000Xof - match.price;
        console.log(
          mine.slice(0, 46).padEnd(46),
          `${match.price} F`.padStart(13),
          `${marge >= 0 ? "+" : ""}${marge} F`.padStart(10),
        );
      }
    }
  }
}

main().catch((e) => {
  console.error("\nÉCHEC :", (e as Error).message);
  process.exit(1);
});
