"use client";

import { type ReactNode, useCallback, useState } from "react";

import type { ResultState } from "@/app/actions/results";
import { PendingButton } from "@/components/pending-button";
import { ScoreForm } from "@/components/score-form";
import { describeSource } from "@/lib/match-plan";
import type { MatchSide, RoundMatch } from "@/lib/round-matches";

const sideName = (side: MatchSide) => (side.kind === "player" ? side.name : describeSource(side.source));

/** En av spillerens egne kamper, med registrering, bekreftelse og retting av resultat. */
export function MyMatch({
  match,
  meId,
  bestOf,
  reportAction,
  confirmAction,
}: {
  match: RoundMatch;
  bestOf: number;
  meId: number;
  reportAction: (prev: ResultState, formData: FormData) => Promise<ResultState>;
  confirmAction: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const close = useCallback(() => setEditing(false), []);

  const p1 = sideName(match.player1);
  const p2 = sideName(match.player2);
  const opponent = match.player1.kind === "player" && match.player1.id === meId ? match.player2 : match.player1;
  const opponentName = opponent.kind === "player" ? opponent.name : "motstanderen";
  const ready = match.player1.kind === "player" && match.player2.kind === "player";
  const hasResult = match.player1Games !== null && match.player2Games !== null;
  const score = hasResult ? `${match.player1Games}–${match.player2Games}` : null;
  const reportedByMe = match.reportedById === meId;

  const form = (submitLabel: string, withCancel: boolean) => (
    <ScoreForm
      action={reportAction}
      player1Name={p1}
      player2Name={p2}
      bestOf={bestOf}
      defaultGames={[match.player1Games, match.player2Games]}
      submitLabel={submitLabel}
      onSaved={close}
      onCancel={withCancel ? close : undefined}
    />
  );

  let body: ReactNode;
  if (!ready) {
    body = (
      <p className="text-sm text-zinc-500">
        {match.pool === null && [match.player1, match.player2].some((x) => x.kind === "source" && "pool" in x.source)
          ? "Spillerne avgjøres når alle kampene i pulje A er spilt."
          : "Motstanderen avgjøres når de første kampene i gruppen er spilt."}
      </p>
    );
  } else if (!hasResult) {
    body = form("Registrer resultat", false);
  } else if (!match.awaitingConfirmation) {
    body = <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">✓ Resultatet er bekreftet</p>;
  } else if (editing) {
    body = form(reportedByMe ? "Lagre endring" : "Send rettet resultat", true);
  } else if (reportedByMe) {
    body = (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p className="text-amber-700 dark:text-amber-400">Venter på at {opponentName} bekrefter.</p>
        <button type="button" onClick={() => setEditing(true)} className="font-medium underline">
          Endre
        </button>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p>{opponentName} har registrert resultatet. Stemmer det?</p>
        <form action={confirmAction}>
          <PendingButton
            pendingText="Bekrefter …"
            className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Bekreft
          </PendingButton>
        </form>
        <button type="button" onClick={() => setEditing(true)} className="font-medium underline">
          Rett
        </button>
      </div>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm text-zinc-500">
          Kamp {match.number}
          {match.pool && ` · pulje ${match.pool}`}
        </span>
        <span className="font-medium">
          {p1} <span className="px-1 text-zinc-400">–</span> {p2}
        </span>
        {score && <span className="ml-auto text-lg font-semibold tabular-nums">{score}</span>}
      </div>
      {body}
    </li>
  );
}
