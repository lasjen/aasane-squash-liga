"use client";

import { useState } from "react";

import { PendingButton } from "@/components/pending-button";

/**
 * «Avlys denne torsdagen» med bekreftelse og en valgfri melding til spillerne.
 * Meldingen vises på påmeldingssiden.
 */
export function CancelRoundButton({
  action,
  dateLabel,
  signupCount,
}: {
  action: (formData: FormData) => Promise<void>;
  dateLabel: string;
  signupCount: number;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm font-medium text-red-700 underline dark:text-red-400"
      >
        Avlys denne torsdagen
      </button>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950"
    >
      <p>
        Avlyse {dateLabel}?{" "}
        {signupCount > 0 &&
          `${signupCount} ${signupCount === 1 ? "påmelding" : "påmeldinger"} slettes. `}
        Påmeldingen gjelder da neste torsdag med liga.
      </p>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Melding til spillerne (valgfritt)</span>
        <textarea
          name="reason"
          rows={2}
          maxLength={300}
          placeholder="F.eks. Banene er opptatt av turnering denne torsdagen."
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <div className="flex items-center gap-3">
        <PendingButton
          pendingText="Avlyser …"
          className="rounded bg-red-700 px-2.5 py-1 font-medium text-white disabled:opacity-60 dark:bg-red-500"
        >
          Ja, avlys
        </PendingButton>
        <button type="button" onClick={() => setOpen(false)} className="font-medium underline">
          Avbryt
        </button>
      </div>
    </form>
  );
}
