"use client";

import { useState } from "react";

import { activatePlayer, deactivatePlayer, updateRanking } from "@/app/actions/admin-players";
import { PendingButton } from "@/components/pending-button";

/**
 * «Slett» setter spilleren på pause. Bekreftelsen vises i raden i stedet for
 * med window.confirm, som ikke virker i alle nettlesere og innebygde visninger.
 */
export function DeactivatePlayerButton({ playerId, name }: { playerId: number; name: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-medium text-red-700 underline dark:text-red-400"
      >
        Slett
      </button>
    );
  }

  return (
    <form action={deactivatePlayer.bind(null, playerId)} className="flex items-center gap-2">
      <span className="text-zinc-600 dark:text-zinc-400">Sette {name} på pause?</span>
      <PendingButton
        pendingText="Lagrer …"
        className="rounded bg-red-700 px-2 py-0.5 font-medium text-white disabled:opacity-60 dark:bg-red-500"
      >
        Bekreft
      </PendingButton>
      <button type="button" onClick={() => setConfirming(false)} className="font-medium underline">
        Avbryt
      </button>
    </form>
  );
}

export function ActivatePlayerButton({ playerId }: { playerId: number }) {
  return (
    <form action={activatePlayer.bind(null, playerId)}>
      <PendingButton pendingText="Lagrer …" className="font-medium underline disabled:opacity-60">
        Aktiver
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
