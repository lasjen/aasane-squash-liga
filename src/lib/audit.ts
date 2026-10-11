import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { formatRoundDate } from "@/lib/dates";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Hvem som gjorde noe: operatøren eller admin-en som er logget inn i konsollen. */
export type Actor = { id: number; firstName: string; lastName: string };

/**
 * Skriver en linje i loggen over hva operatører og admins har gjort. Kalles etter at
 * handlingen er utført, helst i samme transaksjon så loggen og endringen henger sammen.
 */
export async function logAction(
  actor: Actor,
  action: string,
  description: string,
  executor: typeof db | Transaction = db,
) {
  await executor.insert(schema.auditLog).values({
    actorId: actor.id,
    actorName: `${actor.firstName} ${actor.lastName}`,
    action,
    description,
  });
}

/** Rundens dato som tekst til loggen, f.eks. «torsdag 22. oktober». */
export async function roundLabel(roundId: number) {
  const [round] = await db
    .select({ playedOn: schema.rounds.playedOn })
    .from(schema.rounds)
    .where(eq(schema.rounds.id, roundId));
  return round ? formatRoundDate(round.playedOn) : `runde ${roundId}`;
}

/** Spillerens navn til loggen. */
export async function playerLabel(playerId: number) {
  const [player] = await db
    .select({ firstName: schema.players.firstName, lastName: schema.players.lastName })
    .from(schema.players)
    .where(eq(schema.players.id, playerId));
  return player ? `${player.firstName} ${player.lastName}` : `spiller ${playerId}`;
}
