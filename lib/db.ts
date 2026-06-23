import { PrismaClient } from "@prisma/client";

// Singleton do Prisma para nao abrir conexoes novas a cada hot-reload em dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
