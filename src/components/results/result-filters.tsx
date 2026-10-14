"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExamResultListParams, ExamResultSortBy, SortOrder } from "@/types";

export type ResultSortKey = "newest" | "oldest" | "score_desc" | "score_asc" | "exam_asc" | "examinee_asc";

const SORTS: Record<ResultSortKey, { label: string; sortBy: ExamResultSortBy; sortOrder: SortOrder }> = {
  newest: { label: "Newest first", sortBy: "date", sortOrder: "desc" },
  oldest: { label: "Oldest first", sortBy: "date", sortOrder: "asc" },
  score_desc: { label: "Highest score", sortBy: "score", sortOrder: "desc" },
  score_asc: { label: "Lowest score", sortBy: "score", sortOrder: "asc" },
  exam_asc: { label: "Exam (A–Z)", sortBy: "examTitle", sortOrder: "asc" },
  examinee_asc: { label: "Examinee (A–Z)", sortBy: "examineeName", sortOrder: "asc" },
};

export interface ResultFilterState {
  search: string;
  status: "all" | "passed" | "failed";
  examId: string;
  sort: ResultSortKey;
  /** yyyy-mm-dd from the date input, in the user's local time zone */
  from: string;
  to: string;
}

export const DEFAULT_RESULT_FILTERS: ResultFilterState = {
  search: "",
  status: "all",
  examId: "all",
  sort: "newest",
  from: "",
  to: "",
};

const SEARCH_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function localDayBound(date: string, endOfDay: boolean): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function isDefaultResultFilters(filters: ResultFilterState): boolean {
  return (Object.keys(DEFAULT_RESULT_FILTERS) as (keyof ResultFilterState)[])
    .every((key) => filters[key] === DEFAULT_RESULT_FILTERS[key]);
}

/** API query params for the filters; search is debounced so typing doesn't refetch on every keystroke. */
export function useResultQueryParams(filters: ResultFilterState): Omit<ExamResultListParams, "page" | "size" | "scope"> {
  const search = useDebouncedValue(filters.search.trim(), SEARCH_DEBOUNCE_MS);
  return useMemo(() => {
    const sort = SORTS[filters.sort];
    return {
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
      ...(search ? { search } : {}),
      ...(filters.status !== "all" ? { status: filters.status } : {}),
      ...(filters.examId !== "all" ? { examId: filters.examId } : {}),
      ...(filters.from ? { from: localDayBound(filters.from, false) } : {}),
      ...(filters.to ? { to: localDayBound(filters.to, true) } : {}),
    };
  }, [search, filters.status, filters.examId, filters.sort, filters.from, filters.to]);
}

/** Page number that resets to 1 whenever the query params change, without an extra fetch. */
export function usePageForParams(params: object): [number, (page: number) => void] {
  const key = JSON.stringify(params);
  const [state, setState] = useState({ key, page: 1 });
  const page = state.key === key ? state.page : 1;
  return [page, (next: number) => setState({ key, page: next })];
}

type ExamOption = { id: string; title: string };

/**
 * The API only lists exam options when no exam filter is applied, so keep the last full list
 * and make sure the selected exam always has an entry.
 */
export function useExamFilterOptions(
  exams: ExamOption[] | undefined,
  selectedExamId: string,
  selectedExamTitle?: string
): ExamOption[] {
  const [known, setKnown] = useState<ExamOption[]>([]);
  useEffect(() => {
    if (exams) setKnown(exams);
  }, [exams]);
  return useMemo(() => {
    if (selectedExamId === "all" || known.some((e) => e.id === selectedExamId)) return known;
    return [...known, { id: selectedExamId, title: selectedExamTitle || "Selected exam" }];
  }, [known, selectedExamId, selectedExamTitle]);
}

interface ResultFiltersProps {
  value: ResultFilterState;
  onChange: (next: ResultFilterState) => void;
  exams: ExamOption[];
  /** Show the examinee sort option (only useful when listing other people's results) */
  showExamineeSort?: boolean;
  searchPlaceholder?: string;
  /** Total results matching the current filters */
  total?: number;
}

export function ResultFilters({
  value,
  onChange,
  exams,
  showExamineeSort = false,
  searchPlaceholder = "Search results...",
  total,
}: ResultFiltersProps) {
  const set = <K extends keyof ResultFilterState>(key: K, next: ResultFilterState[K]) =>
    onChange({ ...value, [key]: next });
  const sortKeys = (Object.keys(SORTS) as ResultSortKey[]).filter(
    (key) => showExamineeSort || key !== "examinee_asc"
  );
  const filtered = !isDefaultResultFilters(value);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={value.search}
            onChange={(e) => set("search", e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={value.examId} onValueChange={(v) => set("examId", v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Filter by exam" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All exams</SelectItem>
            {exams.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value.status} onValueChange={(v) => set("status", v as ResultFilterState["status"])}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="passed">Passed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={value.sort} onValueChange={(v) => set("sort", v as ResultSortKey)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {sortKeys.map((key) => (
              <SelectItem key={key} value={key}>{SORTS[key].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-muted-foreground">
          From
          <Input
            type="date"
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => set("from", e.target.value)}
            className="w-40"
          />
        </label>
        <label className="flex items-center gap-2 text-muted-foreground">
          To
          <Input
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => set("to", e.target.value)}
            className="w-40"
          />
        </label>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_RESULT_FILTERS)}>
            <X className="mr-1 h-4 w-4" /> Clear filters
          </Button>
        )}
        {total !== undefined && (
          <span className="ml-auto text-muted-foreground">
            {total} {total === 1 ? "result" : "results"}
          </span>
        )}
      </div>
    </div>
  );
}
