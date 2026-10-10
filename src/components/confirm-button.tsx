"use client";

import { useState } from "react";

import { PendingButton } from "@/components/pending-button";

/**
 * Knapp som ber om bekreftelse før server-handlingen kjøres. Bekreftelsen vises
 * ved siden av knappen i stedet for med window.confirm, som ikke virker overalt.
 */
export function ConfirmButton({
  action,
  label,
  question,
  confirmLabel,
  pendingText,
  className,
}: {
  action: () => Promise<void>;
  label: string;
  question: string;
  confirmLabel: string;
  pendingText: string;
  className: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={className}>
        {label}
      </button>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950"
    >
      <span>{question}</span>
      <PendingButton
        pendingText={pendingText}
        className="rounded bg-red-700 px-2.5 py-1 font-medium text-white disabled:opacity-60 dark:bg-red-500"
      >
        {confirmLabel}
      </PendingButton>
      <button type="button" onClick={() => setConfirming(false)} className="font-medium underline">
        Avbryt
      </button>
    </form>
  );
}
