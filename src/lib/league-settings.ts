import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { DEFAULT_ENDS_AT, DEFAULT_STARTS_AT, formatTime } from "@/lib/dates";
import { DEFAULT_MAX_PLAYERS } from "@/lib/groups";
import { DEFAULT_BEST_OF } from "@/lib/score";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LeagueSettings = { maxPlayers: number; bestOf: number; startsAt: string; endsAt: string };

/**
 * Innstillingene admin har lagret under Innstillinger, eller standardene i koden før noe
 * er lagret. Klokkeslettene er på formen «18:30».
 */
export async function getLeagueSettings(executor: typeof db | Transaction = db): Promise<LeagueSettings> {
  const [row] = await executor
    .select()
    .from(schema.leagueSettings)
    .where(eq(schema.leagueSettings.id, 1));
  return {
    maxPlayers: row?.maxPlayers ?? DEFAULT_MAX_PLAYERS,
    bestOf: row?.bestOf ?? DEFAULT_BEST_OF,
    startsAt: formatTime(row?.startsAt ?? DEFAULT_STARTS_AT),
    endsAt: formatTime(row?.endsAt ?? DEFAULT_ENDS_AT),
  };
}
