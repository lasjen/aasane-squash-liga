// Datoer for kampkvelder. Alle datoer er strenger på formen "YYYY-MM-DD" i norsk tid,
// samme format som date-kolonnene i databasen. Serveren kjører i UTC, så «i dag»
// må regnes ut i Europe/Oslo, ellers blir det feil dag rundt midnatt.

const TIME_ZONE = "Europe/Oslo";
const THURSDAY = 4;

/** Dagens dato i Norge. */
export function osloToday(now: Date = new Date()): string {
  // sv-SE gir formatet YYYY-MM-DD.
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE }).format(now);
}

/** Nå i norsk tid som «YYYY-MM-DD HH:MM», så det kan sammenlignes med en frist. */
export function osloNow(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

const toUtcDate = (date: string) => new Date(`${date}T00:00:00Z`);
const fromUtcDate = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
}

/** Første torsdag på eller etter datoen. */
export function thursdayOnOrAfter(date: string): string {
  const day = toUtcDate(date).getUTCDay();
  return addDays(date, (THURSDAY - day + 7) % 7);
}

/** Sesongen en dato hører til: vår er januar–juni, høst er juli–desember. */
export function seasonFor(date: string) {
  const year = date.slice(0, 4);
  const spring = Number(date.slice(5, 7)) <= 6;
  return spring
    ? { name: `Vår ${year}`, startsOn: `${year}-01-01`, endsOn: `${year}-06-30` }
    : { name: `Høst ${year}`, startsOn: `${year}-07-01`, endsOn: `${year}-12-31` };
}

/** F.eks. «torsdag 15. oktober». */
export function formatRoundDate(date: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(toUtcDate(date));
}

/** Når ligaen spilles før admin har satt noe annet under Innstillinger. Se getLeagueSettings. */
export const DEFAULT_STARTS_AT = "18:30";
export const DEFAULT_ENDS_AT = "20:00";

/** Om teksten er et klokkeslett på formen «18:30». */
export const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Klokkeslett fra databasen («18:30:00») eller et skjema («18:30») som «18:30». */
export const formatTime = (time: string) => time.slice(0, 5);

/** F.eks. «torsdag 15. oktober (18:30 – 20:00)». */
export function formatRoundDateTime(date: string, startsAt: string, endsAt: string): string {
  return `${formatRoundDate(date)} (${formatTime(startsAt)} – ${formatTime(endsAt)})`;
}

/** Påmeldingsfristen før admin har satt noe annet under Innstillinger: dagen før kl. 20:00. */
export const DEFAULT_SIGNUP_DEADLINE_DAYS = 1;
export const DEFAULT_SIGNUP_DEADLINE_TIME = "20:00";

/** Fristen kan være opptil en uke før runden, så den aldri havner før forrige runde. */
export const MAX_DEADLINE_DAYS = 6;

/** «samme dag», «dagen før», «2 dager før» … */
export const deadlineLabel = (days: number) =>
  days === 0 ? "samme dag" : days === 1 ? "dagen før" : `${days} dager før`;

/**
 * Påmeldingsfristen for runden på datoen: `days` dager før, kl. `time` i norsk tid.
 * `at` er på samme form som osloNow, så `osloNow() >= at` betyr at fristen har gått ut.
 */
export function signupDeadline(date: string, days: number, time: string) {
  const day = addDays(date, -days);
  return { day, time: formatTime(time), at: `${day} ${formatTime(time)}` };
}

/** F.eks. «onsdag 21. oktober kl. 20:00». */
export const formatDeadline = (deadline: { day: string; time: string }) =>
  `${formatRoundDate(deadline.day)} kl. ${deadline.time}`;

/** F.eks. «15. oktober 2026 kl. 19:30», i norsk tid. */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}
