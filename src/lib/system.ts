import { Pool } from "pg";

const SYSTEM_ID = "global";

let pool: Pool | null = null;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_MISSING");
  pool = new Pool({ connectionString });
  return pool;
}

export async function getSystemState() {
  const p = getPool();
  const r = await p.query(
    `INSERT INTO "SystemState" ("id","blockHeight","createdAt","updatedAt")
     VALUES ($1, 0, NOW(), NOW())
     ON CONFLICT ("id") DO UPDATE SET "updatedAt" = NOW()
     RETURNING "id","blockHeight","updatedAt"`,
    [SYSTEM_ID],
  );
  return r.rows[0] as { id: string; blockHeight: number; updatedAt: Date };
}

export async function resetSystemState() {
  const p = getPool();
  const r = await p.query(
    `INSERT INTO "SystemState" ("id","blockHeight","createdAt","updatedAt")
     VALUES ($1, 0, NOW(), NOW())
     ON CONFLICT ("id") DO UPDATE SET "blockHeight" = 0, "updatedAt" = NOW()
     RETURNING "id","blockHeight","updatedAt"`,
    [SYSTEM_ID],
  );
  return r.rows[0] as { id: string; blockHeight: number; updatedAt: Date };
}

