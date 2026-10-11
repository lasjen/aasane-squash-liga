import Link from "next/link";
import { Suspense } from "react";

import { getCurrentPlayer } from "@/lib/auth/session";
import { formatRoundDate } from "@/lib/dates";
import { MAX_PLAYERS } from "@/lib/groups";
import { LEVEL_LABELS, LEVELS } from "@/lib/player-options";
import {
  findNextRound,
  findStartedRound,
  getSignups,
  getUpcomingCancellations,
  playerHomePath,
} from "@/lib/rounds";
import { DEFAULT_BEST_OF } from "@/lib/score";

const primaryButton =
  "rounded-md bg-zinc-900 px-5 py-2.5 font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
const secondaryButton =
  "rounded-md border border-zinc-300 px-5 py-2.5 font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

const steps = [
  {
    title: "Meld deg på",
    text: `Lag en bruker og meld deg på torsdagene du kan spille. Det er plass til ${MAX_PLAYERS} spillere, og resten står på venteliste.`,
  },
  {
    title: "Spill i gruppe",
    text: `Du spiller i en gruppe på tre eller fire med spillere nær deg på rankingen. Kampene er best av ${DEFAULT_BEST_OF} sett.`,
  },
  {
    title: "Registrer resultatet",
    text: "Legg inn resultatet på mobilen rett etter kampen. Motspilleren bekrefter.",
  },
  {
    title: "Klatre på rankingen",
    text: "Gruppevinnerne rykker opp, og rankingen oppdateres automatisk etter hver runde.",
  },
];

const features = [
  {
    title: "Jevne kamper",
    text: "Gruppene settes opp etter ranking, så du møter spillere på ditt eget nivå hver gang.",
  },
  {
    title: "En ranking som lever",
    text: "Vinner du gruppen, rykker du opp. Alle runder og resultater ligger lagret, så du kan følge utviklingen.",
  },
  {
    title: "Alt på mobilen",
    text: "Påmelding, gruppeoppsett, kamper og resultater samlet på ett sted, uten lister og lapper.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-14 px-4 py-12 sm:py-16">
      <section className="flex flex-col gap-5">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Åsane Squash Klubb
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Torsdagsligaen</h1>
        <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Fast squash hver torsdag. Spill mot spillere på ditt nivå, klatre på rankingen og
          følg alle resultatene i appen.
        </p>
        <Suspense fallback={<div className="h-11" />}>
          <CallToAction />
        </Suspense>
      </section>

      <Suspense
        fallback={<div className="h-32 rounded-xl border border-zinc-200 dark:border-zinc-800" />}
      >
        <NextRound />
      </Suspense>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Slik fungerer det</h2>
        <ol className="grid gap-6 sm:grid-cols-2">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-zinc-50 p-6 sm:p-8 dark:bg-zinc-900">
        <h2 className="text-2xl font-semibold tracking-tight">For alle nivåer</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Når du registrerer deg, oppgir du nivået ditt. Det gir deg en startplass på rankingen.
          Etter det er det resultatene som teller.
        </p>
        <ul className="flex flex-wrap gap-2">
          {LEVELS.map((level) => (
            <li
              key={level}
              className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {LEVEL_LABELS[level]}
            </li>
          ))}
        </ul>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Lurer du på hvordan grupper, kamper og opprykk fungerer?{" "}
          <Link href="/regler" className="font-medium text-zinc-900 underline dark:text-zinc-100">
            Les reglene
          </Link>
        </p>
      </section>
    </main>
  );
}

/** Knapper i toppen: registrering og innlogging, eller rett til egne sider når du er innlogget. */
async function CallToAction() {
  const player = await getCurrentPlayer();

  if (player) {
    const home = await playerHomePath();
    return (
      <div className="flex flex-wrap items-center gap-4">
        <Link href={home} className={primaryButton}>
          {home === "/liga" ? "Gå til ligarunden" : "Gå til påmelding"}
        </Link>
        <p className="text-zinc-600 dark:text-zinc-400">Hei, {player.firstName}!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Link href="/registrer" className={primaryButton}>
        Registrer deg
      </Link>
      <Link href="/logg-inn" className={secondaryButton}>
        Logg inn
      </Link>
    </div>
  );
}

/** Neste runde: dato, ledige plasser og eventuelle avlysninger. Viser runden som pågår, hvis det er en. */
async function NextRound() {
  const started = await findStartedRound();
  if (started) {
    return (
      <section className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Runde i gang nå
        </p>
        <p className="text-2xl font-semibold tracking-tight first-letter:uppercase">
          {formatRoundDate(started.playedOn)}
        </p>
        <p className="text-zinc-600 dark:text-zinc-400">
          Gruppene og kampene er satt opp. Logg inn for å se kampene og registrere resultater.
        </p>
      </section>
    );
  }

  const [{ date, round }, cancellations] = await Promise.all([
    findNextRound(),
    getUpcomingCancellations(),
  ]);
  const signedUp = round ? (await getSignups(round.id)).length : 0;
  const taken = Math.min(signedUp, MAX_PLAYERS);
  const waitlist = Math.max(signedUp - MAX_PLAYERS, 0);
  const skipped = cancellations.filter((c) => c.date < date);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      {skipped.map((c) => (
        <p
          key={c.date}
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950"
        >
          <span className="inline-block font-medium first-letter:uppercase">{formatRoundDate(c.date)}</span>{" "}
          er avlyst.{c.reason && ` ${c.reason}`}
        </p>
      ))}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Neste runde</p>
          <p className="text-2xl font-semibold tracking-tight first-letter:uppercase">
            {formatRoundDate(date)}
          </p>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {taken} av {MAX_PLAYERS} plasser tatt
          {waitlist > 0 && ` · ${waitlist} på venteliste`}
        </p>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-label="Påmeldte spillere"
        aria-valuemin={0}
        aria-valuemax={MAX_PLAYERS}
        aria-valuenow={taken}
      >
        <div
          className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
          style={{ width: `${(taken / MAX_PLAYERS) * 100}%` }}
        />
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {taken >= MAX_PLAYERS
          ? "Runden er full, men du kan fortsatt sette deg på venteliste."
          : "Påmeldingen er åpen helt til runden starter."}
      </p>
    </section>
  );
}
