"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { publishRanking } from "@/app/actions/admin-ranking";
import type { League } from "@/lib/leagues";

export type RankingRow = { id: number; name: string; level: string | null };

type Status = { kind: "ok" | "error"; text: string; stale?: boolean } | null;

const orderKey = (rows: RankingRow[]) => rows.map((r) => r.id).join(",");

/** Flytter elementet på plass `from` til plass `to` (0-basert). */
function move<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

/** Avstand fra kanten av vinduet der siden ruller av seg selv mens man drar. */
const SCROLL_EDGE = 80;

/**
 * Rankingen som en liste der spillerne kan dras opp og ned med håndtaket, flyttes med
 * pilknappene eller med piltastene når håndtaket har fokus. Endringene lagres først når
 * man trykker «Publiser». «Angre» går tilbake til rankingen slik den er lagret.
 *
 * Dra og slipp bruker pointer events i stedet for HTML5 drag and drop, så det virker
 * både med mus og på mobil.
 */
export function RankingEditor({ players, league }: { players: RankingRow[]; league: League }) {
  const router = useRouter();
  const [saved, setSaved] = useState(players);
  const [order, setOrder] = useState(players);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [pending, startTransition] = useTransition();

  // Ny lagret ranking fra serveren (etter publisering eller «Last inn på nytt»)
  // blir det nye utgangspunktet.
  const [prevKey, setPrevKey] = useState(orderKey(players));
  if (orderKey(players) !== prevKey) {
    setPrevKey(orderKey(players));
    setSaved(players);
    setOrder(players);
  }

  const dirty = orderKey(order) !== orderKey(saved);
  const savedPlace = new Map(saved.map((p, i) => [p.id, i + 1]));

  const rowRefs = useRef(new Map<number, HTMLLIElement>());
  const pointerY = useRef(0);

  // Advarer før man forlater siden med endringer som ikke er publisert.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Ruller siden når man drar nær toppen eller bunnen av vinduet.
  useEffect(() => {
    if (draggingId === null) return;
    let frame = requestAnimationFrame(function tick() {
      const y = pointerY.current;
      if (y < SCROLL_EDGE) window.scrollBy(0, -Math.ceil((SCROLL_EDGE - y) / 6));
      else if (y > window.innerHeight - SCROLL_EDGE) {
        window.scrollBy(0, Math.ceil((y - (window.innerHeight - SCROLL_EDGE)) / 6));
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [draggingId]);

  function changeOrder(next: RankingRow[]) {
    setOrder(next);
    if (status?.kind === "ok") setStatus(null);
  }

  /** Ny plass for raden som dras: antall andre rader med midtpunkt over pekeren. */
  function targetIndex(clientY: number, id: number) {
    let index = 0;
    for (const p of order) {
      if (p.id === id) continue;
      const box = rowRefs.current.get(p.id)?.getBoundingClientRect();
      if (box && clientY > box.top + box.height / 2) index++;
    }
    return index;
  }

  function onPointerDown(e: React.PointerEvent, id: number) {
    if (pending || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerY.current = e.clientY;
    setDraggingId(id);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (draggingId === null) return;
    pointerY.current = e.clientY;
    const from = order.findIndex((p) => p.id === draggingId);
    const to = targetIndex(e.clientY, draggingId);
    if (from !== to) changeOrder(move(order, from, to));
  }

  function stopDragging() {
    setDraggingId(null);
  }

  function moveBy(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= order.length) return;
    changeOrder(move(order, index, to));
  }

  function onHandleKey(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      moveBy(index, e.key === "ArrowUp" ? -1 : 1);
      // Fokus følger spilleren til den nye plassen.
      const id = order[index].id;
      requestAnimationFrame(() =>
        rowRefs.current.get(id)?.querySelector<HTMLElement>("[data-handle]")?.focus(),
      );
    }
  }

  function undo() {
    setOrder(saved);
    setStatus(null);
  }

  function publish() {
    const expected = saved.map((p) => p.id);
    const next = order.map((p) => p.id);
    startTransition(async () => {
      const result = await publishRanking(league, expected, next);
      if (result.ok) {
        setSaved(order);
        setStatus({
          kind: "ok",
          text:
            result.moved === 0
              ? "Ingen endringer å publisere."
              : `Rankingen er publisert. ${result.moved} ${result.moved === 1 ? "spiller" : "spillere"} fikk ny plass.`,
        });
      } else {
        setStatus({ kind: "error", text: result.message, stale: result.stale });
      }
    });
  }

  function reload() {
    setStatus(null);
    setOrder(saved);
    router.refresh();
  }

  if (order.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">Ingen spillere har plass i rankingen ennå.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <button
          type="button"
          onClick={publish}
          disabled={!dirty || pending}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Publiserer …" : "Publiser"}
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={!dirty || pending}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Angre
        </button>
        <span className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
          {dirty ? "Endringene er ikke publisert ennå." : "Ingen upubliserte endringer."}
        </span>
      </div>

      {status && (
        <div
          role={status.kind === "error" ? "alert" : "status"}
          className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm ${
            status.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
          }`}
        >
          <span>{status.text}</span>
          {status.stale && (
            <button type="button" onClick={reload} className="font-medium underline">
              Last inn på nytt
            </button>
          )}
        </div>
      )}

      <ol
        className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
        aria-label={league === "women" ? "Dameligaens ranking" : "Ranking"}
      >
        {order.map((p, i) => {
          const place = i + 1;
          const before = savedPlace.get(p.id)!;
          const diff = before - place;
          const dragging = draggingId === p.id;
          return (
            <li
              key={p.id}
              ref={(el) => {
                if (el) rowRefs.current.set(p.id, el);
                else rowRefs.current.delete(p.id);
              }}
              className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                dragging
                  ? "relative z-10 bg-sky-50 shadow-md ring-2 ring-sky-400 dark:bg-sky-950"
                  : diff !== 0
                    ? "bg-amber-50/60 dark:bg-amber-950/30"
                    : "bg-white dark:bg-zinc-950"
              }`}
            >
              <button
                type="button"
                data-handle
                aria-label={`Flytt ${p.name}, plass ${place}. Bruk piltastene opp og ned.`}
                onPointerDown={(e) => onPointerDown(e, p.id)}
                onPointerMove={onPointerMove}
                onPointerUp={stopDragging}
                onPointerCancel={stopDragging}
                onKeyDown={(e) => onHandleKey(e, i)}
                disabled={pending}
                className={`flex h-9 w-8 shrink-0 touch-none items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${
                  dragging ? "cursor-grabbing" : "cursor-grab"
                }`}
              >
                <svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true" fill="currentColor">
                  {[3, 9, 15].flatMap((y) => [
                    <circle key={`a${y}`} cx="3" cy={y} r="1.5" />,
                    <circle key={`b${y}`} cx="9" cy={y} r="1.5" />,
                  ])}
                </svg>
              </button>
              <span className="w-8 shrink-0 text-right font-medium tabular-nums">{place}</span>
              <span className="min-w-0 flex-1 truncate select-none">
                {p.name}
                {p.level && <span className="ml-2 text-xs text-zinc-500">{p.level}</span>}
              </span>
              <span className="shrink-0 text-right text-xs whitespace-nowrap tabular-nums">
                {diff !== 0 && (
                  <span className={diff > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                    {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}
                    <span className="hidden sm:inline"> (var {before})</span>
                  </span>
                )}
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => moveBy(i, -1)}
                  disabled={i === 0 || pending}
                  aria-label={`Flytt ${p.name} opp`}
                  className="h-8 w-8 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveBy(i, 1)}
                  disabled={i === order.length - 1 || pending}
                  aria-label={`Flytt ${p.name} ned`}
                  className="h-8 w-8 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
