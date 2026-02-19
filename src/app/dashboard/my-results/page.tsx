"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { BarChart3, Trophy, Target, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default function MyResultsPage() {
  const [page, setPage] = useState(1);
  const searchParams = useSearchParams();
  const examIdFilter = searchParams.get("examId") ?? undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["my-results", page, examIdFilter],
    queryFn: () =>
      api.getExamResults({
        page,
        size: DEFAULT_PAGE_SIZE,
        ...(examIdFilter ? { examId: examIdFilter } : {}),
      }),
  });

  const results = data?.data || [];
  const pagination = data?.pagination;
  const passedCount = results.filter((r) => r.passed).length;
  const avgScore =
    results.length > 0
      ? Math.round(
          results.reduce((s, r) => s + r.percentage, 0) / results.length
        )
      : 0;

  const examTitle = useMemo(() => {
    if (!examIdFilter || results.length === 0) return null;
    return results[0]?.examTitle ?? "Exam";
  }, [examIdFilter, results]);

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
            <Link
              href="/dashboard/my-results"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1 ml-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              View all results
            </Link>
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
          <CardContent><div className="text-2xl font-bold">{results.length}</div></CardContent>
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

      {isLoading ? (
        <DataTableSkeleton rows={5} />
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">
              {examIdFilter ? "No attempts for this exam" : "No results yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {examIdFilter
                ? "Try viewing all results or check another exam."
                : "Complete exams to see your results here."}
            </p>
            {examIdFilter && (
              <Link
                href="/dashboard/my-results"
                className="mt-4 text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                View all results
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
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
