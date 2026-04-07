import { Pool } from "pg";

// Singleton pool — survives Next.js hot-reload in dev
const globalForPg = globalThis as unknown as { _pgPool?: Pool };

export function getPool(): Pool {
    if (!globalForPg._pgPool) {
        globalForPg._pgPool = new Pool({
            host: process.env.MEMORY_DB_HOST ?? "localhost",
            port: parseInt(process.env.MEMORY_DB_PORT ?? "5432"),
            user: process.env.MEMORY_DB_USER ?? "n8n",
            password: process.env.MEMORY_DB_PASSWORD ?? "admin",
            database: process.env.MEMORY_DB_NAME ?? "n8n",
            max: 5,
            idleTimeoutMillis: 30_000,
        });
    }
    return globalForPg._pgPool;
}

export async function initMemoryTables(): Promise<void> {
    const db = getPool();
    await db.query(`
        CREATE TABLE IF NOT EXISTS user_memory (
            user_id     VARCHAR(255) PRIMARY KEY,
            summary     TEXT        NOT NULL DEFAULT '',
            facts       JSONB       NOT NULL DEFAULT '{}',
            updated_at  TIMESTAMP   NOT NULL DEFAULT NOW()
        )
    `);
}
