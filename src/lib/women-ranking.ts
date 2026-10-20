import "server-only";

import { sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { isWomensLeagueMember } from "@/lib/leagues";
import { touchRanking } from "@/lib/ranking-info";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Ny rekkefølge i dameligaens ranking, som spiller-id-er fra plass 1 og nedover.
 *
 * - Medlemmer som allerede har plass, beholder rekkefølgen sin, og hull tettes.
 * - Nye medlemmer legges under dem, i samme innbyrdes rekkefølge som i «Alle»-rankingen.
 *   De uten ranking der kommer sist, sortert på navn.
 */
export function buildWomenRanking(
  members: { id: number; womenRanking: number | null; ranking: number | null; name: string }[],
): number[] {
  const placed = members
    .filter((p) => p.womenRanking !== null)
    .sort((a, b) => a.womenRanking! - b.womenRanking! || a.id - b.id);
  const added = members
    .filter((p) => p.womenRanking === null)
    .sort(
      (a, b) =>
        (a.ranking ?? Infinity) - (b.ranking ?? Infinity) || a.name.localeCompare(b.name, "nb") || a.id - b.id,
    );
  return [...placed, ...added].map((p) => p.id);
}

/**
 * Sørger for at dameligaens ranking har nøyaktig de aktive kvinnene som vil spille dameliga,
 * med plass 1, 2, 3 … uten hull. Kalles i samme transaksjon som endringer i kjønn, ønsket om
 * dameliga, aktiv/pause eller sletting. Returnerer om rankingen ble endret.
 */
export async function syncWomenRanking(tx: Transaction): Promise<boolean> {
  // Låser spillerradene, så to samtidige endringer ikke gir like plasser.
  const players = await tx
    .select({
      id: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      gender: schema.players.gender,
      wantsWomensLeague: schema.players.wantsWomensLeague,
      active: schema.players.active,
      deletedAt: schema.players.deletedAt,
      ranking: schema.players.ranking,
      womenRanking: schema.players.womenRanking,
    })
    .from(schema.players)
    .for("update");

  const order = buildWomenRanking(
    players
      .filter(isWomensLeagueMember)
      .map((p) => ({ ...p, name: `${p.firstName} ${p.lastName}` })),
  );
  const place = new Map(order.map((id, i) => [id, i + 1]));
  const changed = players.filter((p) => (place.get(p.id) ?? null) !== p.womenRanking);
  if (changed.length === 0) return false;

  await tx.execute(sql`
    UPDATE ${schema.players} AS p
    SET women_ranking = v.ranking
    FROM unnest(
      ${sql.param(changed.map((p) => p.id))}::int[],
      ${sql.param(changed.map((p) => place.get(p.id) ?? null))}::int[]
    ) AS v(id, ranking)
    WHERE p.id = v.id
  `);
  await touchRanking(tx, "women");
  return true;
}
