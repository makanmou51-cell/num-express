import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton Prisma — évite d'ouvrir trop de connexions en dev (hot reload).
// Prisma 7 (client « Rust-free ») requiert un driver adapter.
// PostgreSQL via @prisma/adapter-pg — compatible serverless (Vercel + Neon).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma(): PrismaClient {
  // On ne jette PAS ici si DATABASE_URL est absente : la connexion est paresseuse
  // (au 1er query). Ainsi les pages sans accès DB (ex. accueil) restent servies.
  const raw = process.env.DATABASE_URL ?? "";
  let connectionString = raw;
  try {
    // On retire sslmode/channel_binding de l'URL (gérés via l'option ssl ci-dessous)
    // pour éviter l'avertissement de dépréciation de pg-connection-string.
    const u = new URL(raw);
    if (u.searchParams.has("sslmode") || u.searchParams.has("channel_binding")) {
      u.searchParams.delete("sslmode");
      u.searchParams.delete("channel_binding");
      connectionString = u.toString();
    }
  } catch {
    /* URL non parsable : on garde la valeur d'origine */
  }

  const adapter = new PrismaPg({
    connectionString,
    // SSL vérifié (Neon a des certificats valides) — sécurité conservée.
    ssl: raw ? { rejectUnauthorized: true } : undefined,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
