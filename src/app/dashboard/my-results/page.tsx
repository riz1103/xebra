"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DataTableSkeleton } from "@/components/ui/loading";
import { BarChart3, Trophy, Target } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function MyResultsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-results"],
    queryFn: () => api.getExamResults(),
  });

  const results = data?.data || [];
  const passedCount = results.filter((r) => r.passed).length;
  const avgScore = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Results</h1>
        <p className="text-muted-foreground">View your exam performance and scores.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" /> Total Exams
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
            <h3 className="text-lg font-semibold">No results yet</h3>
            <p className="text-sm text-muted-foreground">Complete exams to see your results here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {results.map((result) => (
            <Card key={result.id} className="transition-shadow hover:shadow-md">
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
                    Score: {result.score}/{result.totalPoints} &middot;
                    Correct: {result.correctAnswers}/{result.totalQuestions} &middot;
                    {formatDate(result.submittedAt || result.createdAt)}
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
          ))}
        </div>
      )}
    </div>
  );
}
