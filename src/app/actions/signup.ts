"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { db, schema } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { ensureRound, findSignupRounds } from "@/lib/rounds";

/**
 * Sjekker at runden spilleren så på siden fortsatt er åpen for påmelding: neste runde, eller
 * runden etter når fristen for neste runde har gått ut. Datoen sendes med fra skjemaet,
 * så ingen blir meldt på en annen runde enn de trodde.
 */
async function assertOpenRound(date: string) {
  const { current, next } = await findSignupRounds();
  const round = [current, next].find((r) => r?.date === date);
  if (!round) redirect("/pamelding?melding=runden-er-startet");
  return round;
}

export async function signUp(date: string) {
  const player = await requirePlayer();
  await assertOpenRound(date);

  const [{ active }] = await db
    .select({ active: schema.players.active })
    .from(schema.players)
    .where(eq(schema.players.id, player.id));
  if (!active) redirect("/pamelding?melding=pause");

  const started = await db.transaction(async (tx) => {
    const round = await ensureRound(tx, date);
    if (round.status !== "open") return true;
    await tx
      .insert(schema.roundSignups)
      .values({ roundId: round.id, playerId: player.id })
      .onConflictDoNothing();
    return false;
  });
  if (started) redirect("/pamelding?melding=runden-er-startet");

  refresh();
}

export async function withdraw(date: string) {
  const player = await requirePlayer();
  const { round } = await assertOpenRound(date);
  if (!round) return;

  await db
    .delete(schema.roundSignups)
    .where(
      and(eq(schema.roundSignups.roundId, round.id), eq(schema.roundSignups.playerId, player.id)),
    );

  refresh();
}
