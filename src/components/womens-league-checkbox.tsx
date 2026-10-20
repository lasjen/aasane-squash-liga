"use client";

import { useEffect, useRef, useState } from "react";

import { Checkbox } from "@/components/form";
import { WOMENS_LEAGUE_CHECKBOX_LABEL } from "@/lib/leagues";

/**
 * Sjekkboksen for dameliga. Vises bare når «Kvinne» er valgt i kjønnsfeltet i samme skjema,
 * og følger med når valget endres. Serveren lagrer den uansett bare for kvinner.
 */
export function WomensLeagueCheckbox({
  initialGender,
  defaultChecked,
  hint,
}: {
  /** Kjønnet skjemaet starter med. */
  initialGender: string | undefined;
  defaultChecked: boolean;
  hint?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [female, setFemale] = useState(initialGender === "female");

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.name === "gender") setFemale(target.value === "female");
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);

  return (
    <div ref={ref} hidden={!female}>
      <Checkbox
        label={WOMENS_LEAGUE_CHECKBOX_LABEL}
        name="wantsWomensLeague"
        defaultChecked={defaultChecked}
        hint={
          hint ??
          "Er minst 3 kvinner påmeldt som ønsker det, spiller dere i egne damegrupper. Du beholder plassen din i «Alle»-rankingen mens du spiller dameliga."
        }
      />
    </div>
  );
}
