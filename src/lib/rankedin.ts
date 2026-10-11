import "server-only";

import { cacheLife } from "next/cache";

// Norgesrankingen hentes fra RankedIn (Norges Squashforbund, ranking 82). API-et er det
// RankedIn-nettsiden selv bruker. Det er ikke offisielt dokumentert og kan endres, så
// alle som bruker det må tåle at oppslaget feiler.

export type RankingGender = "male" | "female";

export type RankedPlayer = {
  rankedinId: string;
  name: string;
  standing: number;
  club: string | null;
  gender: RankingGender;
};

const API = "https://api.rankedin.com/v1/Ranking/GetRankingsAsync";
const RANKING_ID = 82;
/** Hovedrankingen for herrer og damer. */
const LISTS: Record<RankingGender, { rankingType: number; ageGroup: number }> = {
  male: { rankingType: 1, ageGroup: 1 },
  female: { rankingType: 2, ageGroup: 13 },
};

export const rankedinProfileUrl = (rankedinId: string) =>
  `https://www.rankedin.com/en/player/${encodeURIComponent(rankedinId)}`;

/**
 * Alle med plassering `limit` eller bedre på norgesrankingen for kjønnet. Mellomlagres i
 * noen timer, siden rankingen bare endres ukentlig. Kaster feil hvis RankedIn ikke svarer
 * som forventet.
 */
export async function getNationalRanking(gender: RankingGender, limit: number): Promise<RankedPlayer[]> {
  "use cache";
  cacheLife("hours");

  const { rankingType, ageGroup } = LISTS[gender];
  // Delt plass gir flere rader enn plasser (to kan stå som nr. 20), så det hentes noen
  // ekstra rader, og så filtreres det på plassering.
  const take = limit + 25;
  const url = `${API}?rankingId=${RANKING_ID}&rankingType=${rankingType}&ageGroup=${ageGroup}&weekFromNow=0&language=en&skip=0&take=${take}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`RankedIn svarte ${res.status}`);

  const data = (await res.json()) as {
    Payload?: { RankedinId?: string; Name?: string; Standing?: number; HomeClubName?: string | null }[];
  };
  if (!Array.isArray(data.Payload)) throw new Error("Uventet svar fra RankedIn");

  return data.Payload.filter((p) => p.RankedinId && p.Name && typeof p.Standing === "number")
    .map((p) => ({
      rankedinId: p.RankedinId!,
      name: p.Name!,
      standing: p.Standing!,
      club: p.HomeClubName ?? null,
      gender,
    }))
    .filter((p) => p.standing <= limit);
}
