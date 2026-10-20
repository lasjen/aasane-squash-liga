import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import type { League } from "@/lib/leagues";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Maks lengde på meldingen under rankingen. */
export const RANKING_MESSAGE_MAX = 1000;

/** Noterer at rekkefølgen i rankingen for ligaen er endret nå. Kalles i samme transaksjon som endringen. */
export async function touchRanking(executor: typeof db | Transaction = db, league: League = "open") {
  const now = new Date();
  const set = league === "women" ? { womenRankingUpdatedAt: now } : { rankingUpdatedAt: now };
  await executor
    .insert(schema.rankingInfo)
    .values({ id: 1, ...set })
    .onConflictDoUpdate({ target: schema.rankingInfo.id, set });
}

/** Meldingen og tidspunktet for siste endring per liga. Alle er null før noe er lagret. */
export async function getRankingInfo() {
  const [row] = await db.select().from(schema.rankingInfo).where(eq(schema.rankingInfo.id, 1));
  return {
    message: row?.message ?? null,
    updatedAt: {
      open: row?.rankingUpdatedAt ?? null,
      women: row?.womenRankingUpdatedAt ?? null,
    } satisfies Record<League, Date | null>,
  };
}
