// Valgene for kjønn og nivå. Brukes både av datamodellen og i skjemaene,
// så filen kan ikke importere noe som bare virker på serveren.

export const GENDERS = ["female", "male", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  female: "Kvinne",
  male: "Mann",
  other: "Annet",
};

export const LEVELS = ["beginner", "intermediate", "experienced", "pro"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "Ny begynner",
  intermediate: "Medium",
  experienced: "Erfaren",
  pro: "Proff",
};

export const LEVEL_HINTS: Record<Level, string> = {
  beginner: "Har spilt lite eller ingenting.",
  intermediate: "Spiller jevnlig og kan reglene.",
  experienced: "Har spilt i mange år.",
  pro: "Deltar i offisielle turneringer.",
};
