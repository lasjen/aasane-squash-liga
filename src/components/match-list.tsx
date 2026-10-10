import { describeSource } from "@/lib/match-plan";
import type { MatchSide, RoundMatch } from "@/lib/round-matches";

function Side({ side, highlight }: { side: MatchSide; highlight?: number }) {
  if (side.kind === "source") {
    return <span className="text-zinc-500 italic">{describeSource(side.source)}</span>;
  }
  return <span className={side.id === highlight ? "font-semibold" : undefined}>{side.name}</span>;
}

/** Kampene i en gruppe i spillerekkefølge. `highlight` er spilleren som ser på siden. */
export function MatchList({ matches, highlight }: { matches: RoundMatch[]; highlight?: number }) {
  if (matches.length === 0) return null;

  return (
    <ol className="flex flex-col gap-1 text-sm">
      {matches.map((m) => {
        const mine =
          highlight !== undefined &&
          [m.player1, m.player2].some((s) => s.kind === "player" && s.id === highlight);
        return (
          <li
            key={m.id}
            className={`flex items-baseline gap-2 rounded px-2 py-1 ${mine ? "bg-zinc-100 dark:bg-zinc-900" : ""}`}
          >
            <span className="w-14 shrink-0 text-zinc-500">
              Kamp {m.number}
              {m.pool && <span className="block text-xs">Pulje {m.pool}</span>}
            </span>
            <span className="flex-1">
              <Side side={m.player1} highlight={highlight} />
              <span className="px-1.5 text-zinc-400">–</span>
              <Side side={m.player2} highlight={highlight} />
            </span>
            {m.player1Games !== null && (
              <span className="tabular-nums" title={m.awaitingConfirmation ? "Ikke bekreftet ennå" : undefined}>
                {m.player1Games}–{m.player2Games}
                {m.awaitingConfirmation && <span className="text-amber-600"> *</span>}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
