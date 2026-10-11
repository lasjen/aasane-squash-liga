"use client";

import { useState } from "react";

import { deleteOldLogEntries } from "@/app/actions/audit";
import { PendingButton } from "@/components/pending-button";
import { LOG_RETENTION_OPTIONS, monthsLabel, type LogRetention } from "@/lib/log-retention";

const button =
  "rounded-md border border-zinc-300 px-3 py-1.5 font-medium transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900";

/**
 * Sletting av gamle logglinjer: velg alder, og bekreft. `counts` er hvor mange linjer
 * som er eldre enn hver av alderne, så bekreftelsen kan si hva som forsvinner.
 */
export function DeleteOldLogs({ counts }: { counts: Record<LogRetention, number> }) {
  const [months, setMonths] = useState<LogRetention>(6);
  const [confirming, setConfirming] = useState(false);
  const count = counts[months];

  return (
    <form action={deleteOldLogEntries} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="months" value={months} />
      <label htmlFor="slett-alder" className="font-medium">
        Slett linjer eldre enn
      </label>
      <select
        id="slett-alder"
        value={months}
        disabled={confirming}
        onChange={(e) => setMonths(Number(e.target.value) as LogRetention)}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {LOG_RETENTION_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {monthsLabel(m)} ({counts[m]} linjer)
          </option>
        ))}
      </select>
      {!confirming ? (
        <button type="button" disabled={count === 0} onClick={() => setConfirming(true)} className={button}>
          Slett
        </button>
      ) : (
        <span className="flex flex-wrap items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 dark:border-red-900 dark:bg-red-950">
          Slette {count} {count === 1 ? "linje" : "linjer"} eldre enn {monthsLabel(months)}? Dette kan
          ikke angres.
          <PendingButton
            pendingText="Sletter …"
            className="rounded bg-red-700 px-2 py-0.5 font-medium text-white disabled:opacity-60 dark:bg-red-500"
          >
            Ja, slett
          </PendingButton>
          <button type="button" onClick={() => setConfirming(false)} className="font-medium underline">
            Avbryt
          </button>
        </span>
      )}
    </form>
  );
}
