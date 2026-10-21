import type { Metadata } from "next";
import { Suspense } from "react";

import { saveLeagueSettings } from "@/app/actions/admin-settings";
import { PendingButton } from "@/components/pending-button";
import { requireAdmin } from "@/lib/auth/admin-session";
import { deadlineLabel, MAX_DEADLINE_DAYS } from "@/lib/dates";
import { MAX_PLAYERS_LIMIT, MIN_PLAYERS } from "@/lib/groups";
import { getLeagueSettings } from "@/lib/league-settings";
import { BEST_OF_OPTIONS } from "@/lib/score";

export const metadata: Metadata = { title: "Innstillinger – Konsoll – Torsdagsligaen" };

/** Faste meldinger. Bare kjente nøkler vises, aldri tekst fra URL-en. */
const MESSAGES: Record<string, string> = {
  lagret: "Innstillingene er lagret.",
  "ukjent-antall": `Maks antall spillere må være mellom ${MIN_PLAYERS} og ${MAX_PLAYERS_LIMIT}.`,
  "ukjent-format": "Velg best av 3 eller best av 5 sett.",
  "ukjent-tid": "Skriv klokkeslettene som tt:mm.",
  "tid-rekkefolge": "Slutten må være etter starten.",
  "ukjent-frist": `Påmeldingsfristen må være mellom 0 og ${MAX_DEADLINE_DAYS} dager før runden.`,
};

const input = "rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900";
const hint = "text-zinc-600 dark:text-zinc-400";

export default function AdminSettingsPage({ searchParams }: PageProps<"/admin/innstillinger">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <Suspense fallback={<p className="text-zinc-500">Henter innstillingene …</p>}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Settings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const [params, settings] = await Promise.all([searchParams, getLeagueSettings()]);
  const message = typeof params.melding === "string" ? MESSAGES[params.melding] : undefined;

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
    </>
  );
}
