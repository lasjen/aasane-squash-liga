"use server";

import { refresh } from "next/cache";

import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/admin-session";
import { requirePlayer } from "@/lib/auth/session";
import { confirmResult, lockMatch, saveResult } from "@/lib/match-results";
import { finishedRoundEditProblem, saveRoundResults } from "@/lib/round-results";
import { parseScore } from "@/lib/score";

export type ResultState = { error?: string; saved?: boolean } | undefined;

/**
 * Spilleren registrerer resultat for egen kamp, eller retter et resultat som ikke er bekreftet.
 * Resultatet venter deretter på at motspilleren bekrefter.
 */
export async function reportResult(
  matchId: number,
  _prev: ResultState,
  formData: FormData,
): Promise<ResultState> {
  const me = await requirePlayer();
  const error = await db.transaction(async (tx) => {
    const match = await lockMatch(tx, matchId);
    if (!match || match.roundStatus !== "started") return "Runden er ikke i gang lenger.";
    if (match.player1Id === null || match.player2Id === null) {
      return "Motstanderen er ikke klar ennå. Den avgjøres av de første kampene.";
    }
    if (me.id !== match.player1Id && me.id !== match.player2Id) {
      return "Du kan bare registrere resultat for egne kamper.";
    }
    if (match.confirmedAt) return "Resultatet er bekreftet. Kontakt en admin hvis det er feil.";
    const score = parseScore(formData.get("player1Games"), formData.get("player2Games"), match.bestOf);
    if (!score.ok) return score.error;

    await saveResult(
      tx,
      { id: match.id, groupId: match.groupId, player1Id: match.player1Id, player2Id: match.player2Id },
      score.player1Games,
      score.player2Games,
      me.id,
      false,
    );
    return null;
  });
  if (error) return { error };

  refresh();
  return { saved: true };
}

/** Motspilleren godtar resultatet den andre spilleren registrerte. */
export async function confirmMatchResult(matchId: number): Promise<void> {
  const me = await requirePlayer();

  await db.transaction(async (tx) => {
    const match = await lockMatch(tx, matchId);
    if (!match || match.roundStatus !== "started") return;
    const isPlayer = me.id === match.player1Id || me.id === match.player2Id;
    // Den som registrerte kan ikke bekrefte sitt eget resultat.
    if (!isPlayer || match.status !== "played" || match.confirmedAt || match.reportedById === me.id) return;
    await confirmResult(tx, match.id, me.id);
  });

  refresh();
}

/** Admin registrerer eller endrer resultatet. Det regnes som bekreftet med en gang. */
export async function adminSaveResult(
  matchId: number,
  _prev: ResultState,
  formData: FormData,
): Promise<ResultState> {
  const admin = await requireAdmin();
  const error = await db.transaction(async (tx) => {
    const match = await lockMatch(tx, matchId);
    if (!match || match.roundStatus !== "started") return "Runden er ikke i gang lenger.";
    if (match.player1Id === null || match.player2Id === null) {
      return "Spillerne i kampen er ikke klare ennå.";
    }
    const score = parseScore(formData.get("player1Games"), formData.get("player2Games"), match.bestOf);
    if (!score.ok) return score.error;
    await saveResult(
      tx,
      { id: match.id, groupId: match.groupId, player1Id: match.player1Id, player2Id: match.player2Id },
      score.player1Games,
      score.player2Games,
      admin.id,
      true,
    );
    return null;
  });
  if (error) return { error };

  refresh();
  return { saved: true };
}

/**
 * Admin registrerer eller retter et resultat i en avsluttet runde. Resultatlisten og
 * rankingen regnes ut på nytt fra rankingen før runden.
 */
export async function adminCorrectResult(
  matchId: number,
  _prev: ResultState,
  formData: FormData,
): Promise<ResultState> {
  const admin = await requireAdmin();
  const error = await db.transaction(async (tx) => {
    const match = await lockMatch(tx, matchId);
    if (!match) return "Fant ikke kampen.";
    const problem = await finishedRoundEditProblem(tx, match.roundId);
    if (problem) return problem;
    if (match.player1Id === null || match.player2Id === null) {
      return "Spillerne i kampen er ikke klare ennå. Registrer de første kampene i gruppen først.";
    }
    const score = parseScore(formData.get("player1Games"), formData.get("player2Games"), match.bestOf);
    if (!score.ok) return score.error;
    await saveResult(
      tx,
      { id: match.id, groupId: match.groupId, player1Id: match.player1Id, player2Id: match.player2Id },
      score.player1Games,
      score.player2Games,
      admin.id,
      true,
    );
    await saveRoundResults(tx, match.roundId);
    return null;
  });
  if (error) return { error };

  refresh();
  return { saved: true };
}
