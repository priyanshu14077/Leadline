import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Hard cap per process. Postgres in Docker allows 100; dev hot reloads must not leak pools.
    max: 5,
  });
  return new PrismaClient({ adapter });
}

// Test workers and watch-mode reloads re-import modules; reuse one client per process.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
