import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { signUp, withdraw } from "@/app/actions/signup";
import { PendingButton } from "@/components/pending-button";
import { db, schema } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { formatRoundDate } from "@/lib/dates";
import { MAX_PLAYERS } from "@/lib/groups";
import { findNextRound, getSignups, getUpcomingCancellations } from "@/lib/rounds";

export const metadata: Metadata = { title: "Påmelding – Torsdagsligaen" };

/** Faste meldinger. Bare kjente nøkler vises, aldri tekst fra URL-en. */
const MESSAGES: Record<string, string> = {
  "runden-er-startet":
    "Runden du prøvde å melde deg på er allerede startet. Under ser du neste runde.",
  pause: "Du står på pause og kan ikke melde deg på. Kontakt en admin hvis du vil spille igjen.",
};

export default function SignupPage({ searchParams }: PageProps<"/pamelding">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p className="text-zinc-500">Henter neste runde …</p>}>
        <Signup searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Signup({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const player = await requirePlayer();
  const [{ date, round }, params, [me], cancellations] = await Promise.all([
    findNextRound(),
    searchParams,
    db
      .select({ active: schema.players.active })
      .from(schema.players)
      .where(eq(schema.players.id, player.id)),
    getUpcomingCancellations(),
  ]);
  const signups = round ? await getSignups(round.id) : [];
  const position = signups.findIndex((s) => s.playerId === player.id) + 1;
  const signedUp = position > 0;
  const onWaitlist = position > MAX_PLAYERS;
  const participants = signups.slice(0, MAX_PLAYERS);
  // Avlyste torsdager før neste runde vises som en notis, senere avlysninger som en liste.
  const skipped = cancellations.filter((c) => c.date < date);
  const later = cancellations.filter((c) => c.date > date);
  const waitlist = signups.slice(MAX_PLAYERS);
  const message = typeof params.melding === "string" ? MESSAGES[params.melding] : undefined;

  return (
    <>
      {message && (
        <p
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {message}
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Neste runde{round ? ` · runde ${round.number}` : ""}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">
            {formatRoundDate(date)}
          </h1>
        </div>

        {!me?.active ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            Du står på pause og kan ikke melde deg på. Kontakt en admin hvis du vil spille igjen.
          </p>
        ) : signedUp ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {onWaitlist ? (
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Du står på venteliste, plass {position - MAX_PLAYERS}. Du rykker opp hvis noen melder seg av.
              </p>
            ) : (
              <p className="font-medium text-emerald-700 dark:text-emerald-400">✓ Du er påmeldt</p>
            )}
            <form action={withdraw.bind(null, date)}>
              <PendingButton
                pendingText="Melder av …"
                className="rounded-md border border-zinc-300 px-4 py-2.5 font-medium transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Meld meg av
              </PendingButton>
            </form>
          </div>
        ) : (
          <form action={signUp.bind(null, date)}>
            <PendingButton
              pendingText="Melder på …"
              className="w-full rounded-md bg-zinc-900 px-4 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {participants.length >= MAX_PLAYERS ? "Sett meg på venteliste" : "Meld meg på"}
            </PendingButton>
            {participants.length >= MAX_PLAYERS && (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Runden er full med {MAX_PLAYERS} spillere.
              </p>
            )}
          </form>
        )}
      </section>

      {skipped.length > 0 && (
        <section
          role="status"
          className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950"
        >
          {skipped.map((c) => (
            <div key={c.date} className="flex flex-col gap-0.5">
              <p className="font-semibold">
                <span className="inline-block first-letter:uppercase">{formatRoundDate(c.date)}</span> er
                avlyst.
              </p>
              {c.reason && <p className="whitespace-pre-line">{c.reason}</p>}
            </div>
          ))}
        </section>
      )}

      {later.length > 0 && (
        <section className="flex flex-col gap-1 text-sm">
          <h2 className="font-medium text-zinc-600 dark:text-zinc-400">Senere torsdager uten liga</h2>
          <ul className="text-zinc-600 dark:text-zinc-400">
            {later.map((c) => (
              <li key={c.date}>
                <span className="inline-block first-letter:uppercase">{formatRoundDate(c.date)}</span>
                {c.reason && <span> – {c.reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">
          Påmeldte{" "}
          <span className="font-normal text-zinc-500">
            ({participants.length}/{MAX_PLAYERS})
          </span>
        </h2>
        {participants.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">Ingen har meldt seg på ennå.</p>
        ) : (
          <ol className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {participants.map((s, i) => (
              <li key={s.playerId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 text-right text-sm tabular-nums text-zinc-500">{i + 1}.</span>
                <span className={s.playerId === player.id ? "font-medium" : undefined}>
                  {s.firstName} {s.lastName}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {waitlist.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">
            Venteliste <span className="font-normal text-zinc-500">({waitlist.length})</span>
          </h2>
          <ol className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {waitlist.map((s, i) => (
              <li key={s.playerId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 text-right text-sm tabular-nums text-zinc-500">{i + 1}.</span>
                <span className={s.playerId === player.id ? "font-medium" : undefined}>
                  {s.firstName} {s.lastName}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
