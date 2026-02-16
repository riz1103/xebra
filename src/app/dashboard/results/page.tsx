"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import Link from "next/link";
import { Search, BarChart3, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { ExamResult } from "@/types";

export default function ResultsPage() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [examFilter, setExamFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);

  const isProctorOrAdmin = user?.role === "proctor" || user?.role === "admin";

  const { data: resultsData, isLoading } = useQuery({
    queryKey: ["results", page, examFilter],
    queryFn: () =>
      api.getExamResults({
        page,
        size: DEFAULT_PAGE_SIZE,
        examId: examFilter === "all" ? undefined : examFilter,
      }),
  });

  const { data: examsData } = useQuery({
    queryKey: ["exams"],
    queryFn: () => api.getExams(),
  });

  const { data: fullResultData } = useQuery({
    queryKey: ["exam-result", selectedResult?.id],
    queryFn: () => api.getExamResult(selectedResult!.id),
    enabled: !!selectedResult?.id,
  });

  const resultForReview = fullResultData?.data ?? selectedResult;

  const items = resultsData?.data || [];
  const pagination = resultsData?.pagination;
  const results = items.filter((r) => {
    const matchesSearch = (r.examineeName || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.examTitle || "").toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const exams = examsData?.data || [];

  const totalResults = pagination?.total ?? results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const avgPercentage = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exam Results</h1>
          <p className="text-muted-foreground">View and analyze examination results.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Results</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalResults}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {results.length > 0 ? Math.round((passedCount / results.length) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{avgPercentage}%</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search results..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={examFilter} onValueChange={(v) => { setExamFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by exam" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Exams</SelectItem>
            {exams.map((e) => (<SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {/* Results List */}
      {isLoading ? (
        <DataTableSkeleton rows={6} />
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No results found</h3>
            <p className="text-sm text-muted-foreground mt-1">Results will appear here when examinees complete exams.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {results.map((result) => (
            <Card key={result.id} className="transition-shadow hover:shadow-md cursor-pointer" onClick={() => setSelectedResult(result)}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{result.examineeName || "Examinee"}</p>
                    <Badge variant={result.passed ? "success" : "destructive"} className="text-xs shrink-0">
                      {result.passed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
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
                  <div className="w-24">
                    <Progress value={result.percentage} className="h-2" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedResult(result); }}>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{percentageSafe}%</p>
                    <p className="text-xs text-muted-foreground">Score</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <Badge variant={displayResult.passed ? "success" : "destructive"} className="text-sm">
                      {displayResult.passed ? "PASSED" : "FAILED"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Status</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Examinee</span>
                    <span className="font-medium">{displayResult.examineeName || "N/A"}</span>
                  </div>
                  {displayResult.examineeEmail && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium">{displayResult.examineeEmail}</span>
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
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/dashboard/results/${displayResult.id}/review`}>
                      <Eye className="mr-2 h-4 w-4" />
                      {isProctorOrAdmin ? "Review answers" : "View my answers"}
                    </Link>
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
