import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import crypto from "node:crypto";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_MISSING");

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool, {
    statementNameGenerator: (q) => {
      const text = typeof q.sql === "string" ? q.sql : "";
      const paramsLen = Array.isArray(q.args) ? q.args.length : 0;
      const h = crypto.createHash("sha256").update(`${text}::${paramsLen}`).digest("hex").slice(0, 16);
      return `p_${h}`;
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

