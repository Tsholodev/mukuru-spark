import { readFileSync } from "fs";
import path from "path";
import { Pool, type PoolClient } from "pg";
type DbGlobal = typeof globalThis & { __sendaPool?: Pool; __sendaReady?: Promise<void> };
const dbGlobal = globalThis as DbGlobal;

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required; Senda does not use an in-memory runtime database.");
  if (!dbGlobal.__sendaPool) {
    dbGlobal.__sendaPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return dbGlobal.__sendaPool;
}

export function withDb<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return readyDb().then(async () => {
    const client = await getPool().connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  });
}

export function readyDb() {
  if (!dbGlobal.__sendaReady) {
    const initialization = migrate();
    dbGlobal.__sendaReady = initialization;
    void initialization.catch(() => {
      if (dbGlobal.__sendaReady === initialization) dbGlobal.__sendaReady = undefined;
    });
  }
  return dbGlobal.__sendaReady;
}

async function migrate() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const schema = readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf8");
    await client.query(schema);
  } finally {
    client.release();
  }
}
