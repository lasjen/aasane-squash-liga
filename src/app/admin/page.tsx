import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth/admin-session";
import { GENDER_LABELS, LEVEL_LABELS } from "@/lib/player-options";

export const metadata: Metadata = { title: "Admin – Torsdagsligaen" };

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Spillere</h1>
      <Suspense fallback={<p className="text-zinc-500">Henter spillere …</p>}>
        <PlayerTable />
      </Suspense>
    </main>
  );
}

async function PlayerTable() {
  await requireAdmin();

  const players = await db
    .select({
      id: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      email: schema.players.email,
      phone: schema.players.phone,
      gender: schema.players.gender,
      level: schema.players.level,
      active: schema.players.active,
    })
    .from(schema.players)
    .orderBy(asc(schema.players.lastName), asc(schema.players.firstName));

  if (players.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">Ingen spillere er registrert ennå.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2 font-medium">Navn</th>
            <th className="px-3 py-2 font-medium">E-post</th>
            <th className="px-3 py-2 font-medium">Mobil</th>
            <th className="px-3 py-2 font-medium">Kjønn</th>
            <th className="px-3 py-2 font-medium">Nivå</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {players.map((p) => (
            <tr key={p.id} className={p.active ? undefined : "text-zinc-400"}>
              <td className="px-3 py-2 whitespace-nowrap">
                {p.firstName} {p.lastName}
                {!p.active && <span className="ml-2 text-xs">(inaktiv)</span>}
              </td>
              <td className="px-3 py-2">{p.email ?? "–"}</td>
              <td className="px-3 py-2 whitespace-nowrap">{p.phone ?? "–"}</td>
              <td className="px-3 py-2">{p.gender ? GENDER_LABELS[p.gender] : "–"}</td>
              <td className="px-3 py-2">{p.level ? LEVEL_LABELS[p.level] : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
