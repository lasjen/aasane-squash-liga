import "server-only";

import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db, schema } from "@/db";

import { hashToken, newSessionToken } from "./tokens";

// Egen cookie, begrenset til /admin, så den aldri sendes med vanlige sider
// og ikke kan forveksles med spillerøkten.
const COOKIE_NAME = "admin_session";
const COOKIE_PATH = "/admin";
/** Admin-økter varer kortere enn spillerøkter. */
const ADMIN_SESSION_HOURS = 12;

/** Oppretter en ny admin-økt for spilleren og setter cookien. Kalles fra server actions. */
export async function createAdminSession(playerId: number) {
  const { token } = newSessionToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000);

  await db
    .delete(schema.adminSessions)
    .where(
      and(eq(schema.adminSessions.playerId, playerId), lt(schema.adminSessions.expiresAt, sql`now()`)),
    );
  await db.insert(schema.adminSessions).values({ id: hashToken(token), playerId, expiresAt });

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    expires: expiresAt,
  });
}

/** Sletter admin-økten i databasen og fjerner cookien. Kalles fra server actions. */
export async function deleteAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, hashToken(token)));
  }
  cookieStore.delete({ name: COOKIE_NAME, path: COOKIE_PATH });
}

/**
 * Den innloggede administratoren, eller null. Memoisert per forespørsel.
 * Rollen sjekkes hver gang, så en som mister operatør- eller admin-rollen mister tilgangen med en gang.
 */
export const getCurrentOperator = cache(async () => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      email: schema.players.email,
      role: schema.players.role,
    })
    .from(schema.adminSessions)
    .innerJoin(schema.players, eq(schema.players.id, schema.adminSessions.playerId))
    .where(
      and(
        eq(schema.adminSessions.id, hashToken(token)),
        gt(schema.adminSessions.expiresAt, sql`now()`),
        inArray(schema.players.role, ["operator", "admin"]),
        eq(schema.players.active, true),
      ),
    )
    .limit(1);

  return row ?? null;
});

/**
 * Som getCurrentOperator, men sender til admin-innlogging hvis ingen er logget inn.
 * Kall den i hver admin-side og hver admin-action. Layouten alene beskytter ikke.
 */
export async function requireOperator() {
  const admin = await getCurrentOperator();
  if (!admin) redirect("/admin/logg-inn");
  return admin;
}

/** Sender innloggede administratorer videre fra /admin/logg-inn. Rendres inni <Suspense>. */
export async function RedirectIfOperator({ to = "/admin" }: { to?: string }) {
  if (await getCurrentOperator()) redirect(to);
  return null;
}

/**
 * Som requireOperator, men krever admin-rollen: endre roller, se loggen og endre innstillingene.
 * Operatører uten admin-rollen sendes til forsiden av konsollen.
 */
export async function requireAdmin() {
  const operator = await requireOperator();
  if (operator.role !== "admin") redirect("/admin?melding=kun-admin");
  return operator;
}
