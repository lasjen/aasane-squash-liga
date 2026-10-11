import "server-only";

import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";

import { db, schema } from "@/db";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Tar spilleren ut av rankingen og lar alle under rykke opp én plass, så det ikke blir hull. */
export async function removeFromRanking(tx: Transaction, playerId: number) {
  const [player] = await tx
    .select({ ranking: schema.players.ranking })
    .from(schema.players)
    .where(eq(schema.players.id, playerId))
    .for("update");
  if (player?.ranking == null) return;

  await tx.update(schema.players).set({ ranking: null }).where(eq(schema.players.id, playerId));
  await tx
    .update(schema.players)
    .set({ ranking: sql`${schema.players.ranking} - 1` })
    .where(gt(schema.players.ranking, player.ranking));
}

/** Om spilleren er med i en runde som pågår. Da må spilleren fjernes fra runden før sletting. */
export async function isInRunningRound(tx: Transaction, playerId: number) {
  const [row] = await tx
    .select({ roundId: schema.roundGroupPlayers.roundId })
    .from(schema.roundGroupPlayers)
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.roundGroupPlayers.roundId))
    .where(and(eq(schema.roundGroupPlayers.playerId, playerId), eq(schema.rounds.status, "started")))
    .limit(1);
  return Boolean(row);
}

/** Om spilleren er den eneste admin-en som er igjen. Den siste admin-en kan ikke slettes. */
export async function isLastAdmin(tx: Transaction, playerId: number) {
  const [player] = await tx
    .select({ role: schema.players.role })
    .from(schema.players)
    .where(eq(schema.players.id, playerId));
  if (player?.role !== "admin") return false;

  const [other] = await tx
    .select({ id: schema.players.id })
    .from(schema.players)
    .where(
      and(
        eq(schema.players.role, "admin"),
        eq(schema.players.active, true),
        isNull(schema.players.deletedAt),
        ne(schema.players.id, playerId),
      ),
    )
    .limit(1);
  return !other;
}

/**
 * Sletter spilleren: alle personopplysninger fjernes, og navnet blir «Tidligere spiller».
 * Raden beholdes så tidligere kamper og resultatlister henger sammen med sine resultater.
 * Påmeldinger, innlogginger og ranking fjernes. Kan ikke angres.
 *
 * Brukes både når admin sletter en spiller og når spilleren sletter sin egen konto.
 * Sjekk isInRunningRound først.
 */
export async function anonymizePlayer(tx: Transaction, playerId: number) {
  await removeFromRanking(tx, playerId);
  await tx.delete(schema.roundSignups).where(eq(schema.roundSignups.playerId, playerId));
  await tx.delete(schema.sessions).where(eq(schema.sessions.playerId, playerId));
  await tx.delete(schema.adminSessions).where(eq(schema.adminSessions.playerId, playerId));
  await tx
    .update(schema.players)
    .set({
      firstName: "Tidligere",
      lastName: "spiller",
      email: null,
      phone: null,
      gender: null,
      level: null,
      passwordHash: null,
      role: "player",
      active: false,
      ranking: null,
      deletedAt: new Date(),
    })
    .where(eq(schema.players.id, playerId));
}
