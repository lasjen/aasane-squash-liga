import type { Metadata } from "next";
import { Suspense } from "react";

import { FinishedRoundList } from "@/components/round-results";
import { requireAdmin } from "@/lib/auth/admin-session";

export const metadata: Metadata = { title: "Resultater – Admin – Torsdagsligaen" };

export default function AdminResultsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Resultater</h1>
      <Suspense fallback={<p className="text-zinc-500">Henter runder …</p>}>
        <Rounds />
      </Suspense>
    </main>
  );
}

async function Rounds() {
  await requireAdmin();
  return <FinishedRoundList basePath="/admin/resultater" />;
}
