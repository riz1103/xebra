"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import {
  ResultFilters,
  DEFAULT_RESULT_FILTERS,
  isDefaultResultFilters,
  useExamFilterOptions,
  usePageForParams,
  useResultQueryParams,
  type ResultFilterState,
} from "@/components/results/result-filters";
import Link from "next/link";
import { BarChart3, Download, Eye, Loader2, PenLine, Printer } from "lucide-react";
import { toast } from "sonner";
import { buildResultsCsv, downloadCsv, fetchAllResults, resultsCsvFilename } from "@/lib/results-export";
import { ResultOutcomeBadge, isAwaitingGrading } from "@/components/results/result-outcome-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";
import type { ExamResult } from "@/types";

export default function ResultsPage() {
  const { user } = useAuthStore();
  const [filters, setFilters] = useState<ResultFilterState>(DEFAULT_RESULT_FILTERS);
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);
  const [exporting, setExporting] = useState(false);

  const isProctorOrAdmin = user?.role === "proctor" || user?.role === "admin";
  const queryParams = useResultQueryParams(filters);
  const [page, setPage] = usePageForParams(queryParams);

  const { data: resultsData, isLoading, isFetching } = useQuery({
    queryKey: ["results", "managed", page, queryParams],
    queryFn: () =>
      api.getExamResults({
        scope: "managed",
        page,
        size: DEFAULT_PAGE_SIZE,
        ...queryParams,
      }),
    placeholderData: keepPreviousData,
  });

  const { data: fullResultData } = useQuery({
    queryKey: ["exam-result", selectedResult?.id],
    queryFn: () => api.getExamResult(selectedResult!.id),
    enabled: !!selectedResult?.id,
  });

  const resultForReview = fullResultData?.data ?? selectedResult;

  const results = resultsData?.data || [];
  const pagination = resultsData?.pagination;
  const summary = resultsData?.summary;
  const examOptions = useExamFilterOptions(
    resultsData?.exams,
    filters.examId,
    results.find((r) => r.examId === filters.examId)?.examTitle
  );

  const totalResults = summary?.total ?? pagination?.total ?? results.length;
  const passedCount = summary?.passed ?? results.filter((r) => r.passed).length;
  const avgPercentage = summary?.averagePercentage ?? (results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)
    : 0);
  const passRate = totalResults > 0 ? Math.round((passedCount / totalResults) * 100) : 0;
  const filtersActive = !isDefaultResultFilters(filters);

  const handleExport = async () => {
    setExporting(true);
    try {
      const all = await fetchAllResults({ scope: "managed", ...queryParams });
      if (all.length === 0) {
        toast.info("No results to export.");
        return;
      }
      const examTitle = filters.examId ? all.find((r) => r.examId === filters.examId)?.examTitle : undefined;
      downloadCsv(resultsCsvFilename(examTitle), buildResultsCsv(all));
      toast.success(`Exported ${all.length} result${all.length === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export results");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Exam Results</h1>
          <p className="text-muted-foreground">View and analyze examination results.</p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting || totalResults === 0}
          className="w-full sm:w-auto"
          title={filtersActive ? "Export the results matching the current filters" : "Export all results"}
        >
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {exporting ? "Exporting…" : filtersActive ? "Export filtered CSV" : "Export CSV"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground leading-tight sm:text-sm">Total Results</CardTitle>
          </CardHeader>
          <CardContent><div className="text-xl sm:text-2xl font-bold">{totalResults}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground leading-tight sm:text-sm">Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600">{passRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground leading-tight sm:text-sm">Average Score</CardTitle>
          </CardHeader>
          <CardContent><div className="text-xl sm:text-2xl font-bold">{avgPercentage}%</div></CardContent>
        </Card>
      </div>

      {(summary?.pendingReview ?? 0) > 0 && filters.status !== "pending_review" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <span className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-amber-600" />
            {summary!.pendingReview === 1
              ? "1 result has essay answers waiting for your grade."
              : `${summary!.pendingReview} results have essay answers waiting for your grade.`}
          </span>
          <Button size="sm" variant="outline" onClick={() => setFilters({ ...filters, status: "pending_review" })}>
            Show them
          </Button>
        </div>
      )}

      <ResultFilters
        value={filters}
        onChange={setFilters}
        exams={examOptions}
        showExamineeSort
        searchPlaceholder="Search by examinee name, email, or exam..."
        total={summary?.total ?? pagination?.total}
      />

      {/* Results List */}
      {isLoading ? (
        <DataTableSkeleton rows={6} />
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No results found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filtersActive
                ? "No results match these filters."
                : "Results will appear here when examinees complete exams."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={cn("space-y-3 transition-opacity", isFetching && "opacity-60")}>
          {results.map((result) => (
            <Card key={result.id} className="transition-shadow hover:shadow-md cursor-pointer" onClick={() => setSelectedResult(result)}>
              <CardContent className="flex items-center gap-3 py-4 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{result.examineeName || "Examinee"}</p>
                    <ResultOutcomeBadge result={result} className="text-xs shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {result.examTitle || "Exam"} &middot; {formatDate(result.submittedAt || result.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold">{result.percentage}%</p>
                    <p className="text-xs text-muted-foreground">
                      {result.score}/{result.totalPoints} pts
                    </p>
                  </div>
                  <div className="hidden w-24 sm:block">
                    <Progress value={result.percentage} className="h-2" />
                  </div>
                  <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="View result" onClick={(e) => { e.stopPropagation(); setSelectedResult(result); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination && (
        <Pagination pagination={pagination} onPageChange={setPage} />
      )}

      {/* Result Detail Dialog */}
      <Dialog open={!!selectedResult} onOpenChange={(open) => { if (!open) setSelectedResult(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Exam Result Details</DialogTitle>
            <DialogDescription>{selectedResult?.examTitle || "Exam Result"}</DialogDescription>
          </DialogHeader>
          {selectedResult && (() => {
            const displayResult = resultForReview ?? selectedResult;
            const score = Number(displayResult.score);
            const totalPoints = Number(displayResult.totalPoints);
            const totalQuestions = Number(displayResult.totalQuestions) || 0;
            const correctCount = displayResult.correctCount ?? displayResult.correctAnswers;
            const correctNum = typeof correctCount === "number" ? correctCount : Number(correctCount);
            const correctDisplay = totalQuestions > 0 && !Number.isNaN(correctNum)
              ? `${correctNum}/${totalQuestions}`
              : totalQuestions > 0 ? `—/${totalQuestions}` : "—";
            const scoreDisplay = !Number.isNaN(score) && !Number.isNaN(totalPoints)
              ? `${score}/${totalPoints}`
              : "—";
            const percentage = Number(displayResult.percentage);
            const percentageSafe = Number.isNaN(percentage) ? 0 : Math.min(100, Math.max(0, percentage));
            const hasReviewData = (displayResult.questionResults?.length ?? 0) > 0;
            const canShowReviewButton = isProctorOrAdmin ? hasReviewData : (displayResult.reviewableByExaminee === true && hasReviewData);

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{percentageSafe}%</p>
                    <p className="text-xs text-muted-foreground">Score</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <ResultOutcomeBadge result={displayResult} uppercase className="text-sm" />
                    <p className="text-xs text-muted-foreground mt-1">Status</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Examinee</span>
                    <span className="font-medium">{displayResult.examineeName || "N/A"}</span>
                  </div>
                  {displayResult.examineeEmail && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground shrink-0">Email</span>
                      <span className="font-medium min-w-0 break-all text-right">{displayResult.examineeEmail}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score</span>
                    <span className="font-medium">{scoreDisplay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Correct Answers</span>
                    <span className="font-medium">{correctDisplay}</span>
                  </div>
                  {(displayResult.timeLimitMinutes != null && displayResult.timeLimitMinutes > 0) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time allocated</span>
                      <span className="font-medium">{displayResult.timeLimitMinutes} min</span>
                    </div>
                  )}
                  {(displayResult.timeSpentMinutes != null && displayResult.timeSpentMinutes >= 0) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time spent</span>
                      <span className="font-medium">{displayResult.timeSpentMinutes} min</span>
                    </div>
                  )}
                  {displayResult.startedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Started</span>
                      <span className="font-medium">{formatDate(displayResult.startedAt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ended</span>
                    <span className="font-medium">{formatDate(displayResult.submittedAt || displayResult.createdAt)}</span>
                  </div>
                  {displayResult.feedback && (
                    <div className="pt-2">
                      <p className="text-muted-foreground mb-1">Feedback</p>
                      <p className="rounded-md bg-muted p-2 text-sm">{displayResult.feedback}</p>
                    </div>
                  )}
                </div>
                <Progress value={percentageSafe} className="h-3" />

                {canShowReviewButton && (
                  <Button variant={isAwaitingGrading(displayResult) ? "default" : "outline"} className="w-full" asChild>
                    <Link href={`/dashboard/results/${displayResult.id}/review`}>
                      <Eye className="mr-2 h-4 w-4" />
                      {!isProctorOrAdmin
                        ? "View my answers"
                        : isAwaitingGrading(displayResult)
                          ? displayResult.pendingReviewCount === 1
                            ? "Grade 1 essay answer"
                            : `Grade ${displayResult.pendingReviewCount ?? ""} essay answers`
                          : "Review answers"}
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" className="w-full" asChild>
                  <Link href={`/dashboard/results/${displayResult.id}/slip`}>
                    <Printer className="mr-2 h-4 w-4" /> Print result slip
                  </Link>
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
