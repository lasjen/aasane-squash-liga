import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RoundResults } from "@/components/round-results";
import { getCurrentPlayer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Resultater – Torsdagsligaen" };

export default function RoundResultPage({ params }: PageProps<"/resultater/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/resultater" className="text-sm font-medium underline">
        ← Alle runder
      </Link>
      <Suspense fallback={<p className="text-zinc-500">Henter resultater …</p>}>
        <Results params={params} />
      </Suspense>
    </main>
  );
}

async function Results({ params }: { params: Promise<{ id: string }> }) {
  // Åpen for alle; innloggede spillere får sin egen rad uthevet.
  const me = await getCurrentPlayer();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  return (await RoundResults({ roundId: id, highlight: me?.id })) ?? notFound();
}
