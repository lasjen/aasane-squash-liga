import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Maks lengde på meldingen under rankingen. */
export const RANKING_MESSAGE_MAX = 1000;

/** Noterer at rekkefølgen i rankingen er endret nå. Kalles i samme transaksjon som endringen. */
export async function touchRanking(executor: typeof db | Transaction = db) {
  const now = new Date();
  await executor
    .insert(schema.rankingInfo)
    .values({ id: 1, rankingUpdatedAt: now })
    .onConflictDoUpdate({ target: schema.rankingInfo.id, set: { rankingUpdatedAt: now } });
}

/** Meldingen og tidspunktet for siste endring. Begge er null før noe er lagret. */
export async function getRankingInfo() {
  const [row] = await db.select().from(schema.rankingInfo).where(eq(schema.rankingInfo.id, 1));
  return { message: row?.message ?? null, updatedAt: row?.rankingUpdatedAt ?? null };
}
