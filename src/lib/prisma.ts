import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

let stmtCounter = 0;

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_MISSING");

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool, {
    statementNameGenerator: (q) => {
      // Avoid statement name collisions across pooled connections by always generating a unique name.
      stmtCounter = (stmtCounter + 1) % 1_000_000_000;
      const paramsLen = Array.isArray(q.args) ? q.args.length : 0;
      return `p_${Date.now().toString(36)}_${stmtCounter.toString(36)}_${paramsLen}`;
    },
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma =
  globalThis.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

