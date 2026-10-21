import type { Metadata } from "next";
import { Suspense } from "react";

import { addCancelledDate, removeCancelledDate, updateCancelledDate } from "@/app/actions/admin-round";
import { saveLeagueSettings } from "@/app/actions/admin-settings";
import { PendingButton } from "@/components/pending-button";
import { requireAdmin } from "@/lib/auth/admin-session";
import { deadlineLabel, formatRoundDate, MAX_DEADLINE_DAYS, osloToday } from "@/lib/dates";
import { MAX_PLAYERS_LIMIT, MIN_PLAYERS } from "@/lib/groups";
import { getLeagueSettings } from "@/lib/league-settings";
import { getUpcomingCancellations } from "@/lib/rounds";
import { BEST_OF_OPTIONS } from "@/lib/score";

import { CancelledDateRow } from "./cancelled-date-row";

export const metadata: Metadata = { title: "Innstillinger – Konsoll – Torsdagsligaen" };

type Params = Record<string, string | string[] | undefined>;

/** Faste meldinger. Bare kjente nøkler vises, aldri tekst fra URL-en. */
const MESSAGES: Record<string, (params: Params) => string> = {
  lagret: () => "Innstillingene er lagret.",
  "ukjent-antall": () => `Maks antall spillere må være mellom ${MIN_PLAYERS} og ${MAX_PLAYERS_LIMIT}.`,
  "ukjent-format": () => "Velg best av 3 eller best av 5 sett.",
  "ukjent-tid": () => "Skriv klokkeslettene som tt:mm.",
  "tid-rekkefolge": () => "Slutten må være etter starten.",
  "ukjent-frist": () => `Påmeldingsfristen må være mellom 0 og ${MAX_DEADLINE_DAYS} dager før runden.`,
  avlyst: (params) => {
    const removed = Number(params.slettet) || 0;
    return `Torsdagen er avlyst${
      removed > 0 ? `, og ${removed} ${removed === 1 ? "påmelding" : "påmeldinger"} ble slettet` : ""
    }.`;
  },
  "ikke-torsdag": () => "Velg en gyldig torsdag.",
  "dato-passert": () => "Datoen har allerede vært.",
  "runde-startet": () => "Runden den dagen er allerede startet, og kan ikke avlyses.",
  gjenapnet: () => "Avlysningen er fjernet, og datoen er åpen for liga igjen.",
  "avlysning-endret": () => "Avlysningen er endret.",
};

const input = "rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900";
const hint = "text-zinc-600 dark:text-zinc-400";
const secondaryButton =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900";

export default function AdminSettingsPage({ searchParams }: PageProps<"/admin/innstillinger">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <Suspense fallback={<p className="text-zinc-500">Henter innstillingene …</p>}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Settings({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const [params, settings] = await Promise.all([searchParams, getLeagueSettings()]);
  const message = typeof params.melding === "string" ? MESSAGES[params.melding]?.(params) : undefined;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Innstillinger</h1>
        <p className={hint}>Standardverdier for ligaen. Bare admin kan endre dem.</p>
      </div>

      {message && (
        <p
          role="status"
          className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {message}
        </p>
      )}

      <form action={saveLeagueSettings} className="flex max-w-xl flex-col gap-5 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Maks antall deltakere</span>
          <input
            type="number"
            name="maxPlayers"
            required
            min={MIN_PLAYERS}
            max={MAX_PLAYERS_LIMIT}
            defaultValue={settings.maxPlayers}
            className={`${input} w-24`}
          />
          <span className={hint}>De som melder seg på etter dette, står på venteliste.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Kampformat</span>
          <select name="bestOf" defaultValue={settings.bestOf} className={`${input} w-fit`}>
            {BEST_OF_OPTIONS.map((n) => (
              <option key={n} value={n}>
                Best av {n} sett
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-medium">Klokkeslett</legend>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1">
              <span>Fra</span>
              <input type="time" name="startsAt" required defaultValue={settings.startsAt} className={input} />
            </label>
            <label className="flex flex-col gap-1">
              <span>Til</span>
              <input type="time" name="endsAt" required defaultValue={settings.endsAt} className={input} />
            </label>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-medium">Påmeldingsfrist</legend>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1">
              <span>Dager før runden</span>
              <select name="signupDeadlineDays" defaultValue={settings.signupDeadlineDays} className={input}>
                {Array.from({ length: MAX_DEADLINE_DAYS + 1 }, (_, days) => (
                  <option key={days} value={days}>
                    {deadlineLabel(days)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span>Klokkeslett</span>
              <input
                type="time"
                name="signupDeadlineTime"
                required
                defaultValue={settings.signupDeadlineTime}
                className={input}
              />
            </label>
          </div>
          <span className={hint}>
            Etter fristen viser Påmelding runden uken etter. På runden der fristen har gått ut, kan
            spillerne fortsatt sette seg på venteliste, eller ta en ledig plass hvis den ikke er full.
          </span>
        </fieldset>

        <p className={hint}>
          Verdiene gjelder runder som opprettes etter at du lagrer. En runde som allerede har
          påmeldinger, endrer du under Ligarunde → Innstillinger.
        </p>

        <PendingButton
          pendingText="Lagrer …"
          className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Lagre
        </PendingButton>
      </form>

      <CancelledDates />
    </>
  );
}

/** Kommende torsdager uten liga, med mulighet for å legge til og fjerne datoer. */
async function CancelledDates() {
  const cancellations = await getUpcomingCancellations({ includeHidden: true });

  return (
    <section className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="font-semibold">Torsdager uten liga</h2>
      {cancellations.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Ingen kommende torsdager er avlyst.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {cancellations.map((c) => (
            <CancelledDateRow
              key={c.date}
              dateLabel={formatRoundDate(c.date)}
              reason={c.reason}
              hidden={c.hidden}
              updateAction={updateCancelledDate.bind(null, c.date)}
              removeAction={removeCancelledDate.bind(null, c.date)}
            />
          ))}
        </ul>
      )}
      <form action={addCancelledDate} className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Dato (torsdag)</span>
          <input
            type="date"
            name="date"
            required
            min={osloToday()}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="font-medium">Melding til spillerne (valgfritt)</span>
          <input
            type="text"
            name="reason"
            maxLength={300}
            placeholder="F.eks. Høstferie"
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex items-center gap-2 self-center">
          <input type="checkbox" name="hidden" className="size-4 accent-zinc-900 dark:accent-zinc-100" />
          Ikke vis for spillerne
        </label>
        <PendingButton pendingText="Legger til …" className={secondaryButton}>
          Legg til
        </PendingButton>
      </form>
    </section>
  );
}

