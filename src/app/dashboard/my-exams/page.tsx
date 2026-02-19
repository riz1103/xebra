"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import {
  GraduationCap,
  Clock,
  Loader2,
  Play,
  RotateCcw,
  RefreshCw,
  BarChart3,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatDuration } from "@/lib/utils";
import type { ExamForExaminee } from "@/types";

function normalizeExpiresAt(expiresAt: ExamForExaminee["expiresAt"]): string | undefined {
  if (!expiresAt) return undefined;
  if (typeof expiresAt === "object" && "_seconds" in expiresAt) {
    return new Date((expiresAt as { _seconds: number })._seconds * 1000).toISOString();
  }
  return expiresAt as string;
}

export default function MyExamsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [sessionsPage, setSessionsPage] = useState(1);

  const { data: forExamineeData, isLoading: forExamineeLoading } = useQuery({
    queryKey: ["exams-for-examinee"],
    queryFn: () => api.getExamsForExaminee({ page: 1, size: 500 }),
  });

  const { data: sessionsData, isLoading: sessLoading } = useQuery({
    queryKey: ["my-sessions", sessionsPage],
    queryFn: () => api.getExamSessions({ page: sessionsPage, size: DEFAULT_PAGE_SIZE }),
  });

  const { data: resultsData } = useQuery({
    queryKey: ["my-results-for-exams"],
    queryFn: () => api.getExamResults({ page: 1, size: 500 }),
  });

  const allExams = forExamineeData?.data || [];
  const pendingExams = allExams.filter((e) => e.invitationStatus === "pending");
  const inProgressExamsRaw = allExams.filter((e) => e.invitationStatus === "in_progress");
  const completedExams = allExams.filter((e) => e.invitationStatus === "completed");

  const sessions = sessionsData?.data || [];
  const inProgressSessions = sessions.filter(
    (s) => s.status === "in_progress" || s.status === "in-progress"
  );
  // Only show "Attempt again" for an exam if there is no active session for that exam
  const examIdsWithActiveSession = new Set(inProgressSessions.map((s) => s.examId));
  const inProgressExams = inProgressExamsRaw.filter((e) => !examIdsWithActiveSession.has(e.id));
  const sessionsPagination = sessionsData?.pagination;
  const results = resultsData?.data || [];
  const isLoading = forExamineeLoading || sessLoading;

  const startSessionMutation = useMutation({
    mutationFn: (invitationId: string) => api.createExamSession({ invitationId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["exams-for-examinee"] });
      if (data.data) {
        router.push(`/exam/${data.data.id}`);
      }
    },
    onError: (err: Error) => toast.error(err.message || "Failed to start exam"),
  });

  // For completed exams: latest result per exam, and all results per exam (for attempt count + "view all")
  const resultByExamId = new Map<string | undefined, (typeof results)[0]>();
  const allResultsByExamId = new Map<string, (typeof results)[0][]>();
  for (const r of results) {
    const existing = resultByExamId.get(r.examId);
    if (!existing || new Date(r.submittedAt) > new Date(existing.submittedAt)) {
      resultByExamId.set(r.examId, r);
    }
    const list = allResultsByExamId.get(r.examId) ?? [];
    list.push(r);
    allResultsByExamId.set(r.examId, list);
  }
  // Sort each exam's results by submittedAt descending (latest first)
  allResultsByExamId.forEach((list) =>
    list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Exams</h1>
        <p className="text-muted-foreground">
          View your invitations, exams in progress, and completed attempts.
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingExams.length})</TabsTrigger>
          <TabsTrigger value="in-progress">
            In Progress ({inProgressSessions.length + inProgressExams.length})
          </TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedExams.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {isLoading ? (
            <DataTableSkeleton rows={4} />
          ) : pendingExams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No pending exams</h3>
                <p className="text-sm text-muted-foreground">
                  You&apos;ll see exams here when a proctor invites you.
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingExams.map((exam) => {
              const expiresAt = normalizeExpiresAt(exam.expiresAt);
              return (
                <Card key={exam.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between py-5">
                    <div>
                      <h3 className="font-semibold">{exam.title || "Exam"}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {expiresAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires: {formatDate(expiresAt)}
                          </span>
                        )}
                        <span>
                          Attempts: {exam.attemptsUsed}/{exam.maxAttempts}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {exam.status !== "active" && (
                        <span className="text-xs text-muted-foreground">
                          This exam is not available to start
                        </span>
                      )}
                      <Button
                        onClick={() => {
                          if (exam.invitationId && exam.status === "active") {
                            startSessionMutation.mutate(exam.invitationId);
                          }
                        }}
                        disabled={
                          startSessionMutation.isPending ||
                          !exam.invitationId ||
                          exam.status !== "active"
                        }
                      >
                        {startSessionMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        Start Exam
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="in-progress" className="space-y-4">
          {isLoading ? (
            <DataTableSkeleton rows={2} />
          ) : inProgressSessions.length === 0 && inProgressExams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No exams in progress</h3>
                <p className="text-sm text-muted-foreground">
                  Resume a started exam or retry one you can attempt again.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {inProgressSessions.map((session) => (
                <Card
                  key={session.id}
                  className="transition-shadow hover:shadow-md border-amber-200 dark:border-amber-800"
                >
                  <CardContent className="flex items-center justify-between py-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {session.examTitle || session.exam?.title || "Exam"}
                        </h3>
                        <Badge variant="warning">In Progress</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Question {session.currentQuestionIndex + 1}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(session.timeRemainingSeconds)}
                        </span>
                      </div>
                    </div>
                    <Button onClick={() => router.push(`/exam/${session.id}`)}>
                      <RotateCcw className="mr-2 h-4 w-4" /> Resume
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {inProgressExams.map((exam) => {
                const expiresAt = normalizeExpiresAt(exam.expiresAt);
                return (
                  <Card
                    key={`retry-${exam.id}-${exam.invitationId}`}
                    className="transition-shadow hover:shadow-md border-amber-100 dark:border-amber-900/30"
                  >
                    <CardContent className="flex items-center justify-between py-5">
                      <div>
                        <h3 className="font-semibold">{exam.title || "Exam"}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {expiresAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires: {formatDate(expiresAt)}
                            </span>
                          )}
                          <span>
                            Attempts used: {exam.attemptsUsed}/{exam.maxAttempts} — you can retry
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => {
                          if (exam.invitationId && exam.status === "active") {
                            startSessionMutation.mutate(exam.invitationId);
                          }
                        }}
                        disabled={
                          startSessionMutation.isPending ||
                          !exam.invitationId ||
                          exam.status !== "active"
                        }
                        variant="secondary"
                      >
                        {startSessionMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Attempt again
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
          {sessionsPagination && (
            <Pagination
              pagination={sessionsPagination}
              onPageChange={setSessionsPage}
              className="mt-4"
            />
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedExams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No completed exams</h3>
                <p className="text-sm text-muted-foreground">
                  Completed exams and their results will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            completedExams.map((exam) => {
              const latestResult = resultByExamId.get(exam.id);
              const attemptsForExam = allResultsByExamId.get(exam.id) ?? [];
              const attemptCount = attemptsForExam.length;
              const hasMultipleAttempts = attemptCount > 1;
              const passed = latestResult?.passed;
              return (
                <Card
                  key={exam.id}
                  className="transition-shadow hover:shadow-md cursor-pointer opacity-90 hover:opacity-100"
                >
                  <CardContent className="py-5">
                    <Link
                      href={
                        latestResult
                          ? `/dashboard/my-results/${latestResult.id}`
                          : "/dashboard/my-results"
                      }
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                            passed
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {passed ? (
                            <CheckCircle2 className="h-6 w-6" />
                          ) : (
                            <XCircle className="h-6 w-6" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate">{exam.title || "Exam"}</h3>
                            <Badge variant={passed ? "success" : "destructive"}>
                              {passed ? "Passed" : "Failed"}
                            </Badge>
                            {hasMultipleAttempts && (
                              <Badge variant="secondary" className="font-normal">
                                Latest of {attemptCount} attempts
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {latestResult ? (
                              <>
                                {latestResult.percentage}% &middot; Submitted:{" "}
                                {formatDate(latestResult.submittedAt)}
                              </>
                            ) : (
                              <>Attempts: {exam.attemptsUsed}/{exam.maxAttempts}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1 text-sm text-primary hover:underline">
                        <BarChart3 className="h-4 w-4" />
                        View latest result
                      </div>
                    </Link>
                    {hasMultipleAttempts && (
                      <div className="mt-3 pt-3 border-t flex items-center justify-end">
                        <Link
                          href={`/dashboard/my-results?examId=${encodeURIComponent(exam.id)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                          View all {attemptCount} attempts
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
