"use client";

import { useState } from "react";

import { PendingButton } from "@/components/pending-button";

const linkButton = "text-sm font-medium underline disabled:opacity-60";
const inputClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900";

/** En torsdag uten liga i admin-listen, med «Endre» (melding og synlighet) og «Fjern». */
export function CancelledDateRow({
  dateLabel,
  reason,
  hidden,
  updateAction,
  removeAction,
}: {
  dateLabel: string;
  reason: string | null;
  hidden: boolean;
  updateAction: (formData: FormData) => Promise<void>;
  removeAction: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="flex flex-col gap-2 px-4 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-block font-medium first-letter:uppercase">{dateLabel}</span>
        <span className="flex-1 text-sm text-zinc-500">
          {reason}
          {hidden && <span className="ml-1 text-amber-700 dark:text-amber-400">(skjult for spillerne)</span>}
        </span>
        {!editing && (
          <>
            <button type="button" onClick={() => setEditing(true)} className={linkButton}>
              Endre
            </button>
            <form action={removeAction}>
              <PendingButton
                pendingText="Fjerner …"
                className="text-sm font-medium text-red-700 underline disabled:opacity-60 dark:text-red-400"
              >
                Fjern
              </PendingButton>
            </form>
          </>
        )}
      </div>
      {editing && (
        <form action={updateAction} className="flex flex-col gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Melding til spillerne</span>
            <textarea name="reason" rows={2} maxLength={300} defaultValue={reason ?? ""} className={inputClass} />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="hidden"
              defaultChecked={hidden}
              className="size-4 accent-zinc-900 dark:accent-zinc-100"
            />
            Ikke vis avlysningen for spillerne
          </label>
          <div className="flex items-center gap-3">
            <PendingButton
              pendingText="Lagrer …"
              className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Lagre
            </PendingButton>
            <button type="button" onClick={() => setEditing(false)} className={linkButton}>
              Avbryt
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
