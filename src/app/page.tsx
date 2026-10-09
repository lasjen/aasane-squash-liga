import Link from "next/link";
import { Suspense } from "react";

import { getCurrentPlayer } from "@/lib/auth/session";

const kommer = [
  { tittel: "Tabell", tekst: "Stillingen i torsdagsligaen, divisjon for divisjon." },
  { tittel: "Kamper", tekst: "Kveldens oppsett og registrering av resultater." },
  { tittel: "Spillere", tekst: "Oversikt over spillere og deres kamphistorikk." },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Åsane Squash Klubb
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Torsdagsligaen</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Appen er under oppbygging. Her kommer etter hvert alt du trenger for
          torsdagsligaen.
        </p>
        <Suspense fallback={null}>
          <Welcome />
        </Suspense>
      </header>

      <ul className="grid gap-3 sm:grid-cols-3">
        {kommer.map((del) => (
          <li
            key={del.tittel}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <h2 className="font-medium">{del.tittel}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{del.tekst}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

async function Welcome() {
  const player = await getCurrentPlayer();

  if (player) {
    return <p className="font-medium">Hei, {player.name.split(" ")[0]}!</p>;
  }
  return (
    <Link
      href="/registrer"
      className="mt-2 self-start rounded-md bg-zinc-900 px-4 py-2.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
    >
      Meld deg på torsdagsligaen
    </Link>
  );
}
