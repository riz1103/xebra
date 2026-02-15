"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Trophy, Target, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function MyResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ["exam-result", id],
    queryFn: () => api.getExamResult(id),
  });

  const result = data?.data;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg font-medium">Result not found</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/my-results">Back to Results</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/my-results">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{result.examTitle || "Exam Result"}</h1>
          <p className="text-muted-foreground">
            Submitted {formatDate(result.submittedAt || result.createdAt)}
          </p>
        </div>
      </div>

      {/* Score Card */}
      <Card className={result.passed ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800"}>
        <CardContent className="py-8">
          <div className="flex flex-col items-center text-center">
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ${
                result.passed
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {result.percentage}%
            </div>
            <div className="mt-4 flex items-center gap-2">
              {result.passed ? (
                <Trophy className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <Badge
                variant={result.passed ? "success" : "destructive"}
                className="text-sm px-4 py-1"
              >
                {result.passed ? "PASSED" : "FAILED"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Score: {result.score} out of {result.totalPoints} points
            </p>
          </div>

          <div className="mt-6 px-8">
            <Progress
              value={result.percentage}
              className={`h-3 ${result.passed ? "[&>div]:bg-emerald-500" : "[&>div]:bg-red-500"}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Result Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Exam</span>
            <span className="font-medium">{result.examTitle || "N/A"}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Score</span>
            <span className="font-medium">
              {result.score} / {result.totalPoints} points
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Percentage</span>
            <span className="font-medium">{result.percentage}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Correct Answers</span>
            <span className="font-medium flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              {result.correctCount ?? result.correctAnswers ?? 0} / {result.totalQuestions}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={result.passed ? "success" : "destructive"}>
              {result.passed ? "Passed" : "Failed"}
            </Badge>
          </div>
          {result.startedAt && (
            <>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Started
                </span>
                <span className="font-medium">
                  {formatDate(result.startedAt)}
                </span>
              </div>
            </>
          )}
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Submitted
            </span>
            <span className="font-medium">
              {formatDate(result.submittedAt || result.createdAt)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Part Results */}
      {result.partResults && Object.keys(result.partResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" /> Part Results
            </CardTitle>
            <CardDescription>Detailed results for each exam part</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.values(result.partResults).map((partResult) => (
              <div
                key={partResult.partId}
                className={`rounded-lg border p-4 space-y-3 ${
                  partResult.passed
                    ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
                    : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{partResult.partName}</h4>
                  <Badge variant={partResult.passed ? "success" : "destructive"}>
                    {partResult.passed ? "Passed" : "Failed"}
                  </Badge>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score</span>
                    <span className="font-medium">
                      {partResult.score} / {partResult.totalPoints} points
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Percentage</span>
                    <span className="font-medium">{partResult.percentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Correct Answers</span>
                    <span className="font-medium flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      {partResult.correctCount} / {partResult.totalQuestions}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Questions</span>
                    <span className="font-medium">{partResult.totalQuestions}</span>
                  </div>
                </div>
                {partResult.passingCondition && (
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Passing Requirement</span>
                      <span className="font-medium">
                        {partResult.passingCondition.type === "percentage"
                          ? `${partResult.passingCondition.value}%`
                          : partResult.passingCondition.type === "points"
                          ? `${partResult.passingCondition.value} points`
                          : `${partResult.passingCondition.value} correct answers`}
                      </span>
                    </div>
                  </div>
                )}
                {!partResult.passed && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      This part did not meet the passing requirement.
                    </AlertDescription>
                  </Alert>
                )}
                <Progress
                  value={partResult.percentage}
                  className={`h-2 ${partResult.passed ? "[&>div]:bg-emerald-500" : "[&>div]:bg-red-500"}`}
                />
              </div>
            ))}
            {!result.passed && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Exam failed because one or more parts did not meet their passing requirements.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      {result.feedback && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proctor Feedback</CardTitle>
            <CardDescription>Review notes from your proctor</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm rounded-lg bg-muted p-4">{result.feedback}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <Link href="/dashboard/my-results">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Results
          </Link>
        </Button>
      </div>
    </div>
  );
}
