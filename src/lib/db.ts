import { PrismaClient } from "@/generated/prisma";

// Next.js hot-reloads modules in development, which would otherwise open a new
// pool of SQLite connections on every edit until the process runs out.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
