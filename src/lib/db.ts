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

export async function initUserLoginsTable(): Promise<void> {
    const db = getPool();
    await db.query(`
        CREATE TABLE IF NOT EXISTS user_logins (
            id          SERIAL       PRIMARY KEY,
            email       VARCHAR(255) NOT NULL,
            login_date  DATE         NOT NULL DEFAULT CURRENT_DATE,
            login_at    TIMESTAMP    NOT NULL DEFAULT NOW()
        )
    `);
    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_user_logins_date ON user_logins (login_date)
    `);
    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_user_logins_email ON user_logins (email)
    `);
}

export async function recordUserLogin(email: string): Promise<void> {
    await initUserLoginsTable();
    const db = getPool();
    await db.query(
        "INSERT INTO user_logins (email) VALUES ($1)",
        [email]
    );
}
