"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn, formatDuration } from "@/lib/utils";
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

const POLL_MS = 10_000;
const IDLE_WARNING_MS = 3 * 60_000;
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

export default function LiveMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const now = useNow();
  const [submitTarget, setSubmitTarget] = useState<LiveSession | null>(null);
  const [submitReason, setSubmitReason] = useState("");

  const { data, isLoading, isFetching, dataUpdatedAt, refetch, error } = useQuery({
    queryKey: ["exam-live", id],
    queryFn: () => api.getLiveSessions(id),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
  const live = data?.data;

  // Server time minus local time when the data arrived, so countdowns ignore local clock skew
  const skewMs = useMemo(
    () => (live?.serverTime ? new Date(live.serverTime).getTime() - dataUpdatedAt : 0),
    [live?.serverTime, dataUpdatedAt]
  );

  useEffect(() => {
    if (live?.autoSubmitted) {
      toast.info(`${live.autoSubmitted} session${live.autoSubmitted === 1 ? "" : "s"} ran out of time and ${live.autoSubmitted === 1 ? "was" : "were"} submitted.`);
    }
  }, [live?.autoSubmitted, dataUpdatedAt]);

  const extendMutation = useMutation({
    mutationFn: ({ sessionId, minutes }: { sessionId: string; minutes: number }) => api.extendSessionTime(sessionId, minutes),
    onSuccess: (res, { minutes }) => {
      toast.success(res.message || `Added ${minutes} minutes`);
      queryClient.invalidateQueries({ queryKey: ["exam-live", id] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add time"),
  });

  const forceSubmitMutation = useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: string; reason?: string }) => api.forceSubmitSession(sessionId, reason),
    onSuccess: (res) => {
      toast.success(res.message || "Session submitted");
      setSubmitTarget(null);
      setSubmitReason("");
      queryClient.invalidateQueries({ queryKey: ["exam-live", id] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
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
        <p className="text-lg font-medium">Live monitor unavailable</p>
        <p className="text-sm text-muted-foreground mt-1">{(error as Error | null)?.message || "This exam could not be loaded."}</p>
        <Button asChild className="mt-4"><Link href={`/dashboard/exams/${id}`}>Back to exam</Link></Button>
      </div>
    );
  }

  const idleCount = live.sessions.filter(
    (s) => s.lastActivityAt && now + skewMs - new Date(s.lastActivityAt).getTime() > IDLE_WARNING_MS
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start gap-3 sm:items-center">
        <Button variant="ghost" size="icon" asChild className="shrink-0" aria-label="Back to exam">
          <Link href={`/dashboard/exams/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            Live monitor
          </h1>
          <p className="text-muted-foreground break-words">{live.examTitle || "Exam"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
          Updated {relativeTime(now - dataUpdatedAt)}
        </Button>
      </div>

      {live.examStatus !== "active" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          This exam is {live.examStatus || "not active"}, so examinees can&apos;t start new sessions.
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
              <Users className="hidden h-4 w-4 sm:block" /> In progress
            </CardTitle>
          </CardHeader>
          <CardContent><div className="text-xl font-bold sm:text-2xl">{live.inProgress}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
              <Activity className="hidden h-4 w-4 sm:block" /> Idle 3+ min
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-xl font-bold sm:text-2xl", idleCount > 0 && "text-amber-600")}>{idleCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
              <Send className="hidden h-4 w-4 sm:block" /> Submitted (3h)
            </CardTitle>
          </CardHeader>
          <CardContent><div className="text-xl font-bold sm:text-2xl">{live.recentResults.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Examinees taking the exam</CardTitle>
          <CardDescription>Refreshes every 10 seconds. Sessions whose time runs out are submitted automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          {live.sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nobody is taking this exam right now.</p>
          ) : (
            <ul className="space-y-3">
              {live.sessions.map((session) => {
                const remaining = remainingSeconds(session);
                const idleMs = session.lastActivityAt ? now + skewMs - new Date(session.lastActivityAt).getTime() : null;
                const idle = idleMs != null && idleMs > IDLE_WARNING_MS;
                const progress = session.totalQuestions > 0 ? (session.answeredCount / session.totalQuestions) * 100 : 0;
                const busy =
                  (extendMutation.isPending && extendMutation.variables?.sessionId === session.id) ||
                  (forceSubmitMutation.isPending && forceSubmitMutation.variables?.sessionId === session.id);
                return (
                  <li key={session.id} className="rounded-lg border p-3 sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{session.examineeName || session.examineeEmail || "Examinee"}</p>
                          {(session.timeMultiplier ?? 1) > 1 && (
                            <Badge variant="secondary" className="text-[10px]" title="Extra-time accommodation">
                              {Number(session.timeMultiplier.toFixed(2))}× time
                            </Badge>
                          )}
                          {session.extraTimeSeconds > 0 && (
                            <Badge variant="secondary" className="text-[10px]">+{Math.round(session.extraTimeSeconds / 60)} min</Badge>
                          )}
                          {idle && <Badge variant="warning" className="text-[10px]">Idle</Badge>}
                          {session.integrityEventCount > 0 && (
                            <Badge variant="outline" className="gap-1 text-[10px] border-amber-400 text-amber-700 dark:text-amber-400">
                              <ShieldAlert className="h-3 w-3" /> {session.integrityEventCount} flag{session.integrityEventCount === 1 ? "" : "s"}
                            </Badge>
                          )}
                        </div>
                        {session.examineeName && session.examineeEmail && (
                          <p className="truncate text-xs text-muted-foreground">{session.examineeEmail}</p>
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
                              {extendMutation.isPending && extendMutation.variables?.sessionId === session.id
                                ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                : <Plus className="mr-1 h-3 w-3" />}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recently submitted</CardTitle>
          <CardDescription>Results from the last 3 hours</CardDescription>
        </CardHeader>
        <CardContent>
          {live.recentResults.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <ul className="divide-y">
              {live.recentResults.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.examineeName || r.examineeEmail || "Examinee"}</p>
                    <p className="text-xs text-muted-foreground">
                      {relativeTime(now + skewMs - new Date(r.submittedAt).getTime())}
                      {r.forceSubmittedBy ? " · submitted by proctor" : r.autoSubmitted ? " · time ran out" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold">{r.percentage}%</span>
                    {r.gradingStatus === "pending_review" ? (
                      <Badge variant="warning">Awaiting grading</Badge>
                    ) : (
                      <Badge variant={r.passed ? "success" : "destructive"}>{r.passed ? "Passed" : "Failed"}</Badge>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/results/${r.id}/review`}>Review</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!submitTarget} onOpenChange={(open) => { if (!open) { setSubmitTarget(null); setSubmitReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this exam now?</AlertDialogTitle>
            <AlertDialogDescription>
              {submitTarget?.examineeName || submitTarget?.examineeEmail || "The examinee"}&apos;s exam will end immediately and be
              scored with the {submitTarget?.answeredCount ?? 0} answer{submitTarget?.answeredCount === 1 ? "" : "s"} saved so far.
              This counts as one of their attempts and can&apos;t be undone.
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
                  forceSubmitMutation.mutate({ sessionId: submitTarget.id, reason: submitReason.trim() || undefined });
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
