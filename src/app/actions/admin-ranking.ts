"use server";

import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import * as z from "zod";

import { db, schema } from "@/db";
import { logAction } from "@/lib/audit";
import { LEAGUES, type League } from "@/lib/leagues";
import { requireOperator } from "@/lib/auth/admin-session";
import { rankingMoves, sameRankingMembers } from "@/lib/ranking";
import { RANKING_MESSAGE_MAX, touchRanking } from "@/lib/ranking-info";

export type PublishRankingResult =
  | { ok: true; moved: number }
  | { ok: false; stale: boolean; message: string };

const idList = z.array(z.number().int().positive()).max(1000);

const STALE_MESSAGE =
  "Rankingen er endret siden du åpnet siden, for eksempel av en annen operatør eller fordi en runde ble avsluttet. Last inn på nytt og gjør endringene igjen.";

/** Så mange enkeltflyttinger skrives i loggen før resten oppsummeres. */
const LOG_LIMIT = 10;

/**
 * Lagrer en ny rekkefølge på rankingen, laget ved å dra spillere opp og ned i konsollen.
 *
 * `expected` er rekkefølgen slik den var da siden ble åpnet. Er rankingen endret siden,
 * avvises publiseringen, så ingen overskriver andres endringer uten å vite det.
 * `order` må inneholde nøyaktig de samme spillerne; nye plasser gis fra 1 og nedover.
 */
export async function publishRanking(
  league: League,
  expected: number[],
  order: number[],
): Promise<PublishRankingResult> {
  const actor = await requireOperator();
  if (!LEAGUES.includes(league)) return { ok: false, stale: false, message: "Ukjent ranking." };
  const column = league === "women" ? schema.players.womenRanking : schema.players.ranking;

  const parsedExpected = idList.safeParse(expected);
  const parsedOrder = idList.safeParse(order);
  if (!parsedExpected.success || !parsedOrder.success) {
    return { ok: false, stale: false, message: "Ugyldig rekkefølge." };
  }

  const result = await db.transaction(async (tx): Promise<PublishRankingResult> => {
    // Låser de rangerte spillerne, så ingen andre endrer rankingen samtidig.
    const current = await tx
      .select({
        id: schema.players.id,
        firstName: schema.players.firstName,
        lastName: schema.players.lastName,
      })
      .from(schema.players)
      .where(and(eq(schema.players.active, true), isNotNull(column)))
      .orderBy(asc(column), asc(schema.players.id))
      .for("update");
    const currentIds = current.map((p) => p.id);

    const unchangedSinceLoad =
      currentIds.length === parsedExpected.data.length &&
      currentIds.every((id, i) => id === parsedExpected.data[i]);
    if (!unchangedSinceLoad || !sameRankingMembers(currentIds, parsedOrder.data)) {
      return { ok: false, stale: true, message: STALE_MESSAGE };
    }

    const moves = rankingMoves(currentIds, parsedOrder.data);
    if (moves.length === 0) return { ok: true, moved: 0 };

    // Én spørring: hver spiller får plassen sin i den nye rekkefølgen.
    await tx.execute(sql`
      UPDATE ${schema.players} AS p
      SET ${sql.raw(league === "women" ? "women_ranking" : "ranking")} = v.ranking
      FROM unnest(${sql.param(parsedOrder.data)}::int[]) WITH ORDINALITY AS v(id, ranking)
      WHERE p.id = v.id
    `);
    await touchRanking(tx, league);

    // Loggen viser spillerne som er flyttet mer enn én plass. De som bare rykket én plass
    // fordi noen ble flyttet forbi dem, telles. Er alle flyttet én plass (f.eks. to naboer
    // som byttet), vises alle.
    const names = new Map(current.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
    const big = moves.filter((m) => Math.abs(m.to - m.from!) > 1);
    const shown = big.length > 0 ? big : moves;
    const listed = shown
      .slice(0, LOG_LIMIT)
      .map((m) => `${names.get(m.id)} ${m.from} → ${m.to}`);
    const rest = moves.length - Math.min(shown.length, LOG_LIMIT);
    await logAction(
      actor,
      league === "women" ? "ranking.dame-endret" : "ranking.endret",
      `Endret ${league === "women" ? "dameligaens ranking" : "rankingen"} manuelt: ${listed.join(", ")}${
        rest > 0 ? ` (${rest} ${rest === 1 ? "annen spiller" : "andre spillere"} flyttet)` : ""
      }`,
      tx,
    );
    return { ok: true, moved: moves.length };
  });

  if (result.ok) refresh();
  return result;
}

export type SaveMessageResult = { ok: true } | { ok: false; message: string };

/** Lagrer meldingen som vises under rankingen. Tom melding fjerner den. */
export async function saveRankingMessage(message: string): Promise<SaveMessageResult> {
  const actor = await requireOperator();

  const parsed = z.string().max(RANKING_MESSAGE_MAX).safeParse(message);
  if (!parsed.success) {
    return { ok: false, message: `Meldingen kan være maks ${RANKING_MESSAGE_MAX} tegn.` };
  }
  const text = parsed.data.trim() || null;

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.rankingInfo)
      .values({ id: 1, message: text })
      .onConflictDoUpdate({ target: schema.rankingInfo.id, set: { message: text } });
    await logAction(
      actor,
      "ranking.melding",
      text ? "Endret meldingen under rankingen" : "Fjernet meldingen under rankingen",
      tx,
    );
  });

  refresh();
  return { ok: true };
}
