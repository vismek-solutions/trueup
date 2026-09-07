const REASON_LIMIT = 300;

export const summarize = (text: unknown): string => {
  if (typeof text !== "string") return "";
  const collapsed = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join(" ");
  return collapsed.length > REASON_LIMIT ? `${collapsed.slice(0, REASON_LIMIT)}…` : collapsed;
};

export const objectOf = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

export const stringOf = (value: unknown): string | null => (typeof value === "string" ? value : null);

export const numberOf = (value: unknown): number | null => (typeof value === "number" ? value : null);
