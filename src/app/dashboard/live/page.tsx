"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Clock,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn, formatDuration } from "@/lib/utils";
import { alertLevelOf, isIdleSession, sessionIdleMs } from "@/lib/live-monitor";
import { useLiveOverviewMonitor } from "@/hooks/use-live-monitor";
import { LiveAlertsStrip } from "@/components/live/live-alerts-strip";
import { LiveFlagBreakdown } from "@/components/live/live-flag-breakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LiveSession } from "@/types";

const EXTENSION_CHOICES = [5, 10, 15, 30];

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function relativeTime(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export default function LiveOverviewPage() {
  const now = useNow();
  const [submitTarget, setSubmitTarget] = useState<LiveSession | null>(null);
  const [submitReason, setSubmitReason] = useState("");
  const { data: live, isLoading, isFetching, dataUpdatedAt, refetch, error } = useLiveOverviewMonitor();

  const skewMs = useMemo(
    () => (live?.serverTime ? new Date(live.serverTime).getTime() - dataUpdatedAt : 0),
    [live?.serverTime, dataUpdatedAt]
  );

  const extendMutation = useMutation({
    mutationFn: ({ sessionId, minutes }: { sessionId: string; minutes: number }) =>
      api.extendSessionTime(sessionId, minutes),
    onSuccess: (res, { minutes }) => {
      toast.success(res.message || `Added ${minutes} minutes`);
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add time"),
  });

  const forceSubmitMutation = useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: string; reason?: string }) =>
      api.forceSubmitSession(sessionId, reason),
    onSuccess: (res) => {
      toast.success(res.message || "Session submitted");
      setSubmitTarget(null);
      setSubmitReason("");
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to submit session"),
  });

  const remainingSeconds = (session: LiveSession) => {
    if (!session.expiresAt) return null;
    const ends = [session.expiresAt, session.scheduledEndTime]
      .filter((v): v is string => !!v)
      .map((v) => new Date(v).getTime());
    return Math.max(0, Math.floor((Math.min(...ends) - (now + skewMs)) / 1000));
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !live) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-medium">Live overview unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {(error as Error | null)?.message || "Could not load live sessions."}
        </p>
        <Button className="mt-4" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start gap-3 sm:items-center">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            Live sessions
          </h1>
          <p className="text-muted-foreground">All exams you manage · updates as activity happens</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
          Updated {relativeTime(now - dataUpdatedAt)}
        </Button>
      </div>

      <LiveAlertsStrip sessions={live.sessions} nowMs={now} skewMs={skewMs} showExamLink />

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
              <Users className="hidden h-4 w-4 sm:block" /> In progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold sm:text-2xl">{live.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
              <AlertTriangle className="hidden h-4 w-4 sm:block" /> Red flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-xl font-bold sm:text-2xl", live.flaggedCount > 0 && "text-red-600")}>
              {live.flaggedCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
              <Activity className="hidden h-4 w-4 sm:block" /> Idle 3+ min
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-xl font-bold sm:text-2xl", live.idleCount > 0 && "text-amber-600")}>
              {live.idleCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {live.exams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exams</CardTitle>
            <CardDescription>Jump into a single-exam live room</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {live.exams.map((exam) => (
                <li key={exam.examId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{exam.examTitle || "Exam"}</p>
                    <p className="text-xs text-muted-foreground">
                      {exam.inProgress} in progress
                      {exam.flaggedCount > 0 ? ` · ${exam.flaggedCount} flagged` : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/exams/${exam.examId}/live`}>
                      <Radio className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                      Live
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All examinees in progress</CardTitle>
          <CardDescription>Sorted by red-flag severity, then least time remaining</CardDescription>
        </CardHeader>
        <CardContent>
          {live.sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nobody is taking your exams right now.
            </p>
          ) : (
            <ul className="space-y-3">
              {live.sessions.map((session) => {
                const remaining = remainingSeconds(session);
                const idleMs = sessionIdleMs(session, now, skewMs);
                const idle = isIdleSession(session, now, skewMs);
                const level = alertLevelOf(session, now, skewMs);
                const progress =
                  session.totalQuestions > 0
                    ? (session.answeredCount / session.totalQuestions) * 100
                    : 0;
                const busy =
                  (extendMutation.isPending && extendMutation.variables?.sessionId === session.id) ||
                  (forceSubmitMutation.isPending && forceSubmitMutation.variables?.sessionId === session.id);
                return (
                  <li
                    key={session.id}
                    className={cn(
                      "rounded-lg border p-3 sm:p-4",
                      level === "critical" && "border-red-400/70 bg-red-50/50 dark:bg-red-950/20",
                      level === "warning" && "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/15"
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">
                            {session.examineeName || session.examineeEmail || "Examinee"}
                          </p>
                          {level !== "ok" && (
                            <Badge variant={level === "critical" ? "destructive" : "warning"} className="text-[10px]">
                              {level === "critical" ? "Critical" : "Flagged"}
                            </Badge>
                          )}
                          {idle && (
                            <Badge variant="warning" className="text-[10px]">
                              Idle
                            </Badge>
                          )}
                        </div>
                        {session.examId && (
                          <Link
                            href={`/dashboard/exams/${session.examId}/live`}
                            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                          >
                            {session.examTitle || "Exam"}
                          </Link>
                        )}
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-1.5 max-w-xs" />
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {session.answeredCount}/{session.totalQuestions} answered
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          On question {Math.min(session.currentQuestionIndex + 1, session.totalQuestions || 1)}
                          {idleMs != null && <> &middot; last activity {relativeTime(idleMs)}</>}
                        </p>
                        <LiveFlagBreakdown session={session} />
                      </div>
                      <div className="flex items-center gap-3 sm:shrink-0">
                        <div
                          className={cn(
                            "flex items-center gap-1 font-mono text-sm font-semibold tabular-nums",
                            remaining != null && remaining <= 60 && "text-red-600",
                            remaining != null && remaining > 60 && remaining <= 300 && "text-amber-600"
                          )}
                        >
                          <Clock className="h-4 w-4" />
                          {remaining == null ? "No limit" : formatDuration(remaining)}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={busy || remaining == null}>
                              {extendMutation.isPending && extendMutation.variables?.sessionId === session.id ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="mr-1 h-3 w-3" />
                              )}
                              Time
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Add time</DropdownMenuLabel>
                            {EXTENSION_CHOICES.map((minutes) => (
                              <DropdownMenuItem
                                key={minutes}
                                onSelect={() => extendMutation.mutate({ sessionId: session.id, minutes })}
                              >
                                +{minutes} minutes
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={busy}
                          onClick={() => setSubmitTarget(session)}
                        >
                          Submit now
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!submitTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSubmitTarget(null);
            setSubmitReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this exam now?</AlertDialogTitle>
            <AlertDialogDescription>
              {submitTarget?.examineeName || submitTarget?.examineeEmail || "The examinee"}&apos;s exam will end
              immediately and be scored with the {submitTarget?.answeredCount ?? 0} answer
              {submitTarget?.answeredCount === 1 ? "" : "s"} saved so far.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason (optional, kept with the result)"
            value={submitReason}
            onChange={(e) => setSubmitReason(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={forceSubmitMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (submitTarget) {
                  forceSubmitMutation.mutate({
                    sessionId: submitTarget.id,
                    reason: submitReason.trim() || undefined,
                  });
                }
              }}
            >
              {forceSubmitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
