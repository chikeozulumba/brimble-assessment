import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = postgres(process.env.DATABASE_URL!, { max: 1 });

// Run Drizzle journal migrations (0000, 0001, ...)
await migrate(drizzle(client), { migrationsFolder: join(__dirname, '../../drizzle') });

// Idempotent raw DDL — guarantees the file-based log schema is applied even if the
// journal entry was skipped (e.g. stale image cache or migrator hash mismatch).
await client`ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "log_path" text`;
await client`DROP TABLE IF EXISTS "deployment_logs"`;

await client.end();
console.log('migrations applied');
