import Link from "next/link";
import { Suspense } from "react";

import { logout } from "@/app/actions/auth";
import { PlayerTabs } from "@/components/player-tabs";
import { getCurrentPlayer } from "@/lib/auth/session";
import { findStartedRound } from "@/lib/rounds";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex min-h-14 w-full max-w-2xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Torsdagsligaen
        </Link>
        {/* Innloggingsstatus leser cookien, så den strømmes inn mens resten vises med en gang. */}
        <Suspense fallback={null}>
          <UserNav />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <TabsForPlayer />
      </Suspense>
    </header>
  );
}

/** Fanene vises bare for innloggede spillere. */
async function TabsForPlayer() {
  const player = await getCurrentPlayer();
  if (!player) return null;
  return <PlayerTabs leagueOpen={(await findStartedRound()) !== null} />;
}

async function UserNav() {
  const player = await getCurrentPlayer();

  return (
    <nav className="flex items-center gap-4 text-sm">
      {player ? (
        <>
          <span className="text-zinc-600 dark:text-zinc-400">{player.firstName} {player.lastName}</span>
          <form action={logout}>
            <button type="submit" className="font-medium underline">
              Logg ut
            </button>
          </form>
        </>
      ) : (
        <>
          <Link href="/logg-inn" className="font-medium">
            Logg inn
          </Link>
          <Link
            href="/registrer"
            className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Registrer deg
          </Link>
        </>
      )}
    </nav>
  );
}
