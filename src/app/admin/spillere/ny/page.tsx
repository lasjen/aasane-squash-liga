import type { Metadata } from "next";
import { Suspense } from "react";

import { createPlayer } from "@/app/actions/admin-players";
import { requireAdmin } from "@/lib/auth/admin-session";

import { PlayerForm } from "../player-form";

export const metadata: Metadata = { title: "Ny spiller – Admin – Torsdagsligaen" };

export default function NewPlayerPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Legg til ny spiller</h1>
      <Suspense fallback={null}>
        <NewPlayerForm />
      </Suspense>
    </main>
  );
}

async function NewPlayerForm() {
  await requireAdmin();
  return (
    <PlayerForm action={createPlayer} defaults={{ active: "on" }} submitLabel="Legg til spiller" isNew />
  );
}
