import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth/admin-session";

import { DeleteOldLogs } from "./delete-old-logs";

export const metadata: Metadata = { title: "Logg – Konsoll – Torsdagsligaen" };

/** Så mange linjer vises om gangen. */
const LIMIT = 300;

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

/** Størrelse i MB, med kB i parentes når det er under 1 MB. */
function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  const text = `${mb.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
  return mb < 1 ? `${text} (${Math.ceil(bytes / 1024).toLocaleString("nb-NO")} kB)` : text;
}

/**
 * Antall linjer, datamengde og hvor mange linjer som er eldre enn hver av alderne admin
 * kan slette. Datamengden er summen av selve radene; diskplassen Postgres har satt av til
 * tabellen krymper ikke med en gang når noe slettes, og ville gitt et misvisende tall.
 */
async function getLogStats() {
  const result = await db.execute<{
    rows: string;
    bytes: string;
    oldest: Date | null;
    older_1: string;
    older_3: string;
    older_6: string;
  }>(sql`
    SELECT
      count(*) AS rows,
      coalesce(sum(pg_column_size(a.*)), 0) AS bytes,
      min(a.created_at) AS oldest,
      count(*) FILTER (WHERE a.created_at < now() - interval '1 month') AS older_1,
      count(*) FILTER (WHERE a.created_at < now() - interval '3 months') AS older_3,
      count(*) FILTER (WHERE a.created_at < now() - interval '6 months') AS older_6
    FROM ${schema.auditLog} AS a
  `);
  const row = result.rows[0];
  return {
    rows: Number(row.rows),
    bytes: Number(row.bytes),
    oldest: row.oldest ? new Date(row.oldest) : null,
    olderThan: { 1: Number(row.older_1), 3: Number(row.older_3), 6: Number(row.older_6) },
  };
}

export default function AuditLogPage({ searchParams }: PageProps<"/admin/logg">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Logg</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Alt operatører og admins har gjort i konsollen, nyeste først.
        </p>
      </div>
      <Suspense fallback={<p className="text-zinc-500">Henter loggen …</p>}>
        <AuditLog searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AuditLog({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const actorId = Number(params.operator) || null;
  const deleted = params.melding === "slettet" ? Number(params.antall) || 0 : null;

  const [entries, actors, stats] = await Promise.all([
    db
      .select({
        id: schema.auditLog.id,
        createdAt: schema.auditLog.createdAt,
        actorId: schema.auditLog.actorId,
        actorName: schema.auditLog.actorName,
        description: schema.auditLog.description,
      })
      .from(schema.auditLog)
      .where(actorId ? eq(schema.auditLog.actorId, actorId) : undefined)
      .orderBy(desc(schema.auditLog.createdAt), desc(schema.auditLog.id))
      .limit(LIMIT),
    // Alle som har gjort noe, til filteret.
    db
      .selectDistinct({ id: schema.auditLog.actorId, name: schema.auditLog.actorName })
      .from(schema.auditLog)
      .orderBy(schema.auditLog.actorName),
    getLogStats(),
  ]);

  return (
    <>
      {deleted !== null && (
        <p role="status" className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          {deleted} {deleted === 1 ? "linje" : "linjer"} ble slettet.
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-zinc-500">Linjer</dt>
            <dd className="text-lg font-semibold tabular-nums">{stats.rows.toLocaleString("nb-NO")}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Datamengde</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatSize(stats.bytes)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Eldste linje</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {stats.oldest ? formatTime(stats.oldest) : "–"}
            </dd>
          </div>
        </dl>
        <DeleteOldLogs counts={stats.olderThan} />
      </section>

      <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="operator" className="font-medium">
          Vis
        </label>
        <select
          id="operator"
          name="operator"
          defaultValue={actorId ?? ""}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Alle</option>
          {actors
            .filter((a) => a.id !== null)
            .map((a) => (
              <option key={a.id} value={a.id!}>
                {a.name}
              </option>
            ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium dark:border-zinc-700"
        >
          Filtrer
        </button>
        {actorId && (
          <Link href="/admin/logg" className="font-medium underline">
            Vis alle
          </Link>
        )}
      </form>

      {entries.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">Ingen handlinger er logget ennå.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">Tidspunkt</th>
                <th className="px-3 py-2 font-medium">Hvem</th>
                <th className="px-3 py-2 font-medium">Hva</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums text-zinc-600 dark:text-zinc-400">
                    {formatTime(e.createdAt)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.actorId ? (
                      <Link href={`/admin/logg?operator=${e.actorId}`} className="underline">
                        {e.actorName}
                      </Link>
                    ) : (
                      e.actorName
                    )}
                  </td>
                  <td className="px-3 py-2">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {entries.length === LIMIT && (
        <p className="text-sm text-zinc-500">Viser de {LIMIT} siste handlingene.</p>
      )}
    </>
  );
}
