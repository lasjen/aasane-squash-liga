"use server";

import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db, schema } from "@/db";
import { requireAdmin, requireOperator } from "@/lib/auth/admin-session";
import { logAction, playerLabel, roundLabel, type Actor } from "@/lib/audit";
import {
  formatDeadline,
  formatRoundDate,
  isTime,
  MAX_DEADLINE_DAYS,
  osloToday,
  signupDeadline,
} from "@/lib/dates";
import { MAX_PLAYERS_LIMIT, MIN_PLAYERS } from "@/lib/groups";
import { groupLabel, planRoundGroups } from "@/lib/leagues";
import { regenerateGroupMatches } from "@/lib/round-matches";
import { countMissingResults, finishedRoundEditProblem, saveRoundResults } from "@/lib/round-results";
import { ensureRound } from "@/lib/rounds";
import { BEST_OF_OPTIONS, type BestOf } from "@/lib/score";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const PAGE = "/admin/runde";
const EDIT_PAGE = "/admin/runde?rediger=1";
/** Fanen «Innstillinger» på Ligarunde: kampformat, maks antall, klokkeslett, frist og avlysninger. */
const SETTINGS_PAGE = "/admin/runde?fane=innstillinger";
/** Admin → Innstillinger, der «Torsdager uten liga» ligger. Bare for admin. */
const ADMIN_SETTINGS_PAGE = "/admin/innstillinger";

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
 * Setter opp gruppene og kampene på nytt fra påmeldingene: de første påmeldte, så mange det er plass til,
 * sortert etter ranking. Spillere uten ranking kommer sist, i påmeldingsrekkefølge.
 * Vil minst 3 av kvinnene spille dameliga, får de egne damegrupper sortert etter
 * dameligaens ranking (se planRoundGroups).
 * Returnerer antall spillere hvis antallet ikke lar seg dele i grupper, ellers null.
 */
async function buildGroups(tx: Transaction, roundId: number): Promise<number | null> {
  const [{ maxPlayers }] = await tx
    .select({ maxPlayers: schema.rounds.maxPlayers })
    .from(schema.rounds)
    .where(eq(schema.rounds.id, roundId));
  const participants = await tx
    .select({
      id: schema.players.id,
      ranking: schema.players.ranking,
      womenRanking: schema.players.womenRanking,
      gender: schema.players.gender,
      wantsWomensLeague: schema.players.wantsWomensLeague,
      active: schema.players.active,
    })
    .from(schema.roundSignups)
    .innerJoin(schema.players, eq(schema.players.id, schema.roundSignups.playerId))
    .where(eq(schema.roundSignups.roundId, roundId))
    .orderBy(asc(schema.roundSignups.createdAt))
    .limit(maxPlayers);

  // Array.sort er stabil, så spillere uten ranking beholder påmeldingsrekkefølgen.
  type P = (typeof participants)[number];
  const byRanking = (a: P, b: P) => (a.ranking ?? Infinity) - (b.ranking ?? Infinity);
  const plan = planRoundGroups(
    participants,
    byRanking,
    (a, b) => (a.womenRanking ?? Infinity) - (b.womenRanking ?? Infinity) || byRanking(a, b),
  );
  if (!plan) return participants.length;

  const groups = [
    ...plan.open.map((players, i) => ({ league: "open" as const, number: i + 1, players })),
    ...plan.women.map((players, i) => ({ league: "women" as const, number: i + 1, players })),
  ];

  await tx.delete(schema.roundGroups).where(eq(schema.roundGroups.roundId, roundId));
  const created = await tx
    .insert(schema.roundGroups)
    .values(groups.map((g) => ({ roundId, league: g.league, number: g.number })))
    .returning({ id: schema.roundGroups.id, league: schema.roundGroups.league, number: schema.roundGroups.number });
  const idOf = (league: string, number: number) =>
    created.find((c) => c.league === league && c.number === number)!.id;

  await tx.insert(schema.roundGroupPlayers).values(
    groups.flatMap((g) => g.players.map((p) => ({ roundId, groupId: idOf(g.league, g.number), playerId: p.id }))),
  );
  await regenerate(tx, roundId, created.map((c) => c.id));
  return null;
}

/** Siden regner ut forklaringen selv fra antallet, så ingen fritekst går via URL-en. */
function redirectWithBadCount(count: number): never {
  redirect(`${PAGE}?melding=antall&antall=${count}`);
}

export async function startRound(roundId: number) {
  const actor = await requireOperator();

  const problem = await db.transaction(async (tx) => {
    if ((await lockRound(tx, roundId)) !== "open") return "status" as const;
    const badCount = await buildGroups(tx, roundId);
    if (badCount !== null) return badCount;
    await tx.update(schema.rounds).set({ status: "started" }).where(eq(schema.rounds.id, roundId));
    return null;
  });

  if (problem === "status") redirect(`${PAGE}?melding=feil-status`);
  if (problem !== null) redirectWithBadCount(problem);
  await logAction(actor, "runde.startet", `Startet runden ${await roundLabel(roundId)}`);
  redirect(`${PAGE}?melding=startet`);
}

export async function restartRound(roundId: number) {
  const actor = await requireOperator();

  const problem = await db.transaction(async (tx) => {
    if ((await lockRound(tx, roundId)) !== "started") return "status" as const;
    return buildGroups(tx, roundId);
  });

  if (problem === "status") redirect(`${PAGE}?melding=feil-status`);
  if (problem !== null) redirectWithBadCount(problem);
  await logAction(
    actor,
    "runde.restartet",
    `Restartet runden ${await roundLabel(roundId)} (grupper og kamper satt opp på nytt)`,
  );
  redirect(`${PAGE}?melding=restartet`);
}

/**
 * Setter runden tilbake til slik den var før «Start runde»: grupper, kamper og registrerte
 * resultater slettes, statusen blir åpen igjen, og spillerne kan melde seg på og av.
 * Påmeldingene beholdes. Går ikke for runder på en torsdag som har vært, for da ville
 * runden blitt liggende åpen uten å være neste runde.
 */
export async function resetRound(roundId: number) {
  const actor = await requireOperator();

  const problem = await db.transaction(async (tx) => {
    const [round] = await tx
      .select({ status: schema.rounds.status, playedOn: schema.rounds.playedOn })
      .from(schema.rounds)
      .where(eq(schema.rounds.id, roundId))
      .for("update");
    if (round?.status !== "started") return "feil-status";
    if (round.playedOn < osloToday()) return "reset-for-sent";
    // Kampene og spillerne i gruppene slettes sammen med gruppene (ON DELETE CASCADE).
    await tx.delete(schema.roundGroups).where(eq(schema.roundGroups.roundId, roundId));
    await tx.delete(schema.matches).where(eq(schema.matches.roundId, roundId));
    await tx.update(schema.rounds).set({ status: "open" }).where(eq(schema.rounds.id, roundId));
    return null;
  });

  if (problem) redirect(`${PAGE}?melding=${problem}`);
  await logAction(
    actor,
    "runde.reset",
    `Resatte runden ${await roundLabel(roundId)} til før start (grupper, kamper og resultater slettet)`,
  );
  redirect(`${PAGE}?melding=reset`);
}

/** Avslutter runden: lager resultatlisten og oppdaterer rankingen. Krever resultat i alle kamper. */
export async function finishRound(roundId: number) {
  const actor = await requireOperator();

  const outcome = await db.transaction(async (tx) => {
    if ((await lockRound(tx, roundId)) !== "started") return "feil-status";
    if ((await countMissingResults(tx, roundId)) > 0) return "mangler-resultater";
    await saveRoundResults(tx, roundId);
    await tx.update(schema.rounds).set({ status: "finished" }).where(eq(schema.rounds.id, roundId));
    return "avsluttet";
  });

  if (outcome === "avsluttet") {
    await logAction(actor, "runde.avsluttet", `Avsluttet runden ${await roundLabel(roundId)}`);
  }
  redirect(
    outcome === "avsluttet" ? `/admin/resultater/${roundId}?melding=avsluttet` : `${PAGE}?melding=${outcome}`,
  );
}

/** Regner ut resultatlisten og rankingen for en avsluttet runde på nytt. */
export async function recomputeRoundResults(roundId: number) {
  const actor = await requireOperator();
  const page = `/admin/resultater/${roundId}`;

  const ok = await db.transaction(async (tx) => {
    await lockRound(tx, roundId);
    if (await finishedRoundEditProblem(tx, roundId)) return false;
    await saveRoundResults(tx, roundId);
    return true;
  });

  if (ok) {
    await logAction(
      actor,
      "runde.beregnet",
      `Beregnet resultatliste og ranking på nytt for ${await roundLabel(roundId)}`,
    );
  }
  redirect(`${page}?melding=${ok ? "beregnet" : "kan-ikke-endres"}`);
}

/**
 * Velger kampformat (best av 3 eller 5 sett) for runden på datoen.
 * Kan ikke endres etter at et resultat er registrert, siden resultatene da ville blitt ugyldige.
 */
export async function setRoundFormat(date: string, formData: FormData) {
  const actor = await requireOperator();
  const bestOf = Number(formData.get("bestOf"));
  if (!BEST_OF_OPTIONS.includes(bestOf as BestOf)) redirect(`${SETTINGS_PAGE}&melding=ukjent-format`);

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

  if (outcome === "format") {
    await logAction(actor, "runde.format", `Satte kampformat best av ${bestOf} sett for ${formatRoundDate(date)}`);
  }
  redirect(`${SETTINGS_PAGE}&melding=${outcome}`);
}

/**
 * Setter maks antall spillere i runden før den er startet. De som er påmeldt utover
 * antallet, står på venteliste; øker antallet, rykker de første på ventelisten opp.
 */
export async function setRoundMaxPlayers(date: string, formData: FormData) {
  const actor = await requireOperator();
  const maxPlayers = Number(formData.get("maxPlayers"));
  if (!Number.isInteger(maxPlayers) || maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS_LIMIT) {
    redirect(`${SETTINGS_PAGE}&melding=ukjent-antall`);
  }

  const outcome = await db.transaction(async (tx) => {
    const round = await ensureRound(tx, date);
    if ((await lockRound(tx, round.id)) !== "open") return "feil-status";
    await tx.update(schema.rounds).set({ maxPlayers }).where(eq(schema.rounds.id, round.id));
    return "maks";
  });

  if (outcome === "maks") {
    await logAction(actor, "runde.maks", `Satte maks ${maxPlayers} spillere for ${formatRoundDate(date)}`);
  }
  redirect(`${SETTINGS_PAGE}&melding=${outcome}`);
}

/** Setter påmeldingsfristen for runden: så mange dager før, kl. et klokkeslett i norsk tid. */
export async function setRoundDeadline(date: string, formData: FormData) {
  const actor = await requireOperator();
  const signupDeadlineDays = Number(formData.get("signupDeadlineDays"));
  const signupDeadlineTime = String(formData.get("signupDeadlineTime") ?? "").slice(0, 5);
  if (!Number.isInteger(signupDeadlineDays) || signupDeadlineDays < 0 || signupDeadlineDays > MAX_DEADLINE_DAYS) {
    redirect(`${SETTINGS_PAGE}&melding=ukjent-frist`);
  }
  if (!isTime(signupDeadlineTime)) redirect(`${SETTINGS_PAGE}&melding=ukjent-tid`);

  const outcome = await db.transaction(async (tx) => {
    const round = await ensureRound(tx, date);
    if ((await lockRound(tx, round.id)) !== "open") return "feil-status";
    await tx
      .update(schema.rounds)
      .set({ signupDeadlineDays, signupDeadlineTime })
      .where(eq(schema.rounds.id, round.id));
    return "frist";
  });

  if (outcome === "frist") {
    const deadline = formatDeadline(signupDeadline(date, signupDeadlineDays, signupDeadlineTime));
    await logAction(actor, "runde.frist", `Satte påmeldingsfristen for ${formatRoundDate(date)} til ${deadline}`);
  }
  redirect(`${SETTINGS_PAGE}&melding=${outcome}`);
}

/** Setter når ligaen spilles på datoen, med en valgfri melding til spillerne. */
export async function setRoundTime(date: string, formData: FormData) {
  const actor = await requireOperator();
  const startsAt = String(formData.get("startsAt") ?? "").slice(0, 5);
  const endsAt = String(formData.get("endsAt") ?? "").slice(0, 5);
  const timeNote = String(formData.get("timeNote") ?? "").trim().slice(0, 300) || null;
  if (!isTime(startsAt) || !isTime(endsAt)) redirect(`${SETTINGS_PAGE}&melding=ukjent-tid`);
  if (startsAt >= endsAt) redirect(`${SETTINGS_PAGE}&melding=tid-rekkefolge`);

  const outcome = await db.transaction(async (tx) => {
    const round = await ensureRound(tx, date);
    if ((await lockRound(tx, round.id)) === "finished") return "feil-status";
    await tx.update(schema.rounds).set({ startsAt, endsAt, timeNote }).where(eq(schema.rounds.id, round.id));
    return "tid";
  });

  if (outcome === "tid") {
    await logAction(
      actor,
      "runde.tid",
      `Satte tiden ${startsAt}–${endsAt} for ${formatRoundDate(date)}${timeNote ? `: «${timeNote}»` : ""}`,
    );
  }
  redirect(`${SETTINGS_PAGE}&melding=${outcome}`);
}

/** Legger en spiller til neste runde før den er startet. Er runden full, havner spilleren på venteliste. */
export async function addToRound(date: string, playerId: number) {
  const actor = await requireOperator();

  const ok = await db.transaction(async (tx) => {
    const round = await ensureRound(tx, date);
    if (round.status !== "open") return false;
    await tx.insert(schema.roundSignups).values({ roundId: round.id, playerId }).onConflictDoNothing();
    return true;
  });

  if (ok) {
    await logAction(
      actor,
      "runde.spiller-lagt-til",
      `La ${await playerLabel(playerId)} til runden ${formatRoundDate(date)}`,
    );
  }
  redirect(`${PAGE}?melding=${ok ? "lagt-til" : "feil-status"}`);
}

/**
 * Fjerner en spiller fra runden, f.eks. ved «no show». Virker både før og etter
 * at runden er startet. Neste på ventelisten rykker da opp i påmeldingslisten.
 */
export async function removeFromRound(roundId: number, playerId: number, fromEdit: boolean) {
  const actor = await requireOperator();

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

  await logAction(
    actor,
    "runde.spiller-fjernet",
    `Fjernet ${await playerLabel(playerId)} fra runden ${await roundLabel(roundId)}`,
  );
  redirect(fromEdit ? `${EDIT_PAGE}&melding=fjernet` : `${PAGE}?melding=fjernet`);
}

/** Flytter en spiller til gruppen som er valgt i skjemaet (gruppens id, også på tvers av ligaene). */
export async function movePlayer(roundId: number, playerId: number, formData: FormData) {
  const actor = await requireOperator();
  const groupId = Number(formData.get("group"));

  const moved = await db.transaction(async (tx) => {
    const [group] = Number.isSafeInteger(groupId)
      ? await tx
          .select({ id: schema.roundGroups.id, league: schema.roundGroups.league, number: schema.roundGroups.number })
          .from(schema.roundGroups)
          .where(and(eq(schema.roundGroups.roundId, roundId), eq(schema.roundGroups.id, groupId)))
      : [];
    if (!group) return null;
    const oldGroupId = await groupOf(tx, roundId, playerId);
    await tx
      .update(schema.roundGroupPlayers)
      .set({ groupId: group.id })
      .where(
        and(eq(schema.roundGroupPlayers.roundId, roundId), eq(schema.roundGroupPlayers.playerId, playerId)),
      );
    await regenerate(tx, roundId, [oldGroupId, group.id]);
    return groupLabel(group.league, group.number);
  });

  if (moved) {
    await logAction(
      actor,
      "runde.spiller-flyttet",
      `Flyttet ${await playerLabel(playerId)} til ${moved.toLowerCase()} (${await roundLabel(roundId)})`,
    );
  }
  redirect(`${EDIT_PAGE}&melding=${moved ? "flyttet" : "ukjent-gruppe"}`);
}

/** Legger spilleren som er valgt i skjemaet til en gruppe, og melder spilleren på runden. */
export async function addToGroup(roundId: number, groupId: number, formData: FormData) {
  const actor = await requireOperator();
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

  const [group] = await db
    .select({ league: schema.roundGroups.league, number: schema.roundGroups.number })
    .from(schema.roundGroups)
    .where(eq(schema.roundGroups.id, groupId));
  await logAction(
    actor,
    "runde.spiller-lagt-i-gruppe",
    `La ${await playerLabel(playerId)} til i ${group ? groupLabel(group.league, group.number).toLowerCase() : "gruppe ?"} (${await roundLabel(roundId)})`,
  );
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

/** Logger en avlysning hvis den gikk gjennom (`outcome` er da antall slettede påmeldinger). */
async function logCancel(actor: Actor, date: string, formData: FormData, outcome: string | number) {
  if (typeof outcome !== "number") return;
  const reason = cancelMessage(formData);
  await logAction(
    actor,
    "avlysning.lagt-til",
    `Avlyste ${formatRoundDate(date)}${reason ? `: «${reason}»` : ""}${
      cancelHidden(formData) ? " (skjult for spillerne)" : ""
    }${outcome > 0 ? `, ${outcome} påmeldinger slettet` : ""}`,
  );
}

/** Tilbake til Ligarunde → Innstillinger, eller til `page` (f.eks. Admin → Innstillinger). */
function redirectAfterCancel(outcome: string | number, page: string = SETTINGS_PAGE): never {
  const sep = page.includes("?") ? "&" : "?";
  if (typeof outcome === "string") redirect(`${page}${sep}melding=${outcome}`);
  redirect(`${page}${sep}melding=avlyst&slettet=${outcome}`);
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
  const actor = await requireOperator();
  const outcome = await cancelThursday(date, cancelMessage(formData), cancelHidden(formData));
  await logCancel(actor, date, formData, outcome);
  redirectAfterCancel(outcome);
}

/** Legger inn en torsdag uten liga fra skjemaet (dato og valgfri melding). Finnes datoen, oppdateres meldingen. */
export async function addCancelledDate(formData: FormData) {
  const actor = await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const outcome = await cancelThursday(date, cancelMessage(formData), cancelHidden(formData));
  await logCancel(actor, date, formData, outcome);
  redirectAfterCancel(outcome, ADMIN_SETTINGS_PAGE);
}

/** Endrer meldingen og om avlysningen vises for spillerne. */
export async function updateCancelledDate(date: string, formData: FormData) {
  const actor = await requireAdmin();
  await db
    .update(schema.cancelledDates)
    .set({ reason: cancelMessage(formData), hidden: cancelHidden(formData) })
    .where(eq(schema.cancelledDates.date, date));
  await logAction(
    actor,
    "avlysning.endret",
    `Endret avlysningen ${formatRoundDate(date)}${cancelHidden(formData) ? " (skjult for spillerne)" : ""}`,
  );
  redirect(`${ADMIN_SETTINGS_PAGE}?melding=avlysning-endret`);
}

/** Åpner en avlyst torsdag igjen. */
export async function removeCancelledDate(date: string) {
  const actor = await requireAdmin();
  await db.delete(schema.cancelledDates).where(eq(schema.cancelledDates.date, date));
  await logAction(actor, "avlysning.fjernet", `Fjernet avlysningen ${formatRoundDate(date)}`);
  redirect(`${ADMIN_SETTINGS_PAGE}?melding=gjenapnet`);
}
