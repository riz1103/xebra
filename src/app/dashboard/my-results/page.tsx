"use client";

import { useState, useMemo, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  ResultFilters,
  DEFAULT_RESULT_FILTERS,
  isDefaultResultFilters,
  useExamFilterOptions,
  usePageForParams,
  useResultQueryParams,
  type ResultFilterState,
} from "@/components/results/result-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { BarChart3, Trophy, Target, ArrowLeft } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import Link from "next/link";

export default function MyResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlExamId = searchParams.get("examId") ?? undefined;
  const [filters, setFilters] = useState<ResultFilterState>(() => ({
    ...DEFAULT_RESULT_FILTERS,
    examId: urlExamId ?? "all",
  }));

  useEffect(() => {
    if (urlExamId) setFilters((prev) => ({ ...prev, examId: urlExamId }));
  }, [urlExamId]);

  const examIdFilter = filters.examId !== "all" ? filters.examId : undefined;
  const queryParams = useResultQueryParams(filters);
  const [page, setPage] = usePageForParams(queryParams);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["my-results", page, queryParams],
    queryFn: () =>
      api.getExamResults({
        scope: "mine",
        page,
        size: DEFAULT_PAGE_SIZE,
        ...queryParams,
      }),
    placeholderData: keepPreviousData,
  });

  const results = data?.data || [];
  const pagination = data?.pagination;
  const summary = data?.summary;
  const totalCount = summary?.total ?? pagination?.total ?? results.length;
  const passedCount = summary?.passed ?? results.filter((r) => r.passed).length;
  const avgScore = summary?.averagePercentage ?? (
    results.length > 0
      ? Math.round(
          results.reduce((s, r) => s + r.percentage, 0) / results.length
        )
      : 0
  );
  const filtersActive = !isDefaultResultFilters(filters);

  const examTitle = useMemo(() => {
    if (!examIdFilter) return null;
    return results.find((r) => r.examId === examIdFilter)?.examTitle ?? null;
  }, [examIdFilter, results]);
  const examOptions = useExamFilterOptions(data?.exams, filters.examId, examTitle ?? undefined);

  const handleFiltersChange = (next: ResultFilterState) => {
    setFilters(next);
    if (urlExamId && next.examId !== urlExamId) {
      router.replace("/dashboard/my-results");
    }
  };

  const showAllResults = () => handleFiltersChange({ ...filters, examId: "all" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Results</h1>
        <p className="text-muted-foreground">View your exam performance and scores.</p>
      </div>

      {examIdFilter && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Showing all attempts for:</span>
            <span className="font-medium">{examTitle ?? "Exam"}</span>
            <button
              type="button"
              onClick={showAllResults}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1 ml-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              View all results
            </button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" /> {examIdFilter ? "Attempts" : "Total Exams"}
            </CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Passed
            </CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{passedCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Average Score
            </CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{avgScore}%</div></CardContent>
        </Card>
      </div>

      <ResultFilters
        value={filters}
        onChange={handleFiltersChange}
        exams={examOptions}
        searchPlaceholder="Search by exam title..."
        total={summary?.total ?? pagination?.total}
      />

      {isLoading ? (
        <DataTableSkeleton rows={5} />
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">
              {filtersActive ? "No matching results" : "No results yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {filtersActive
                ? "Try a different search or clear the filters."
                : "Complete exams to see your results here."}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={() => handleFiltersChange(DEFAULT_RESULT_FILTERS)}
                className="mt-4 text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                View all results
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={cn("space-y-3 transition-opacity", isFetching && "opacity-60")}>
          {results.map((result) => (
            <Link key={result.id} href={`/dashboard/my-results/${result.id}`} className="block">
              <Card className="transition-shadow hover:shadow-md cursor-pointer">
                <CardContent className="flex items-center gap-4 py-5">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${
                  result.passed
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                  {result.percentage}%
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{result.examTitle || "Exam"}</h3>
                    <Badge variant={result.passed ? "success" : "destructive"} className="shrink-0">
                      {result.passed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Points: {result.score}/{result.totalPoints} &middot;
                    {(() => {
                      // Use correctCount from API, fallback to correctAnswers, or calculate if needed
                      let correctCount = result.correctCount ?? result.correctAnswers;
                      
                      // If still missing and all questions are worth 1 point, calculate from score
                      if (correctCount === undefined && result.totalQuestions > 0 && result.totalPoints === result.totalQuestions) {
                        correctCount = result.score;
                      }
                      
                      // Only show "Correct" if we have a valid count
                      if (result.totalQuestions > 0 && correctCount !== undefined) {
                        return <>Correct: {correctCount}/{result.totalQuestions} &middot; </>;
                      }
                      return null;
                    })()}
                    {result.startedAt && (
                      <>Started: {formatDate(result.startedAt)} &middot; </>
                    )}
                    Submitted: {formatDate(result.submittedAt || result.createdAt)}
                  </p>
                  {result.feedback && (
                    <p className="text-xs text-muted-foreground mt-1 italic">Feedback: {result.feedback}</p>
                  )}
                </div>
                <div className="w-20 shrink-0">
                  <Progress value={result.percentage} className="h-2" />
                </div>
              </CardContent>
            </Card>
            </Link>
          ))}
        </div>
      )}

      {pagination && (
        <Pagination pagination={pagination} onPageChange={setPage} />
      )}
    </div>
  );
}
