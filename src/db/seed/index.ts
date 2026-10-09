/**
 * Fyller databasen med testdata for lokal utvikling.
 *
 *   npm run db:seed    legger til testdata som mangler (trygt å kjøre flere ganger)
 *   npm run db:reset   tømmer alle tabeller og legger testdataene inn på nytt
 */
import { loadEnvConfig } from "@next/env";
import { getTableName, is, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgTable } from "drizzle-orm/pg-core";
import { Pool } from "pg";

import * as schema from "../schema";
import { hashPassword } from "../../lib/auth/password";
import { testPlayers, TEST_PASSWORD } from "./players";

loadEnvConfig(process.cwd());

const reset = process.argv.includes("--reset");
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL mangler. Kopier .env.example til .env.");
  process.exit(1);
}

// Sperre mot å tømme eller fylle en ekte database ved et uhell.
const host = new URL(url).hostname;
const isLocal = ["localhost", "127.0.0.1", "::1", "db"].includes(host);
if (process.env.NODE_ENV === "production" || (!isLocal && !process.argv.includes("--force"))) {
  console.error(
    `Avbryter: DATABASE_URL peker på «${host}», som ikke ser ut som en lokal database.\n` +
      "Legg til --force hvis du virkelig vil seede denne databasen.",
  );
  process.exit(1);
}

// Alle tabeller i datamodellen. Nye tabeller blir automatisk med i nullstillingen.
const allTables = Object.values(schema).filter((value) => is(value, PgTable));

async function main(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    await db.transaction(async (tx) => {
      if (reset) {
        const names = allTables.map((t) => `"${getTableName(t)}"`).join(", ");
        await tx.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
        console.log(`Tømte ${allTables.length} tabeller.`);
      }

      const passwordHash = await hashPassword(TEST_PASSWORD);
      const inserted = await tx
        .insert(schema.players)
        .values(testPlayers.map((p) => ({ ...p, passwordHash })))
        .onConflictDoNothing({ target: schema.players.email })
        .returning({ id: schema.players.id });
      console.log(`La til ${inserted.length} av ${testPlayers.length} testspillere (passord: ${TEST_PASSWORD}).`);
    });
  } finally {
    await pool.end();
  }
}

main(url).catch((err) => {
  console.error("Seeding feilet:", err);
  process.exitCode = 1;
});
