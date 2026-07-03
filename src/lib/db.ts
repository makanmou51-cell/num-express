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
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
