/**
 * Oppretter en administrator, eller lager nytt passord for en som finnes.
 *
 *   npm run admin:opprett -- ola@klubben.no "Ola Nordmann"
 *
 * Passordet genereres tilfeldig og skrives ut én gang. Eksisterende
 * admin-økter for brukeren logges ut.
 */
import { randomBytes } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";

loadEnvConfig(process.cwd());

const [rawEmail, ...nameParts] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();
const name = nameParts.join(" ").trim();

if (!email || !email.includes("@")) {
  console.error('Bruk: npm run admin:opprett -- <e-post> "<navn>"');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL mangler.");
  process.exit(1);
}

async function main(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const db = drizzle(pool, { schema });
  // 18 tilfeldige bytes gir et passord på 24 tegn uten tegn som er lette å forveksle i base64url.
  const password = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(password);

  try {
    const [existing] = await db
      .select({ id: schema.admins.id, name: schema.admins.name })
      .from(schema.admins)
      .where(eq(schema.admins.email, email));

    if (existing) {
      await db.transaction(async (tx) => {
        await tx
          .update(schema.admins)
          .set({ passwordHash, ...(name && { name }) })
          .where(eq(schema.admins.id, existing.id));
        await tx.delete(schema.adminSessions).where(eq(schema.adminSessions.adminId, existing.id));
      });
      console.log(`Nytt passord for ${name || existing.name} (${email}). Gamle økter er logget ut.`);
    } else {
      if (!name) {
        console.error('Ny admin trenger navn: npm run admin:opprett -- <e-post> "<navn>"');
        process.exitCode = 1;
        return;
      }
      await db.insert(schema.admins).values({ email, name, passwordHash });
      console.log(`Opprettet admin ${name} (${email}).`);
    }
    console.log(`\n  Passord: ${password}\n\nPassordet vises bare nå. Gi det til personen på en trygg måte.`);
  } finally {
    await pool.end();
  }
}

main(url).catch((err) => {
  console.error("Kunne ikke opprette admin:", err);
  process.exitCode = 1;
});
