import { api } from "@/lib/api";
import type { ExamResult, ExamResultListParams } from "@/types";

const EXPORT_PAGE_SIZE = 100;
const MAX_EXPORT_PAGES = 100;

type FirestoreDate = string | Date | { _seconds: number } | undefined | null;

function toDate(value: FirestoreDate): Date | null {
  if (!value) return null;
  const d = typeof value === "object" && "_seconds" in value ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Spreadsheet-friendly local timestamp, e.g. 2026-10-15 14:05 */
function formatCsvDate(value: FirestoreDate): string {
  const d = toDate(value);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Spreadsheets execute cells starting with these characters as formulas
  if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function resultOutcomeLabel(result: ExamResult): string {
  if (result.gradingStatus === "pending_review" || result.passed === null) return "Awaiting grading";
  return result.passed ? "Passed" : "Failed";
}

/** Fetches every page of results matching the given filters. */
export async function fetchAllResults(
  params: Omit<ExamResultListParams, "page" | "size">,
  onProgress?: (loaded: number, total: number) => void
): Promise<ExamResult[]> {
  const all: ExamResult[] = [];
  for (let page = 1; page <= MAX_EXPORT_PAGES; page++) {
    const res = await api.getExamResults({ ...params, page, size: EXPORT_PAGE_SIZE });
    const rows = res.data || [];
    all.push(...rows);
    const total = res.pagination?.total ?? all.length;
    onProgress?.(all.length, total);
    const totalPages = res.pagination?.totalPages ?? 1;
    if (rows.length === 0 || page >= totalPages) break;
  }
  return all;
}

/** One row per result, with score / percentage / outcome columns for every part that appears in any result. */
export function buildResultsCsv(results: ExamResult[]): string {
  const partNames: string[] = [];
  for (const r of results) {
    for (const part of Object.values(r.partResults || {})) {
      if (part?.partName && !partNames.includes(part.partName)) partNames.push(part.partName);
    }
  }

  const header = [
    "Examinee",
    "Email",
    "Exam",
    "Status",
    "Score",
    "Total points",
    "Percentage",
    "Correct",
    "Incorrect",
    "Total questions",
    "Essays to grade",
    "Time spent (min)",
    "Started",
    "Submitted",
    ...partNames.flatMap((name) => [`${name} score`, `${name} %`, `${name} status`]),
    "Result ID",
  ];

  const rows = results.map((r) => {
    const parts = Object.values(r.partResults || {});
    const partCells = partNames.flatMap((name) => {
      const part = parts.find((p) => p.partName === name);
      if (!part) return ["", "", ""];
      const status = resultOutcomeLabel(r) === "Awaiting grading" ? "Awaiting grading" : part.passed ? "Passed" : "Failed";
      return [`${part.score}/${part.totalPoints}`, part.percentage, status];
    });
    return [
      r.examineeName || "",
      r.examineeEmail || "",
      r.examTitle || "",
      resultOutcomeLabel(r),
      r.score,
      r.totalPoints,
      r.percentage,
      r.correctCount ?? r.correctAnswers ?? "",
      r.incorrectCount ?? "",
      r.totalQuestions,
      r.pendingReviewCount || 0,
      r.timeSpentMinutes ?? "",
      formatCsvDate(r.startedAt),
      formatCsvDate(r.submittedAt || r.createdAt),
      ...partCells,
      r.id,
    ];
  });

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel opens UTF-8 names correctly
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function resultsCsvFilename(examTitle?: string) {
  const slug = (examTitle || "exam-results")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "exam-results"}-${formatCsvDate(new Date()).slice(0, 10)}.csv`;
}
