"use server";

import { eq, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";

import { db, schema } from "@/db";
import { adminPlayerSchema, type AdminPlayerField } from "@/lib/admin/player-validation";
import { requireAdmin } from "@/lib/auth/admin-session";
import { hashPassword } from "@/lib/auth/password";
import type { FormState } from "@/lib/auth/validation";
import { buildRanking } from "@/lib/ranking";

type PlayerFormState = FormState<AdminPlayerField>;

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function isUniqueViolation(err: unknown) {
  const cause = err instanceof Error && "cause" in err ? err.cause : err;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
}

/** Leser skjemaet. Returnerer enten gyldige data eller feil klare for skjemaet. */
function parsePlayerForm(formData: FormData) {
  const values = {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    gender: text(formData, "gender"),
    level: text(formData, "level"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    active: formData.get("active") === "on" ? "on" : "",
    isAdmin: formData.get("isAdmin") === "on" ? "on" : "",
  };
  const parsed = adminPlayerSchema.safeParse({
    ...values,
    password: text(formData, "password"),
    active: values.active === "on",
    isAdmin: values.isAdmin === "on",
  });
  return { values, parsed };
}

const emailTaken = (values: Record<string, string>): PlayerFormState => ({
  errors: { email: ["En annen spiller har allerede denne e-postadressen."] },
  values,
});

export async function createPlayer(_prev: PlayerFormState, formData: FormData): Promise<PlayerFormState> {
  await requireAdmin();

  const { values, parsed } = parsePlayerForm(formData);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { password, ...player } = parsed.data;
  try {
    await db.insert(schema.players).values({
      ...player,
      passwordHash: password ? await hashPassword(password) : null,
    });
  } catch (err) {
    if (isUniqueViolation(err)) return emailTaken(values);
    throw err;
  }

  redirect("/admin?melding=lagt-til");
}

export async function updatePlayer(
  playerId: number,
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const admin = await requireAdmin();

  const { values, parsed } = parsePlayerForm(formData);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { password, ...player } = parsed.data;
  // Hindrer at en admin låser seg selv ute.
  if (playerId === admin.id && (!player.isAdmin || !player.active)) {
    return {
      message: "Du kan ikke fjerne din egen admin-tilgang eller deaktivere deg selv.",
      values,
    };
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(schema.players)
        .set({
          ...player,
          // Tomt passordfelt betyr at passordet ikke endres.
          ...(password && { passwordHash: await hashPassword(password) }),
          // Inaktive spillere er ikke med i rankingen.
          ...(!player.active && { ranking: null }),
        })
        .where(eq(schema.players.id, playerId))
        .returning({ id: schema.players.id });

      if (!player.isAdmin || !player.active) {
        await tx.delete(schema.adminSessions).where(eq(schema.adminSessions.playerId, playerId));
      }
      return rows.length > 0;
    });
    if (!updated) return { message: "Spilleren finnes ikke lenger.", values };
  } catch (err) {
    if (isUniqueViolation(err)) return emailTaken(values);
    throw err;
  }

  redirect("/admin?melding=lagret");
}

/**
 * Sletter en spiller. Har spilleren spilt kamper eller vært i en divisjon,
 * blir den i stedet deaktivert, så resultater og tabeller beholdes.
 */
export async function deletePlayer(playerId: number) {
  const admin = await requireAdmin();
  if (playerId === admin.id) {
    redirect("/admin?melding=ikke-deg-selv");
  }

  const outcome = await db.transaction(async (tx) => {
    const [inMatch] = await tx
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(
        or(
          eq(schema.matches.player1Id, playerId),
          eq(schema.matches.player2Id, playerId),
          eq(schema.matches.winnerId, playerId),
        ),
      )
      .limit(1);
    const [inDivision] = await tx
      .select({ playerId: schema.divisionPlayers.playerId })
      .from(schema.divisionPlayers)
      .where(eq(schema.divisionPlayers.playerId, playerId))
      .limit(1);

    if (inMatch || inDivision) {
      await tx
        .update(schema.players)
        .set({ active: false, isAdmin: false, ranking: null })
        .where(eq(schema.players.id, playerId));
      // Logger spilleren ut overalt.
      await tx.delete(schema.sessions).where(eq(schema.sessions.playerId, playerId));
      await tx.delete(schema.adminSessions).where(eq(schema.adminSessions.playerId, playerId));
      return "deaktivert";
    }

    // Økter slettes automatisk (on delete cascade).
    await tx.delete(schema.players).where(eq(schema.players.id, playerId));
    return "slettet";
  });

  redirect(`/admin?melding=${outcome}`);
}

/**
 * Gir alle aktive spillere en plass i rankingen. Se buildRanking for reglene.
 * Inaktive spillere tas ut av rankingen.
 */
export async function updateRanking() {
  await requireAdmin();

  const newlyRanked = await db.transaction(async (tx) => {
    // Låser spillerradene, så to samtidige oppdateringer ikke gir like plasser.
    const players = await tx
      .select({
        id: schema.players.id,
        ranking: schema.players.ranking,
        level: schema.players.level,
      })
      .from(schema.players)
      .where(eq(schema.players.active, true))
      .for("update");

    const order = buildRanking(players);
    if (order.length > 0) {
      // Én spørring: oppdaterer hver spiller med sin nye plass.
      await tx.execute(sql`
        UPDATE ${schema.players} AS p
        SET ranking = v.ranking
        FROM unnest(${sql.param(order)}::int[]) WITH ORDINALITY AS v(id, ranking)
        WHERE p.id = v.id
      `);
    }
    await tx
      .update(schema.players)
      .set({ ranking: null })
      .where(eq(schema.players.active, false));

    return players.filter((p) => p.ranking === null).length;
  });

  redirect(`/admin?melding=ranking&nye=${newlyRanked}`);
}
