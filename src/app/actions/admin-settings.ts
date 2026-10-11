"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin-session";
import { recheckProPlayers } from "@/lib/pro-check";
import { getProRequirement, setProRequirement } from "@/lib/settings";

const PAGE = "/admin/innstillinger";

/** Tall mellom 1 og 200 fra skjemaet, ellers `fallback`. */
function limit(formData: FormData, key: string, fallback: number) {
  const n = Number(formData.get(key));
  return Number.isInteger(n) && n >= 1 && n <= 200 ? n : fallback;
}

export async function saveProRequirement(formData: FormData) {
  await requireAdmin();
  const current = await getProRequirement();
  await setProRequirement({
    enabled: formData.get("enabled") === "on",
    menTop: limit(formData, "menTop", current.menTop),
    womenTop: limit(formData, "womenTop", current.womenTop),
  });
  redirect(`${PAGE}?melding=lagret`);
}

/** Sjekker alle proff-spillere mot norgesrankingen nå. */
export async function recheckPros() {
  await requireAdmin();
  const result = await recheckProPlayers(await getProRequirement());
  redirect(
    result
      ? `${PAGE}?melding=sjekket&sjekket=${result.checked}&utenfor=${result.below}`
      : `${PAGE}?melding=rankedin-nede`,
  );
}
