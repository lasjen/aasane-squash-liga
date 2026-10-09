/**
 * Gir eller fjerner admin-tilgang for en registrert spiller.
 *
 *   npm run admin -- ola@klubben.no           gir admin-tilgang
 *   npm run admin -- ola@klubben.no --fjern   fjerner admin-tilgang og logger ut av /admin
 *
 * Spilleren logger inn på /admin/logg-inn med samme e-post og passord som ellers.
 */
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../src/db/schema";

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const remove = args.includes("--fjern");
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();

if (!email) {
  console.error("Bruk: npm run admin -- <e-post> [--fjern]");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL mangler.");
  process.exit(1);
}

async function main(databaseUrl: string, email: string) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    await db.transaction(async (tx) => {
      const [player] = await tx
        .update(schema.players)
        .set({ isAdmin: !remove })
        .where(eq(schema.players.email, email))
        .returning({
          id: schema.players.id,
          firstName: schema.players.firstName,
          lastName: schema.players.lastName,
          hasPassword: schema.players.passwordHash,
        });

      if (!player) {
        console.error(`Fant ingen spiller med e-post ${email}. Spilleren må registrere seg først.`);
        process.exitCode = 1;
        return;
      }

      const name = `${player.firstName} ${player.lastName}`;
      if (remove) {
        await tx.delete(schema.adminSessions).where(eq(schema.adminSessions.playerId, player.id));
        console.log(`${name} (${email}) er ikke lenger admin, og er logget ut av /admin.`);
      } else {
        console.log(`${name} (${email}) er nå admin og kan logge inn på /admin/logg-inn.`);
        if (!player.hasPassword) {
          console.log("Merk: spilleren har ikke passord ennå, så innlogging virker ikke før det er satt.");
        }
      }
    });
  } finally {
    await pool.end();
  }
}

main(url, email).catch((err) => {
  console.error("Kunne ikke endre admin-tilgang:", err);
  process.exitCode = 1;
});
