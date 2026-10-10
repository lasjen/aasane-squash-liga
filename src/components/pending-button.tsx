"use client";

import { useFormStatus } from "react-dom";

/** Send-knapp som viser `pendingText` og er deaktivert mens skjemaet sendes. */
export function PendingButton({
  children,
  pendingText,
  className,
}: {
  children: string;
  pendingText: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
