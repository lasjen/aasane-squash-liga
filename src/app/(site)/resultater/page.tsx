import type { Metadata } from "next";
import { Suspense } from "react";

import { FinishedRoundList } from "@/components/round-results";
import { requirePlayer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Resultater – Torsdagsligaen" };

export default function ResultsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Resultater</h1>
      <Suspense fallback={<p className="text-zinc-500">Henter runder …</p>}>
        <Rounds />
      </Suspense>
    </main>
  );
}

async function Rounds() {
  await requirePlayer();
  return <FinishedRoundList basePath="/resultater" />;
}
