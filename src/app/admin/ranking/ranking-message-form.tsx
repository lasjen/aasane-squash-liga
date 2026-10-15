"use client";

import { useState, useTransition } from "react";

import { saveRankingMessage } from "@/app/actions/admin-ranking";

type Status = { kind: "ok" | "error"; text: string } | null;

/** Meldingen spillerne ser under rankingen. Lagres for seg selv, uavhengig av «Publiser». */
export function RankingMessageForm({ initial }: { initial: string }) {
  const [saved, setSaved] = useState(initial);
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState<Status>(null);
  const [pending, startTransition] = useTransition();

  const dirty = text.trim() !== saved.trim();

  function save() {
    startTransition(async () => {
      const result = await saveRankingMessage(text);
      if (result.ok) {
        setSaved(text.trim());
        setText(text.trim());
        setStatus({ kind: "ok", text: text.trim() ? "Meldingen er lagret." : "Meldingen er fjernet." });
      } else {
        setStatus({ kind: "error", text: result.message });
      }
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <label htmlFor="ranking-message" className="font-semibold">
        Melding under rankingen
      </label>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Vises til spillerne under rankingen. La feltet stå tomt for å fjerne meldingen.
      </p>
      <textarea
        id="ranking-message"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setStatus(null);
        }}
        rows={4}
        maxLength={1000}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Lagrer …" : "Lagre melding"}
        </button>
        {status && (
          <span
            role={status.kind === "error" ? "alert" : "status"}
            className={`text-sm ${status.kind === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
          >
            {status.text}
          </span>
        )}
      </div>
    </section>
  );
}
