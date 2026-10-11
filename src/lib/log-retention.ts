/** Hvor gamle logglinjer admin kan slette, i måneder. */
export const LOG_RETENTION_OPTIONS = [1, 3, 6] as const;
export type LogRetention = (typeof LOG_RETENTION_OPTIONS)[number];

export const monthsLabel = (months: number) => `${months} ${months === 1 ? "måned" : "måneder"}`;
