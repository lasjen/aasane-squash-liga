import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";

import {
  addToGroup,
  addToRound,
  cancelNextRound,
  finishRound,
  movePlayer,
  removeFromRound,
  resetRound,
  restartRound,
  setRoundFormat,
  setRoundDeadline,
  setRoundMaxPlayers,
  setRoundTime,
  startRound,
} from "@/app/actions/admin-round";
import { adminSaveResult } from "@/app/actions/results";
import { AdminMatch } from "@/components/admin-match";
import { ConfirmButton } from "@/components/confirm-button";
import { PendingButton } from "@/components/pending-button";
import { db, schema } from "@/db";
import { requireOperator } from "@/lib/auth/admin-session";
import {
  deadlineLabel,
  formatDeadline,
  formatRoundDate,
  formatRoundDateTime,
  formatTime,
  MAX_DEADLINE_DAYS,
  osloNow,
} from "@/lib/dates";
import { groupSizeProblem, MAX_PLAYERS_LIMIT, MIN_PLAYERS } from "@/lib/groups";
import { getLeagueSettings } from "@/lib/league-settings";
import { isWomensLeagueMember, LEAGUES, MIN_WOMENS_LEAGUE_PLAYERS, splitLeagues } from "@/lib/leagues";
import { BEST_OF_OPTIONS } from "@/lib/score";
import { getRoundMatches } from "@/lib/round-matches";
import { findAdminRound, getGroups, getSignups, roundDeadline } from "@/lib/rounds";

import { CancelRoundButton } from "./cancel-round-button";

export const metadata: Metadata = { title: "Ligarunde – Admin – Torsdagsligaen" };

type Params = Record<string, string | string[] | undefined>;

/** Faste meldinger. Bare kjente nøkler vises, aldri tekst fra URL-en. */
const MESSAGES: Record<string, (params: Params) => string> = {
  startet: () => "Runden er startet, og gruppene og kampene er satt opp.",
  restartet: () => "Gruppene og kampene er satt opp på nytt.",
  reset: () =>
    "Runden er satt tilbake til før start. Påmeldingen er åpen igjen, og du kan starte runden på nytt når du vil.",
  "reset-for-sent": () =>
    "Runden var en tidligere torsdag og kan ikke settes tilbake. Bruk «Restart runde» eller avslutt den.",
  "lagt-til": () => "Spilleren er lagt til.",
  fjernet: () => "Spilleren er fjernet fra runden.",
  flyttet: () => "Spilleren er flyttet.",
  "ukjent-gruppe": () => "Fant ikke gruppen.",
  "velg-spiller": () => "Velg en spiller å legge til.",
  "feil-status": () => "Runden har endret status i mellomtiden. Se oppdatert status under.",
  format: () => "Kampformatet er lagret.",
  tid: () => "Klokkeslettet er lagret.",
  maks: () => "Maks antall deltakere er lagret.",
  frist: () => "Påmeldingsfristen er lagret.",
  "ukjent-frist": () => `Påmeldingsfristen må være mellom 0 og ${MAX_DEADLINE_DAYS} dager før runden.`,
  "ukjent-antall": () => `Maks antall deltakere må være mellom ${MIN_PLAYERS} og ${MAX_PLAYERS_LIMIT}.`,
  "ukjent-tid": () => "Skriv klokkeslettene som tt:mm.",
  "tid-rekkefolge": () => "Slutten må være etter starten.",
  "mangler-resultater": () => "Runden kan ikke avsluttes før alle kampene har resultat.",
  avlyst: (params) => {
    const removed = Number(params.slettet) || 0;
    return `Torsdagen er avlyst${
      removed > 0 ? `, og ${removed} ${removed === 1 ? "påmelding" : "påmeldinger"} ble slettet` : ""
    }. Påmeldingen gjelder nå neste torsdag med liga.`;
  },
  "ikke-torsdag": () => "Velg en gyldig torsdag.",
  "dato-passert": () => "Datoen har allerede vært.",
  "runde-startet": () => "Runden den dagen er allerede startet, og kan ikke avlyses.",
  "format-laast": () => "Kampformatet kan ikke endres etter at det er registrert resultater.",
  "ukjent-format": () => "Velg best av 3 eller best av 5 sett.",
  antall: (params) =>
    groupSizeProblem(Number(params.antall)) ?? "Antallet spillere går ikke opp i grupper.",
};

const smallButton =
  "rounded-md border border-zinc-300 px-2.5 py-1 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900";
const primaryButton =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
const secondaryButton =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900";
const linkButton = "text-sm font-medium underline disabled:opacity-60";
const removeButton = "text-sm font-medium text-red-700 underline disabled:opacity-60 dark:text-red-400";

export default function AdminRoundPage({ searchParams }: PageProps<"/admin/runde">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <Suspense fallback={<p className="text-zinc-500">Henter runden …</p>}>
        <AdminRound searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AdminRound({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOperator();
  const params = await searchParams;
  const [{ date, round }, settings] = await Promise.all([findAdminRound(), getLeagueSettings()]);
  // Er runden ikke opprettet ennå, får den standardene fra Innstillinger.
  const startsAt = round?.startsAt ?? settings.startsAt;
  const endsAt = round?.endsAt ?? settings.endsAt;
  const maxPlayers = round?.maxPlayers ?? settings.maxPlayers;

  const deadline = roundDeadline({ date, round }, settings);
  const tab: Tab = params.fane === "innstillinger" ? "innstillinger" : "spillere";

  const key = typeof params.melding === "string" ? params.melding : undefined;
  const message = key && MESSAGES[key]?.(params);
  const started = round?.status === "started";
  const signupCount = !started && round ? (await getSignups(round.id)).length : 0;

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          {round ? `Runde ${round.number} · ` : ""}
          {started ? "i gang" : "påmelding åpen"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">
          {formatRoundDateTime(date, startsAt, endsAt)}
        </h1>
        {!started && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Påmeldingsfrist {formatDeadline(deadline)}
            {osloNow() >= deadline.at && " (gått ut)"}
          </p>
        )}
      </div>

      <RoundTabs tab={tab} />

      {message && (
        <p
          role="status"
          className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {message}
        </p>
      )}

      {tab === "innstillinger" ? (
        <>
          <FormatForm date={date} bestOf={round?.bestOf ?? settings.bestOf} roundId={round?.id ?? null} />

          {!started && <MaxPlayersForm date={date} maxPlayers={maxPlayers} />}

          <TimeForm date={date} startsAt={startsAt} endsAt={endsAt} timeNote={round?.timeNote ?? null} />

          {!started && (
            <DeadlineForm
              date={date}
              days={round?.signupDeadlineDays ?? settings.signupDeadlineDays}
              time={round?.signupDeadlineTime ?? settings.signupDeadlineTime}
            />
          )}

          {!started && (
            <CancelRoundButton
              action={cancelNextRound.bind(null, date)}
              dateLabel={formatRoundDate(date)}
              signupCount={signupCount}
            />
          )}
        </>
      ) : started ? (
        <StartedRound roundId={round.id} bestOf={round.bestOf} editing={params.rediger === "1"} />
      ) : (
        <OpenRound date={date} roundId={round?.id ?? null} maxPlayers={maxPlayers} />
      )}
    </>
  );
}

type Tab = "spillere" | "innstillinger";

/**
 * Underfanene på Ligarunde: «Spillere» (påmelding, grupper og kamper) er valgt som standard,
 * «Innstillinger» har kampformat, maks antall, klokkeslett, påmeldingsfrist og avlysning av runden.
 */
function RoundTabs({ tab }: { tab: Tab }) {
  const tabs: { key: Tab; label: string; href: string }[] = [
    { key: "spillere", label: "Spillere", href: "/admin/runde" },
    { key: "innstillinger", label: "Innstillinger", href: "/admin/runde?fane=innstillinger" },
  ];
  return (
    <nav
      aria-label="Ligarunde"
      className="inline-flex self-start rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === tab ? "page" : undefined}
          scroll={false}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            t.key === tab
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Påmeldingsfristen for runden. Kan endres til runden er startet. */
function DeadlineForm({ date, days, time }: { date: string; days: number; time: string }) {
  const input = "rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900";
  return (
    <form action={setRoundDeadline.bind(null, date)} className="flex flex-wrap items-end gap-2 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium">Påmeldingsfrist</span>
        <select name="signupDeadlineDays" defaultValue={days} className={input}>
          {Array.from({ length: MAX_DEADLINE_DAYS + 1 }, (_, d) => (
            <option key={d} value={d}>
              {deadlineLabel(d)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Kl.</span>
        <input type="time" name="signupDeadlineTime" required defaultValue={formatTime(time)} className={input} />
      </label>
      <PendingButton pendingText="Lagrer …" className={smallButton}>
        Lagre frist
      </PendingButton>
    </form>
  );
}

/** Valg av kampformat. Låst når et resultat er registrert i runden. */
async function FormatForm({
  date,
  bestOf,
  roundId,
}: {
  date: string;
  bestOf: number;
  roundId: number | null;
}) {
  const [played] = roundId
    ? await db
        .select({ id: schema.matches.id })
        .from(schema.matches)
        .where(and(eq(schema.matches.roundId, roundId), isNotNull(schema.matches.player1Games)))
        .limit(1)
    : [];

  if (played) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Kampformat: <span className="font-medium text-zinc-900 dark:text-zinc-100">best av {bestOf} sett</span>{" "}
        (låst fordi det er registrert resultater)
      </p>
    );
  }

  return (
    <form action={setRoundFormat.bind(null, date)} className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="kampformat" className="font-medium">
        Kampformat
      </label>
      <select
        id="kampformat"
        name="bestOf"
        defaultValue={bestOf}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {BEST_OF_OPTIONS.map((n) => (
          <option key={n} value={n}>
            Best av {n} sett
          </option>
        ))}
      </select>
      <PendingButton pendingText="Lagrer …" className={smallButton}>
        Lagre
      </PendingButton>
    </form>
  );
}

/** Maks antall deltakere i runden. Kan endres til runden er startet. */
function MaxPlayersForm({ date, maxPlayers }: { date: string; maxPlayers: number }) {
  return (
    <form action={setRoundMaxPlayers.bind(null, date)} className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="maks-deltakere" className="font-medium">
        Maks antall deltakere
      </label>
      <input
        id="maks-deltakere"
        type="number"
        name="maxPlayers"
        required
        min={MIN_PLAYERS}
        max={MAX_PLAYERS_LIMIT}
        defaultValue={maxPlayers}
        className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <PendingButton pendingText="Lagrer …" className={smallButton}>
        Lagre
      </PendingButton>
    </form>
  );
}

/** Når ligaen spilles denne torsdagen, og en valgfri melding til spillerne om tiden. */
function TimeForm({
  date,
  startsAt,
  endsAt,
  timeNote,
}: {
  date: string;
  startsAt: string;
  endsAt: string;
  timeNote: string | null;
}) {
  const input = "rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900";
  return (
    <form action={setRoundTime.bind(null, date)} className="flex flex-wrap items-end gap-2 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium">Fra</span>
        <input type="time" name="startsAt" required defaultValue={formatTime(startsAt)} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Til</span>
        <input type="time" name="endsAt" required defaultValue={formatTime(endsAt)} className={input} />
      </label>
      <label className="flex min-w-48 flex-1 flex-col gap-1">
        <span className="font-medium">Melding til spillerne (valgfritt)</span>
        <input
          type="text"
          name="timeNote"
          maxLength={300}
          defaultValue={timeNote ?? ""}
          placeholder="F.eks. Vi starter senere fordi banene er opptatt."
          className={input}
        />
      </label>
      <PendingButton pendingText="Lagrer …" className={smallButton}>
        Lagre tid
      </PendingButton>
    </form>
  );
}

/** Aktive spillere som ikke er med i listen `exclude`, sortert etter ranking. */
async function activePlayersExcept(exclude: Set<number>) {
  const players = await db
    .select({
      id: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      ranking: schema.players.ranking,
    })
    .from(schema.players)
    .where(eq(schema.players.active, true))
    .orderBy(
      sql`${schema.players.ranking} asc nulls last`,
      asc(schema.players.lastName),
      asc(schema.players.firstName),
    );
  return players.filter((p) => !exclude.has(p.id));
}

/** Før runden er startet: påmeldte, venteliste og andre aktive spillere. */
async function OpenRound({
  date,
  roundId,
  maxPlayers,
}: {
  date: string;
  roundId: number | null;
  maxPlayers: number;
}) {
  const signups = roundId ? await getSignups(roundId) : [];
  const participants = signups.slice(0, maxPlayers);
  const waitlist = signups.slice(maxPlayers);
  const others = await activePlayersExcept(new Set(signups.map((s) => s.playerId)));
  const { women } = splitLeagues(participants);
  const wantWomen = participants.filter(isWomensLeagueMember).length;
  const inWomensLeague = new Set(women.map((p) => p.playerId));
  // Med dameliga holder 3 spillere i hver liga, så regelen for antall gjelder bare uten.
  const problem = women.length > 0 ? null : groupSizeProblem(participants.length);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {roundId && !problem ? (
          <form action={startRound.bind(null, roundId)}>
            <PendingButton pendingText="Starter …" className={primaryButton}>
              Start runde
            </PendingButton>
          </form>
        ) : (
          <button type="button" disabled className={primaryButton}>
            Start runde
          </button>
        )}
        {problem && <p className="text-sm text-zinc-600 dark:text-zinc-400">{problem}</p>}
      </div>

      {wantWomen > 0 && (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {women.length > 0
            ? `Dameliga denne runden: ${women.length} kvinner spiller i egne damegrupper og beholder plassen sin i «Alle». De andre ${participants.length - women.length} spiller i «Alle».`
            : wantWomen < MIN_WOMENS_LEAGUE_PLAYERS
              ? `${wantWomen} ${wantWomen === 1 ? "påmeldt kvinne ønsker" : "påmeldte kvinner ønsker"} dameliga. Det trengs minst ${MIN_WOMENS_LEAGUE_PLAYERS}, så alle spiller i «Alle» denne runden.`
              : `${wantWomen} påmeldte kvinner ønsker dameliga, men da blir det bare ${participants.length - wantWomen} igjen i «Alle». Det trengs minst ${MIN_WOMENS_LEAGUE_PLAYERS}, så alle spiller i «Alle» denne runden.`}
        </p>
      )}

      <PlayerSection title={`Påmeldte (${participants.length}/${maxPlayers})`} empty="Ingen har meldt seg på ennå.">
        {participants.map((p, i) => (
          <PlayerRow
            key={p.playerId}
            index={i + 1}
            name={`${p.firstName} ${p.lastName}`}
            ranking={p.ranking}
            tag={inWomensLeague.has(p.playerId) ? "dameliga" : undefined}
          >
            <form action={removeFromRound.bind(null, roundId!, p.playerId, false)}>
              <PendingButton pendingText="Fjerner …" className={removeButton}>
                Fjern
              </PendingButton>
            </form>
          </PlayerRow>
        ))}
      </PlayerSection>

      {waitlist.length > 0 && (
        <PlayerSection
          title={`Venteliste (${waitlist.length})`}
          hint="Rykker opp i rekkefølge når noen fjernes eller melder seg av."
        >
          {waitlist.map((p, i) => (
            <PlayerRow key={p.playerId} index={i + 1} name={`${p.firstName} ${p.lastName}`} ranking={p.ranking}>
              <form action={removeFromRound.bind(null, roundId!, p.playerId, false)}>
                <PendingButton pendingText="Fjerner …" className={removeButton}>
                  Fjern
                </PendingButton>
              </form>
            </PlayerRow>
          ))}
        </PlayerSection>
      )}

      <PlayerSection
        title={`Andre aktive spillere (${others.length})`}
        hint={participants.length >= maxPlayers ? "Runden er full. Nye spillere havner på ventelisten." : undefined}
      >
        {others.map((p) => (
          <PlayerRow key={p.id} name={`${p.firstName} ${p.lastName}`} ranking={p.ranking}>
            <form action={addToRound.bind(null, date, p.id)}>
              <PendingButton pendingText="Legger til …" className={linkButton}>
                Legg til
              </PendingButton>
            </form>
          </PlayerRow>
        ))}
      </PlayerSection>
    </>
  );
}

/** Etter at runden er startet: gruppene, med redigering når `editing` er på. */
async function StartedRound({
  roundId,
  bestOf,
  editing,
}: {
  roundId: number;
  bestOf: number;
  editing: boolean;
}) {
  const [groups, signups, matches] = await Promise.all([
    getGroups(roundId),
    getSignups(roundId),
    getRoundMatches(roundId),
  ]);
  const inGroup = new Set(groups.flatMap((g) => g.players.map((p) => p.id)));
  const hasWomen = groups.some((g) => g.league === "women");
  const missing = matches.filter((m) => m.player1Games === null).length;
  const unconfirmed = matches.filter((m) => m.awaitingConfirmation).length;
  // Påmeldte som ikke er i en gruppe, f.eks. fra ventelisten.
  const waiting = signups.filter((s) => !inGroup.has(s.playerId));
  const candidates = editing ? await activePlayersExcept(inGroup) : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmButton
          action={restartRound.bind(null, roundId)}
          label="Restart runde"
          question="Vil du virkelig restarte? Gruppene og kampene settes opp på nytt fra påmeldingene. Endringer i gruppene og alle registrerte resultater forsvinner."
          confirmLabel="Ja, restart"
          pendingText="Restarter …"
          className={secondaryButton}
        />
        <ConfirmButton
          action={resetRound.bind(null, roundId)}
          label="Reset runde"
          question={`Sette runden tilbake til før «Start runde»? Gruppene og kampene slettes${
            matches.length - missing > 0
              ? `, sammen med ${matches.length - missing} ${matches.length - missing === 1 ? "registrert resultat" : "registrerte resultater"}`
              : ""
          }. Påmeldingene beholdes, og spillerne kan melde seg på og av igjen.`}
          confirmLabel="Ja, reset"
          pendingText="Resetter …"
          className={secondaryButton}
        />
        <Link href={editing ? "/admin/runde" : "/admin/runde?rediger=1"} className={secondaryButton}>
          {editing ? "Ferdig med redigering" : "Edit"}
        </Link>
        {missing === 0 ? (
          <ConfirmButton
            action={finishRound.bind(null, roundId)}
            label="Avslutt runde"
            question={`${
              unconfirmed > 0
                ? `${unconfirmed} ${unconfirmed === 1 ? "resultat venter" : "resultater venter"} fortsatt på bekreftelse fra motspilleren. `
                : ""
            }Avslutte runden? Resultatlisten lages, rankingen oppdateres, og påmeldingen til neste runde åpner.`}
            confirmLabel="Ja, avslutt"
            pendingText="Avslutter …"
            className={secondaryButton}
          />
        ) : (
          <span className="flex items-center gap-2">
            <button type="button" disabled className={secondaryButton}>
              Avslutt runde
            </button>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {missing} {missing === 1 ? "kamp mangler" : "kamper mangler"} resultat
            </span>
          </span>
        )}
      </div>

      {editing && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950">
          Når du flytter, fjerner eller legger til spillere, settes kampene i de berørte gruppene
          opp på nytt, og resultater som er registrert i dem slettes.
        </p>
      )}

      {LEAGUES.filter((league) => groups.some((g) => g.league === league)).map((league) => (
        <section key={league} className="flex flex-col gap-3">
          {hasWomen && (
            <h2 className="text-lg font-semibold tracking-tight">
              {league === "women" ? "Dameliga" : "Alle"}
            </h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.filter((g) => g.league === league).map((group) => {
              const size = group.players.length;
              return (
                <section
                  key={group.id}
                  className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <h3 className="flex items-baseline justify-between font-semibold">
                    {group.label}
                    <span
                      className={`text-sm font-normal ${size < 3 || size > 4 ? "text-amber-700 dark:text-amber-400" : "text-zinc-500"}`}
                    >
                      {size} spillere
                    </span>
                  </h3>
                  <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
                    {group.players.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                        <span className="w-7 text-right text-sm tabular-nums text-zinc-500">{p.ranking ?? "–"}</span>
                        <span className="flex-1">
                          {p.firstName} {p.lastName}
                        </span>
                        {editing && (
                          <>
                            <form action={movePlayer.bind(null, roundId, p.id)} className="flex items-center gap-1.5">
                              <label className="sr-only" htmlFor={`flytt-${p.id}`}>
                                Flytt {p.firstName} til gruppe
                              </label>
                              <select
                                id={`flytt-${p.id}`}
                                name="group"
                                defaultValue={group.id}
                                className="rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                              >
                                {groups.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.label}
                                  </option>
                                ))}
                              </select>
                              <PendingButton pendingText="Flytter …" className={smallButton}>
                                Flytt
                              </PendingButton>
                            </form>
                            <form action={removeFromRound.bind(null, roundId, p.id, true)}>
                              <PendingButton pendingText="Fjerner …" className={removeButton}>
                                Fjern
                              </PendingButton>
                            </form>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <ol className="mt-1 divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                    {matches
                      .filter((m) => m.groupId === group.id)
                      .map((m) => (
                        <AdminMatch
                          key={m.id}
                          match={m}
                          bestOf={bestOf}
                          saveAction={adminSaveResult.bind(null, m.id)}
                        />
                      ))}
                  </ol>
                  {editing && candidates.length > 0 && (
                    <form
                      action={addToGroup.bind(null, roundId, group.id)}
                      className="mt-1 flex items-center gap-1.5 border-t border-zinc-200 pt-2 dark:border-zinc-800"
                    >
                      <label className="sr-only" htmlFor={`legg-til-${group.id}`}>
                        Legg til spiller i {group.label.toLowerCase()}
                      </label>
                      <select
                        id={`legg-til-${group.id}`}
                        name="playerId"
                        defaultValue=""
                        className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="" disabled>
                          Velg spiller …
                        </option>
                        {candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.firstName} {c.lastName}
                            {waiting.some((w) => w.playerId === c.id) ? " (venteliste)" : ""}
                          </option>
                        ))}
                      </select>
                      <PendingButton pendingText="Legger til …" className={smallButton}>
                        Legg til
                      </PendingButton>
                    </form>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      ))}

      {waiting.length > 0 && (
        <PlayerSection
          title={`Venteliste (${waiting.length})`}
          hint={editing ? "Legg dem til i en gruppe med listen under hver gruppe." : "Trykk Edit for å legge dem til i en gruppe."}
        >
          {waiting.map((p, i) => (
            <PlayerRow key={p.playerId} index={i + 1} name={`${p.firstName} ${p.lastName}`} ranking={p.ranking}>
              <form action={removeFromRound.bind(null, roundId, p.playerId, editing)}>
                <PendingButton pendingText="Fjerner …" className={removeButton}>
                  Fjern
                </PendingButton>
              </form>
            </PlayerRow>
          ))}
        </PlayerSection>
      )}
    </>
  );
}

function PlayerSection({
  title,
  hint,
  empty,
  children,
}: {
  title: string;
  hint?: string;
  empty?: string;
  children: ReactNode[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="text-sm text-zinc-600 dark:text-zinc-400">{hint}</p>}
      {children.length === 0 ? (
        empty && <p className="text-zinc-600 dark:text-zinc-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {children}
        </ul>
      )}
    </section>
  );
}

function PlayerRow({
  index,
  name,
  ranking,
  tag,
  children,
}: {
  index?: number;
  name: string;
  ranking: number | null;
  /** Liten merkelapp etter navnet, f.eks. «dameliga». */
  tag?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      {index !== undefined && <span className="w-6 text-right text-sm tabular-nums text-zinc-500">{index}.</span>}
      <span className="flex-1">
        {name}
        {tag && (
          <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {tag}
          </span>
        )}
      </span>
      <span className="text-sm tabular-nums text-zinc-500">{ranking ? `#${ranking}` : "Ikke rangert"}</span>
      {children}
    </li>
  );
}
