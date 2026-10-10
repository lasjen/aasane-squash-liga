"use server";

import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth/admin-session";
import { osloToday } from "@/lib/dates";
import { MAX_PLAYERS, groupSizeProblem, splitIntoGroups } from "@/lib/groups";
import { regenerateGroupMatches } from "@/lib/round-matches";
import { countMissingResults, finishedRoundEditProblem, saveRoundResults } from "@/lib/round-results";
import { ensureRound } from "@/lib/rounds";
import { BEST_OF_OPTIONS, type BestOf } from "@/lib/score";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const PAGE = "/admin/runde";
const EDIT_PAGE = "/admin/runde?rediger=1";

/** Låser runden for resten av transaksjonen og returnerer statusen. */
async function lockRound(tx: Transaction, roundId: number) {
  const [round] = await tx
    .select({ status: schema.rounds.status })
    .from(schema.rounds)
    .where(eq(schema.rounds.id, roundId))
    .for("update");
  return round?.status ?? null;
}

/** Setter opp kampene på nytt i hver av gruppene (uten duplikater). */
async function regenerate(tx: Transaction, roundId: number, groupIds: (number | null | undefined)[]) {
  for (const groupId of new Set(groupIds)) {
    if (groupId) await regenerateGroupMatches(tx, roundId, groupId);
  }
}

/** Gruppen spilleren er i nå, eller null. */
async function groupOf(tx: Transaction, roundId: number, playerId: number) {
  const [row] = await tx
    .select({ groupId: schema.roundGroupPlayers.groupId })
    .from(schema.roundGroupPlayers)
    .where(
      and(eq(schema.roundGroupPlayers.roundId, roundId), eq(schema.roundGroupPlayers.playerId, playerId)),
    );
  return row?.groupId ?? null;
}

/**
 * Setter opp gruppene og kampene på nytt fra påmeldingene: de første MAX_PLAYERS påmeldte,
 * sortert etter ranking. Spillere uten ranking kommer sist, i påmeldingsrekkefølge.
 * Returnerer antall spillere hvis antallet ikke lar seg dele i grupper, ellers null.
 */
async function buildGroups(tx: Transaction, roundId: number): Promise<number | null> {
  const participants = await tx
    .select({ id: schema.players.id, ranking: schema.players.ranking })
    .from(schema.roundSignups)
    .innerJoin(schema.players, eq(schema.players.id, schema.roundSignups.playerId))
    .where(eq(schema.roundSignups.roundId, roundId))
    .orderBy(asc(schema.roundSignups.createdAt))
    .limit(MAX_PLAYERS);

  if (groupSizeProblem(participants.length)) return participants.length;

  // Array.sort er stabil, så spillere uten ranking beholder påmeldingsrekkefølgen.
  const sorted = [...participants].sort(
    (a, b) => (a.ranking ?? Infinity) - (b.ranking ?? Infinity),
  );
  const groups = splitIntoGroups(sorted)!;

  await tx.delete(schema.roundGroups).where(eq(schema.roundGroups.roundId, roundId));
  const created = await tx
    .insert(schema.roundGroups)
    .values(groups.map((_, i) => ({ roundId, number: i + 1 })))
    .returning({ id: schema.roundGroups.id, number: schema.roundGroups.number });
  const idByNumber = new Map(created.map((g) => [g.number, g.id]));

  await tx.insert(schema.roundGroupPlayers).values(
    groups.flatMap((players, i) =>
      players.map((p) => ({ roundId, groupId: idByNumber.get(i + 1)!, playerId: p.id })),
    ),
  );
  await regenerate(tx, roundId, [...idByNumber.values()]);
  return null;
}

/** Siden regner ut forklaringen selv fra antallet, så ingen fritekst går via URL-en. */
function redirectWithBadCount(count: number): never {
  redirect(`${PAGE}?melding=antall&antall=${count}`);
}

export async function startRound(roundId: number) {
  await requireAdmin();

  const problem = await db.transaction(async (tx) => {
    if ((await lockRound(tx, roundId)) !== "open") return "status" as const;
    const badCount = await buildGroups(tx, roundId);
    if (badCount !== null) return badCount;
    await tx.update(schema.rounds).set({ status: "started" }).where(eq(schema.rounds.id, roundId));
    return null;
  });

  if (problem === "status") redirect(`${PAGE}?melding=feil-status`);
  if (problem !== null) redirectWithBadCount(problem);
  redirect(`${PAGE}?melding=startet`);
}

export async function restartRound(roundId: number) {
  await requireAdmin();

  const problem = await db.transaction(async (tx) => {
    if ((await lockRound(tx, roundId)) !== "started") return "status" as const;
    return buildGroups(tx, roundId);
  });

  if (problem === "status") redirect(`${PAGE}?melding=feil-status`);
  if (problem !== null) redirectWithBadCount(problem);
  redirect(`${PAGE}?melding=restartet`);
}

/** Avslutter runden: lager resultatlisten og oppdaterer rankingen. Krever resultat i alle kamper. */
export async function finishRound(roundId: number) {
  await requireAdmin();

  const outcome = await db.transaction(async (tx) => {
    if ((await lockRound(tx, roundId)) !== "started") return "feil-status";
    if ((await countMissingResults(tx, roundId)) > 0) return "mangler-resultater";
    await saveRoundResults(tx, roundId);
    await tx.update(schema.rounds).set({ status: "finished" }).where(eq(schema.rounds.id, roundId));
    return "avsluttet";
  });

  redirect(
    outcome === "avsluttet" ? `/admin/resultater/${roundId}?melding=avsluttet` : `${PAGE}?melding=${outcome}`,
  );
}

/** Regner ut resultatlisten og rankingen for en avsluttet runde på nytt. */
export async function recomputeRoundResults(roundId: number) {
  await requireAdmin();
  const page = `/admin/resultater/${roundId}`;

  const ok = await db.transaction(async (tx) => {
    await lockRound(tx, roundId);
    if (await finishedRoundEditProblem(tx, roundId)) return false;
    await saveRoundResults(tx, roundId);
    return true;
  });

  redirect(`${page}?melding=${ok ? "beregnet" : "kan-ikke-endres"}`);
}

/**
 * Velger kampformat (best av 3 eller 5 sett) for runden på datoen.
 * Kan ikke endres etter at et resultat er registrert, siden resultatene da ville blitt ugyldige.
 */
export async function setRoundFormat(date: string, formData: FormData) {
  await requireAdmin();
  const bestOf = Number(formData.get("bestOf"));
  if (!BEST_OF_OPTIONS.includes(bestOf as BestOf)) redirect(`${PAGE}?melding=ukjent-format`);

  const outcome = await db.transaction(async (tx) => {
    const round = await ensureRound(tx, date);
    if ((await lockRound(tx, round.id)) === "finished") return "feil-status";
    const [played] = await tx
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(and(eq(schema.matches.roundId, round.id), isNotNull(schema.matches.player1Games)))
      .limit(1);
    if (played) return "format-laast";
    await tx.update(schema.rounds).set({ bestOf }).where(eq(schema.rounds.id, round.id));
    return "format";
  });

  redirect(`${PAGE}?melding=${outcome}`);
}

/** Legger en spiller til neste runde før den er startet. Er runden full, havner spilleren på venteliste. */
export async function addToRound(date: string, playerId: number) {
  await requireAdmin();

  const ok = await db.transaction(async (tx) => {
    const round = await ensureRound(tx, date);
    if (round.status !== "open") return false;
    await tx.insert(schema.roundSignups).values({ roundId: round.id, playerId }).onConflictDoNothing();
    return true;
  });

  redirect(`${PAGE}?melding=${ok ? "lagt-til" : "feil-status"}`);
}

/**
 * Fjerner en spiller fra runden, f.eks. ved «no show». Virker både før og etter
 * at runden er startet. Neste på ventelisten rykker da opp i påmeldingslisten.
 */
export async function removeFromRound(roundId: number, playerId: number, fromEdit: boolean) {
  await requireAdmin();

  await db.transaction(async (tx) => {
    const removed = await tx
      .delete(schema.roundGroupPlayers)
      .where(
        and(eq(schema.roundGroupPlayers.roundId, roundId), eq(schema.roundGroupPlayers.playerId, playerId)),
      )
      .returning({ groupId: schema.roundGroupPlayers.groupId });
    await tx
      .delete(schema.roundSignups)
      .where(and(eq(schema.roundSignups.roundId, roundId), eq(schema.roundSignups.playerId, playerId)));
    // Gruppen spilleren var i får nytt kampoppsett uten spilleren.
    await regenerate(tx, roundId, removed.map((r) => r.groupId));
  });

  redirect(fromEdit ? `${EDIT_PAGE}&melding=fjernet` : `${PAGE}?melding=fjernet`);
}

/** Flytter en spiller til gruppen som er valgt i skjemaet. */
export async function movePlayer(roundId: number, playerId: number, formData: FormData) {
  await requireAdmin();
  const groupNumber = Number(formData.get("group"));

  const moved = await db.transaction(async (tx) => {
    const [group] = await tx
      .select({ id: schema.roundGroups.id })
      .from(schema.roundGroups)
      .where(and(eq(schema.roundGroups.roundId, roundId), eq(schema.roundGroups.number, groupNumber)));
    if (!group) return false;
    const oldGroupId = await groupOf(tx, roundId, playerId);
    await tx
      .update(schema.roundGroupPlayers)
      .set({ groupId: group.id })
      .where(
        and(eq(schema.roundGroupPlayers.roundId, roundId), eq(schema.roundGroupPlayers.playerId, playerId)),
      );
    await regenerate(tx, roundId, [oldGroupId, group.id]);
    return true;
  });

  redirect(`${EDIT_PAGE}&melding=${moved ? "flyttet" : "ukjent-gruppe"}`);
}

/** Legger spilleren som er valgt i skjemaet til en gruppe, og melder spilleren på runden. */
export async function addToGroup(roundId: number, groupId: number, formData: FormData) {
  await requireAdmin();
  const playerId = Number(formData.get("playerId"));
  if (!Number.isSafeInteger(playerId) || playerId < 1) redirect(`${EDIT_PAGE}&melding=velg-spiller`);

  await db.transaction(async (tx) => {
    await tx.insert(schema.roundSignups).values({ roundId, playerId }).onConflictDoNothing();
    // En spiller kan bare være i én gruppe, så eventuell gammel plass fjernes først.
    const oldGroupId = await groupOf(tx, roundId, playerId);
    await tx
      .delete(schema.roundGroupPlayers)
      .where(
        and(eq(schema.roundGroupPlayers.roundId, roundId), eq(schema.roundGroupPlayers.playerId, playerId)),
      );
    await tx.insert(schema.roundGroupPlayers).values({ roundId, groupId, playerId });
    await regenerate(tx, roundId, [oldGroupId, groupId]);
  });

  redirect(`${EDIT_PAGE}&melding=lagt-til`);
}

/**
 * Gjør datoen til en torsdag uten liga. Finnes det en runde med åpen påmelding den dagen,
 * slettes den sammen med påmeldingene. Returnerer feilnøkkel eller antall slettede påmeldinger.
 */
async function cancelThursday(date: string, reason: string | null, hidden: boolean) {
  if (!isValidDate(date) || new Date(`${date}T00:00:00Z`).getUTCDay() !== 4) return "ikke-torsdag";
  if (date < osloToday()) return "dato-passert";

  return db.transaction(async (tx) => {
    const [round] = await tx
      .select({ id: schema.rounds.id, status: schema.rounds.status })
      .from(schema.rounds)
      .where(eq(schema.rounds.playedOn, date))
      .for("update");
    if (round && round.status !== "open") return "runde-startet";

    let removedSignups = 0;
    if (round) {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(schema.roundSignups)
        .where(eq(schema.roundSignups.roundId, round.id));
      removedSignups = n;
      // Påmeldingene slettes sammen med runden (on delete cascade).
      await tx.delete(schema.rounds).where(eq(schema.rounds.id, round.id));
    }
    await tx
      .insert(schema.cancelledDates)
      .values({ date, reason, hidden })
      .onConflictDoUpdate({ target: schema.cancelledDates.date, set: { reason, hidden } });
    return removedSignups;
  });
}

const isValidDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);

function redirectAfterCancel(outcome: string | number): never {
  if (typeof outcome === "string") redirect(`${PAGE}?melding=${outcome}`);
  redirect(`${PAGE}?melding=avlyst&slettet=${outcome}`);
}

/** Melding til spillerne fra skjemaet, eller null hvis feltet er tomt. */
const cancelMessage = (formData: FormData) =>
  String(formData.get("reason") ?? "").trim().slice(0, 300) || null;
/** Om avlysningen skal skjules for spillerne («Ikke vis for spillerne» er krysset av). */
const cancelHidden = (formData: FormData) => formData.get("hidden") === "on";

/**
 * Avlyser torsdagen som er neste runde, så påmeldingen til torsdagen etter åpner.
 * Meldingen vises for spillerne på påmeldingssiden.
 */
export async function cancelNextRound(date: string, formData: FormData) {
  await requireAdmin();
  redirectAfterCancel(await cancelThursday(date, cancelMessage(formData), cancelHidden(formData)));
}

/** Legger inn en torsdag uten liga fra skjemaet (dato og valgfri melding). Finnes datoen, oppdateres meldingen. */
export async function addCancelledDate(formData: FormData) {
  await requireAdmin();
  const date = String(formData.get("date") ?? "");
  redirectAfterCancel(await cancelThursday(date, cancelMessage(formData), cancelHidden(formData)));
}

/** Endrer meldingen og om avlysningen vises for spillerne. */
export async function updateCancelledDate(date: string, formData: FormData) {
  await requireAdmin();
  await db
    .update(schema.cancelledDates)
    .set({ reason: cancelMessage(formData), hidden: cancelHidden(formData) })
    .where(eq(schema.cancelledDates.date, date));
  redirect(`${PAGE}?melding=avlysning-endret`);
}

/** Åpner en avlyst torsdag igjen. */
export async function removeCancelledDate(date: string) {
  await requireAdmin();
  await db.delete(schema.cancelledDates).where(eq(schema.cancelledDates.date, date));
  redirect(`${PAGE}?melding=gjenapnet`);
}
