"use client";

import { useActionState, useEffect } from "react";

import type { ResultState } from "@/app/actions/results";
import { setsToWin } from "@/lib/score";

/**
 * Skjema for kampresultat: vunne sett for hver spiller, i samme rekkefølge som kampen vises.
 * `bestOf` er rundens kampformat (3 eller 5 sett).
 * `onSaved` kalles når resultatet er lagret, f.eks. for å lukke skjemaet.
 */
export function ScoreForm({
  action,
  player1Name,
  player2Name,
  bestOf,
  defaultGames,
  submitLabel,
  onSaved,
  onCancel,
}: {
  action: (prev: ResultState, formData: FormData) => Promise<ResultState>;
  player1Name: string;
  player2Name: string;
  bestOf: number;
  defaultGames?: [number | null, number | null];
  submitLabel: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const options = Array.from({ length: setsToWin(bestOf) + 1 }, (_, i) => i);

  useEffect(() => {
    if (state?.saved) onSaved?.();
  }, [state, onSaved]);

  const select = (name: string, label: string, value: number | null | undefined) => (
    <label className="flex items-center gap-2">
      <span className="min-w-0 truncate">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        aria-label={`Sett vunnet av ${label}`}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="" disabled>
          –
        </option>
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {select("player1Games", player1Name, defaultGames?.[0])}
        <span className="text-zinc-400">–</span>
        {select("player2Games", player2Name, defaultGames?.[1])}
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Lagrer …" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm font-medium underline">
            Avbryt
          </button>
        )}
      </div>
    </form>
  );
}
