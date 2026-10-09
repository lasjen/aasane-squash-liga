"use client";

import { useFormStatus } from "react-dom";

import { deletePlayer, updateRanking } from "@/app/actions/admin-players";

function PendingButton({ children, pendingText, className }: { children: string; pendingText: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

export function DeletePlayerButton({ playerId, name }: { playerId: number; name: string }) {
  return (
    <form
      action={deletePlayer.bind(null, playerId)}
      onSubmit={(e) => {
        const ok = confirm(
          `Slette ${name}?\n\nHar spilleren spilt kamper eller vært i en divisjon, blir spilleren deaktivert i stedet, så resultatene beholdes.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      <PendingButton
        pendingText="Sletter …"
        className="font-medium text-red-700 underline disabled:opacity-60 dark:text-red-400"
      >
        Slett
      </PendingButton>
    </form>
  );
}

export function UpdateRankingButton() {
  return (
    <form action={updateRanking}>
      <PendingButton
        pendingText="Oppdaterer …"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Oppdater ranking
      </PendingButton>
    </form>
  );
}
