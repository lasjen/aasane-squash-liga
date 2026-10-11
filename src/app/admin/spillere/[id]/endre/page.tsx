import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { updatePlayer } from "@/app/actions/admin-players";
import { db, schema } from "@/db";
import { requireOperator } from "@/lib/auth/admin-session";
import { isOperatorRole, ROLE_LABELS } from "@/lib/roles";

import { PlayerForm } from "../../player-form";

export const metadata: Metadata = { title: "Endre spiller – Admin – Torsdagsligaen" };

export default function EditPlayerPage({ params }: PageProps<"/admin/spillere/[id]/endre">) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Endre spiller</h1>
      <Suspense fallback={<p className="text-zinc-500">Henter spiller …</p>}>
        <EditPlayerForm params={params} />
      </Suspense>
    </main>
  );
}

async function EditPlayerForm({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireOperator();

  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const [player] = await db
    .select()
    .from(schema.players)
    .where(eq(schema.players.id, id))
    .limit(1);
  // Slettede spillere kan ikke redigeres.
  if (!player || player.deletedAt) notFound();

  // Operatører kan ikke endre operatører og admins (samme regel som i updatePlayer).
  if (actor.role !== "admin" && isOperatorRole(player.role)) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        {player.firstName} {player.lastName} er {ROLE_LABELS[player.role].toLowerCase()}. Bare admin
        kan endre operatører og admins.
      </p>
    );
  }

  return (
    <PlayerForm
      action={updatePlayer.bind(null, player.id)}
      defaults={{
        firstName: player.firstName,
        lastName: player.lastName,
        gender: player.gender ?? "",
        level: player.level ?? "",
        email: player.email ?? "",
        phone: player.phone ?? "",
        active: player.active ? "on" : "",
        role: player.role,
      }}
      submitLabel="Lagre endringer"
      isNew={false}
      canEditRole={actor.role === "admin"}
    />
  );
}
