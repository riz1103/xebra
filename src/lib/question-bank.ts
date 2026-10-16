import type { QuestionDifficulty } from "@/types";

export const DIFFICULTIES: { value: QuestionDifficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export const DIFFICULTY_BADGE: Record<QuestionDifficulty, string> = {
  easy: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  medium: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  hard: "border-red-500/40 text-red-700 dark:text-red-400",
};

/** Same normalization as the API: lowercased, trimmed, deduplicated */
export function parseTags(input: string): string[] {
  return [...new Set(input.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

/** Select value standing in for "no filter" (Radix Select can't use an empty string) */
export const ANY = "__any__";
