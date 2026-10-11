import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { recomputeRoundResults } from "@/app/actions/admin-round";
import { ConfirmButton } from "@/components/confirm-button";
import { RoundResults } from "@/components/round-results";
import { db } from "@/db";
import { requireOperator } from "@/lib/auth/admin-session";
import { finishedRoundEditProblem } from "@/lib/round-results";

export const metadata: Metadata = { title: "Resultater – Admin – Torsdagsligaen" };

export default function AdminRoundResultPage({
  params,
  searchParams,
}: PageProps<"/admin/resultater/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <Link href="/admin/resultater" className="text-sm font-medium underline">
        ← Alle runder
      </Link>
      <Suspense fallback={<p className="text-zinc-500">Henter resultater …</p>}>
        <Results params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const MESSAGES: Record<string, string> = {
  avsluttet:
    "Runden er avsluttet. Resultatlisten er laget, rankingen er oppdatert, og påmeldingen til neste runde er åpen.",
  beregnet: "Resultatlisten og rankingen er beregnet på nytt.",
  "kan-ikke-endres": "Runden kan ikke endres nå. Se forklaringen under.",
};

async function Results({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOperator();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const key = (await searchParams).melding;
  const message = typeof key === "string" ? MESSAGES[key] : undefined;

  const editProblem = await finishedRoundEditProblem(db, id);
  const results = await RoundResults({ roundId: id, adminEditable: editProblem === null });
  if (!results) notFound();

  return (
    <>
      {message && (
        <p role="status" className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          {message}
        </p>
      )}
      {editProblem === null ? (
        <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <p className="text-zinc-600 dark:text-zinc-400">
            Du kan registrere og rette resultater i denne runden. Resultatlisten og rankingen regnes
            da ut på nytt fra rankingen før runden.
          </p>
          <div>
            <ConfirmButton
              action={recomputeRoundResults.bind(null, id)}
              label="Beregn resultatliste og ranking på nytt"
              question="Regne ut resultatlisten og rankingen på nytt fra rankingen før runden?"
              confirmLabel="Ja, beregn"
              pendingText="Beregner …"
              className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">{editProblem}</p>
      )}
      {results}
    </>
  );
}
