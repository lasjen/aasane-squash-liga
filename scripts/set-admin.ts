/**
 * Gir en registrert spiller en rolle fra kommandolinjen. Brukes til å lage den første
 * admin-en; deretter kan admins endre roller i konsollen.
 *
 *   npm run admin -- ola@klubben.no              gir admin-rollen
 *   npm run admin -- ola@klubben.no --operator   gir operatør-rollen
 *   npm run admin -- ola@klubben.no --fjern      gjør spilleren til vanlig spiller igjen
 *
 * Operatører og admins logger inn på /admin/logg-inn med samme e-post og passord som ellers.
 */
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../src/db/schema";

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const role = args.includes("--fjern") ? "player" : args.includes("--operator") ? "operator" : "admin";
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();

const ROLE_TEXT = { player: "vanlig spiller", operator: "operatør", admin: "admin" } as const;

if (!email) {
  console.error("Bruk: npm run admin -- <e-post> [--operator | --fjern]");
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
        .set({ role })
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
      if (role === "player") {
        await tx.delete(schema.adminSessions).where(eq(schema.adminSessions.playerId, player.id));
        console.log(`${name} (${email}) er nå ${ROLE_TEXT[role]}, og er logget ut av konsollen.`);
      } else {
        console.log(`${name} (${email}) er nå ${ROLE_TEXT[role]} og kan logge inn på /admin/logg-inn.`);
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
  console.error("Kunne ikke endre rollen:", err);
  process.exitCode = 1;
});
