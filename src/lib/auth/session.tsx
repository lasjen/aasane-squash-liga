import "server-only";

import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db, schema } from "@/db";

import { playerHomePath } from "@/lib/rounds";

import { hashToken, newSessionToken } from "./tokens";

const COOKIE_NAME = "session";

/** Oppretter en ny økt for spilleren og setter cookien. Kalles fra server actions. */
export async function createSession(playerId: number) {
  const { token, expiresAt } = newSessionToken();

  // Rydder bort spillerens utløpte økter samtidig.
  await db
    .delete(schema.sessions)
    .where(and(eq(schema.sessions.playerId, playerId), lt(schema.sessions.expiresAt, sql`now()`)));
  await db.insert(schema.sessions).values({ id: hashToken(token), playerId, expiresAt });

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Sletter økten i databasen og fjerner cookien. Kalles fra server actions. */
export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  }
  cookieStore.delete(COOKIE_NAME);
}

/** Logger spilleren ut overalt unntatt i denne nettleseren, f.eks. etter passordbytte. */
export async function deleteOtherSessions(playerId: number) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const current = token ? hashToken(token) : "";
  await db
    .delete(schema.sessions)
    .where(and(eq(schema.sessions.playerId, playerId), ne(schema.sessions.id, current)));
}

/** Den innloggede spilleren, eller null. Memoisert per forespørsel. */
export const getCurrentPlayer = cache(async () => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      email: schema.players.email,
    })
    .from(schema.sessions)
    .innerJoin(schema.players, eq(schema.players.id, schema.sessions.playerId))
    .where(
      and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, sql`now()`)),
    )
    .limit(1);

  return row ?? null;
});

/** Som getCurrentPlayer, men sender til innlogging hvis ingen er logget inn. */
export async function requirePlayer() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/logg-inn");
  return player;
}

/**
 * Sender innloggede spillere videre (f.eks. bort fra /logg-inn).
 * Rendres inni <Suspense> fordi den leser cookien.
 */
export async function RedirectIfLoggedIn({ to }: { to?: string }) {
  if (await getCurrentPlayer()) redirect(to ?? (await playerHomePath()));
  return null;
}
