"use client";

import { useCallback, useState } from "react";

import type { ResultState } from "@/app/actions/results";
import { ScoreForm } from "@/components/score-form";
import { describeSource } from "@/lib/match-plan";
import type { MatchSide, RoundMatch } from "@/lib/round-matches";

const sideName = (side: MatchSide) => (side.kind === "player" ? side.name : describeSource(side.source));

/** En kamp i admin-oversikten, med resultat og mulighet for å registrere eller endre det. */
export function AdminMatch({
  match,
  bestOf,
  saveAction,
}: {
  match: RoundMatch;
  bestOf: number;
  saveAction: (prev: ResultState, formData: FormData) => Promise<ResultState>;
}) {
  const [editing, setEditing] = useState(false);
  const close = useCallback(() => setEditing(false), []);

  const p1 = sideName(match.player1);
  const p2 = sideName(match.player2);
  const ready = match.player1.kind === "player" && match.player2.kind === "player";
  const hasResult = match.player1Games !== null;

  return (
    <li className="flex flex-col gap-1.5 py-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="w-14 shrink-0 text-zinc-500">
          Kamp {match.number}
          {match.pool && <span className="block text-xs">Pulje {match.pool}</span>}
        </span>
        <span className={`flex-1 ${ready ? "" : "text-zinc-500 italic"}`}>
          {p1} <span className="px-1 text-zinc-400">–</span> {p2}
        </span>
        {hasResult && (
          <span className="font-semibold tabular-nums">
            {match.player1Games}–{match.player2Games}
          </span>
        )}
        {hasResult && (
          <span className={match.awaitingConfirmation ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}>
            {match.awaitingConfirmation ? "venter på bekreftelse" : "✓"}
          </span>
        )}
        {ready && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="font-medium underline">
            {hasResult ? "Endre" : "Registrer"}
          </button>
        )}
      </div>
      {editing && (
        <div className="pl-16">
          <ScoreForm
            action={saveAction}
            player1Name={p1}
            player2Name={p2}
            bestOf={bestOf}
            defaultGames={[match.player1Games, match.player2Games]}
            submitLabel="Lagre resultat"
            onSaved={close}
            onCancel={close}
          />
        </div>
      )}
    </li>
  );
}
