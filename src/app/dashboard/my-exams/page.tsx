"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
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
  Calendar,
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

function normalizeScheduledTime(scheduledTime: ExamForExaminee["scheduledStartTime"]): string | undefined {
  if (!scheduledTime) return undefined;
  if (typeof scheduledTime === "object" && "_seconds" in scheduledTime) {
    return new Date((scheduledTime as { _seconds: number })._seconds * 1000).toISOString();
  }
  return scheduledTime as string;
}

// Hook to get countdown until a scheduled time
function useCountdown(scheduledTime: string | undefined) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!scheduledTime) {
      setIsReady(true);
      setTimeRemaining(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const scheduled = new Date(scheduledTime).getTime();
      const diff = scheduled - now;

      if (diff <= 0) {
        setTimeRemaining(0);
        setIsReady(true);
      } else {
        setTimeRemaining(diff);
        setIsReady(false);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [scheduledTime]);

  return { timeRemaining, isReady };
}

// Component to display countdown
function CountdownDisplay({ timeRemaining }: { timeRemaining: number }) {
  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  if (days > 0) {
    return <span>{days}d {hours}h {minutes}m</span>;
  }
  if (hours > 0) {
    return <span>{hours}h {minutes}m {seconds}s</span>;
  }
  if (minutes > 0) {
    return <span>{minutes}m {seconds}s</span>;
  }
  return <span>{seconds}s</span>;
}

// Normalize a date value that may be a Firestore timestamp or an ISO string
function normalizeDate(value: string | { _seconds: number; _nanoseconds?: number } | undefined): number | null {
  if (!value) return null;
  if (typeof value === "object" && "_seconds" in value) {
    return value._seconds * 1000;
  }
  const t = new Date(value as string).getTime();
  return isNaN(t) ? null : t;
}

// Live countdown for in-progress sessions — starts from timeRemainingSeconds
// at mount time and ticks down, since the list API's updatedAt may be stale
function LiveSessionTimer({ timeRemainingSeconds }: { timeRemainingSeconds: number }) {
  const [remaining, setRemaining] = useState(timeRemainingSeconds);

  useEffect(() => {
    setRemaining(timeRemainingSeconds); // reset if prop changes (refetch)
    if (timeRemainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeRemainingSeconds]);

  if (timeRemainingSeconds <= 0) return null; // no time limit

  const urgent = remaining <= 60;
  return (
    <span className={`flex items-center gap-1 font-medium tabular-nums ${urgent ? "text-red-500 dark:text-red-400" : ""}`}>
      <Clock className="h-3 w-3" />
      {formatDuration(remaining)}
    </span>
  );
}

// Component for pending exam card with countdown
function PendingExamCard({
  exam,
  expiresAt,
  scheduledStartTime,
  startSessionMutation,
}: {
  exam: ExamForExaminee;
  expiresAt: string | undefined;
  scheduledStartTime: string | undefined;
  startSessionMutation: UseMutationResult<any, unknown, string, unknown>;
}) {
  const { timeRemaining, isReady } = useCountdown(scheduledStartTime);
  const canStart = exam.status === "active" && (!scheduledStartTime || isReady);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center justify-between py-5">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{exam.title || "Exam"}</h3>
            {scheduledStartTime && (
              <Badge variant="secondary" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Scheduled
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {scheduledStartTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Starts: {formatDate(scheduledStartTime)}
                {timeRemaining !== null && timeRemaining > 0 && (
                  <>
                    {" "}
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      (in <CountdownDisplay timeRemaining={timeRemaining} />)
                    </span>
                  </>
                )}
              </span>
            )}
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
          {scheduledStartTime && !isReady && timeRemaining !== null && timeRemaining > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Available in <CountdownDisplay timeRemaining={timeRemaining} />
            </span>
          )}
          <Button
            onClick={() => {
              if (exam.invitationId && canStart) {
                startSessionMutation.mutate(exam.invitationId);
              }
            }}
            disabled={
              startSessionMutation.isPending ||
              !exam.invitationId ||
              !canStart
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

  // Also fetch all sessions to determine completed exams (not just paginated ones)
  const { data: allSessionsData } = useQuery({
    queryKey: ["my-sessions-all"],
    queryFn: () => api.getExamSessions({ page: 1, size: 500 }),
  });

  const { data: resultsData } = useQuery({
    queryKey: ["my-results-for-exams"],
    queryFn: () => api.getExamResults({ page: 1, size: 500 }),
  });

  const allExams = forExamineeData?.data || [];
  
  // Helper to check if an exam should be considered pending
  // An exam is pending if:
  // 1. invitationStatus is "pending", OR
  // 2. Has scheduledStartTime in the future and hasn't used all attempts (but NOT if status is "completed")
  const isPendingExam = (exam: ExamForExaminee): boolean => {
    // If already completed, it's not pending
    if (exam.invitationStatus === "completed") return false;
    
    if (exam.invitationStatus === "pending") return true;
    
    // Check if exam has a scheduled start time in the future
    if (exam.scheduledStartTime) {
      const scheduledStart = new Date(exam.scheduledStartTime);
      const now = new Date();
      const hasAttemptsRemaining = exam.attemptsUsed < exam.maxAttempts;
      
      // If scheduled start is in the future and has attempts remaining, it should be pending
      if (scheduledStart > now && hasAttemptsRemaining) {
        return true;
      }
    }
    
    return false;
  };

  const sessions = sessionsData?.data || [];
  const allSessions = allSessionsData?.data || [];
  const inProgressSessions = sessions.filter(
    (s) => s.status === "in_progress" || s.status === "in-progress"
  );
  // Use all sessions (not just paginated) to find completed sessions
  // Fallback to paginated sessions if allSessionsData is not yet loaded
  const sessionsToCheck = allSessions.length > 0 ? allSessions : sessions;
  const completedSessions = sessionsToCheck.filter((s) => s.status === "completed");

  // Compute active session exam IDs BEFORE filtering pending/in-progress exams
  // so we can exclude exams with an active session from the Pending tab
  const examIdsWithActiveSession = new Set(inProgressSessions.map((s) => s.examId));

  // An exam is pending only if it has no active session in progress
  const pendingExams = allExams.filter(
    (e) => isPendingExam(e) && !examIdsWithActiveSession.has(e.id)
  );
  const inProgressExamsRaw = allExams.filter((e) => e.invitationStatus === "in_progress");
  const inProgressExams = inProgressExamsRaw.filter((e) => !examIdsWithActiveSession.has(e.id));
  const sessionsPagination = sessionsData?.pagination;
  const results = resultsData?.data || [];

  // Build completed exam entries directly from sessions and results (grouped by examId).
  // We do NOT rely on allExams because /exams/for-examinee may not return completed exams.
  // First, collect all unique examIds from completed sessions and results
  const completedExamIds = new Set<string>();
  for (const s of completedSessions) {
    if (s.examId) completedExamIds.add(s.examId);
  }
  for (const r of results) {
    if (r.examId) completedExamIds.add(r.examId);
  }
  
  // Build one entry per unique examId
  const completedExamMap = new Map<string, { examId: string; examTitle: string; sessions: typeof completedSessions }>();
  for (const examId of completedExamIds) {
    // Find the best title from sessions or results
    let examTitle = "Exam";
    const sessionWithTitle = completedSessions.find((s) => s.examId === examId && (s.examTitle || s.exam?.title));
    if (sessionWithTitle) {
      examTitle = sessionWithTitle.examTitle || sessionWithTitle.exam?.title || "Exam";
    } else {
      const resultWithTitle = results.find((r) => r.examId === examId && r.examTitle);
      if (resultWithTitle && resultWithTitle.examTitle) {
        examTitle = resultWithTitle.examTitle;
      }
    }
    
    completedExamMap.set(examId, {
      examId,
      examTitle,
      sessions: completedSessions.filter((s) => s.examId === examId),
    });
  }
  const completedExamEntries = Array.from(completedExamMap.values());

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
    onError: (err: unknown) => {
      // Extract error message from Axios error response
      let errorMessage = "Failed to start exam";
      if (err && typeof err === "object") {
        // Check if it's an Axios error with response data
        const axiosError = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
        if (axiosError.response?.data?.message) {
          errorMessage = axiosError.response.data.message;
        } else if (axiosError.response?.data?.error) {
          errorMessage = axiosError.response.data.error;
        } else if (axiosError.message) {
          errorMessage = axiosError.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      toast.error(errorMessage);
    },
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
          <TabsTrigger value="completed">Completed ({completedExamEntries.length})</TabsTrigger>
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
              const scheduledStartTime = normalizeScheduledTime(exam.scheduledStartTime);
              return (
                <PendingExamCard
                  key={exam.id}
                  exam={exam}
                  expiresAt={expiresAt}
                  scheduledStartTime={scheduledStartTime}
                  startSessionMutation={startSessionMutation}
                />
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
                        <LiveSessionTimer
                          timeRemainingSeconds={session.timeRemainingSeconds}
                        />
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
          {isLoading ? (
            <DataTableSkeleton rows={4} />
          ) : completedExamEntries.length === 0 ? (
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
            completedExamEntries.map((entry) => {
              const latestResult = resultByExamId.get(entry.examId);
              const attemptsForExam = allResultsByExamId.get(entry.examId) ?? [];
              const attemptCount = attemptsForExam.length;
              const hasMultipleAttempts = attemptCount > 1;
              const passed = latestResult?.passed;
              return (
                <Card
                  key={entry.examId}
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
                            <h3 className="font-semibold truncate">{entry.examTitle}</h3>
                            {latestResult && (
                            <Badge variant={passed ? "success" : "destructive"}>
                              {passed ? "Passed" : "Failed"}
                            </Badge>
                            )}
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
                              <>Sessions completed: {entry.sessions.length}</>
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
                          href={`/dashboard/my-results?examId=${encodeURIComponent(entry.examId)}`}
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
