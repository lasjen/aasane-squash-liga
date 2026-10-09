// Kjører alle nye migrasjoner i ./drizzle mot DATABASE_URL.
// Bruker bare produksjonsavhengigheter, så det kan kjøres i deploy-steget.
import nextEnv from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL mangler.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Migrasjoner er kjørt.");
} catch (err) {
  console.error("Migrering feilet:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
