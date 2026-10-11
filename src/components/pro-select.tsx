"use client";

import { useEffect, useRef, useState } from "react";

import { getProOptions, type ProOptions } from "@/app/actions/pro";

/**
 * Valg av seg selv fra norgesrankingen når nivå Proff er valgt og kravet er slått på.
 * Følger med på radioknappene `level` i samme skjema, og henter listen først når den trengs.
 * `admin`: admin kan la feltet stå tomt (Proff blir da «satt av admin»).
 */
export function ProSelect({
  defaultLevel,
  defaultRankedinId,
  admin = false,
}: {
  defaultLevel?: string;
  defaultRankedinId?: string;
  admin?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState(defaultLevel ?? "");
  const [options, setOptions] = useState<ProOptions | null>(null);

  // Lytter på endringer i nivåvalget i skjemaet rundt.
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const update = () => {
      const field = form.elements.namedItem("level");
      setLevel(field instanceof RadioNodeList ? field.value : "");
    };
    form.addEventListener("change", update);
    return () => form.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (level === "pro" && options === null) {
      getProOptions().then(setOptions, () => setOptions({ enabled: false }));
    }
  }, [level, options]);

  const show = level === "pro" && options?.enabled;

  return (
    <div ref={ref} className={show ? "flex flex-col gap-1.5" : "contents"}>
      {level === "pro" && options === null && <p className="text-sm text-zinc-500">Henter norgesrankingen …</p>}
      {show && (
        <>
          <label htmlFor="felt-rankedinId" className="text-sm font-medium">
            Deg på norgesrankingen
          </label>
          {options.unavailable ? (
            <>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Norgesrankingen kunne ikke hentes nå. Du kan lagre likevel, så sjekkes det senere.
              </p>
              <input type="hidden" name="rankedinId" value={defaultRankedinId ?? ""} />
            </>
          ) : (
            <>
              <select
                id="felt-rankedinId"
                name="rankedinId"
                defaultValue={defaultRankedinId ?? ""}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">{admin ? "Ingen (satt av admin)" : "Velg deg selv …"}</option>
                <optgroup label={`Herrer, topp ${options.menTop}`}>
                  {options.men.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={`Damer, topp ${options.womenTop}`}>
                  {options.women.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-sm text-zinc-500">
                Proff krever at du er blant de {options.menTop} beste herrene eller de{" "}
                {options.womenTop} beste damene på norgesrankingen.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
