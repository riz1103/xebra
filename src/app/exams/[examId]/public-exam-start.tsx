"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Clock, FileText, Loader2, Play, Target } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { examAppUrl, OpenInAppButton } from "@/components/exams/open-in-app";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

function apiErrorMessage(err: unknown, fallback: string): { status?: number; message: string } {
  const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
  return { status: e?.response?.status, message: e?.response?.data?.message || e?.message || fallback };
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-lg">{children}</Card>
    </div>
  );
}

function Blocked({ title, message }: { title: string; message: string }) {
  const router = useRouter();
  return (
    <CenteredCard>
      <CardContent className="py-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard/my-exams")}>
          Go to My Exams
        </Button>
      </CardContent>
    </CenteredCard>
  );
}

/** Landing page for a shared public exam link (/exams/:id without an invitation). */
export function PublicExamStart({ examId }: { examId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isLoading: authLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(`/exams/${examId}`)}`);
    }
  }, [authLoading, isAuthenticated, router, examId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-exam", examId],
    queryFn: () => api.getExam(examId),
    enabled: isAuthenticated,
    retry: false,
  });
  const exam = data?.data;

  const startMutation = useMutation({
    mutationFn: () => api.createExamSession({ examId }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
      if (res.data) router.push(`/exam/${res.data.id}`);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Failed to start exam").message),
  });

  if (authLoading || !isAuthenticated || isLoading) {
    return (
      <CenteredCard>
        <CardContent className="py-8 text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
          <h2 className="text-lg font-semibold">Loading exam…</h2>
        </CardContent>
      </CenteredCard>
    );
  }

  if (error || !exam) {
    const { status, message } = apiErrorMessage(error, "This exam couldn't be loaded.");
    if (status === 403) {
      return (
        <Blocked
          title="Invitation required"
          message="This exam isn't open to the public. Use the invitation link from your email, or ask the proctor for access."
        />
      );
    }
    if (status === 404) return <Blocked title="Exam not found" message="The link may be wrong, or the exam was deleted." />;
    return <Blocked title="Cannot load exam" message={message} />;
  }

  if (!exam.isPublic) {
    return (
      <Blocked
        title="Invitation required"
        message="This exam isn't open to the public. Examinees need an invitation link to take it."
      />
    );
  }

  if (exam.status !== "active") {
    return (
      <Blocked
        title={exam.status === "draft" ? "Not open yet" : "Exam closed"}
        message={
          exam.status === "draft"
            ? "The proctor hasn't published this exam yet. Try the link again later."
            : "This exam is no longer accepting new attempts."
        }
      />
    );
  }

  const passing = exam.passingCondition;

  return (
    <CenteredCard>
      <CardHeader>
        <CardTitle className="text-2xl">{exam.title}</CardTitle>
        {exam.description && <CardDescription>{exam.description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 rounded-lg bg-muted p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Time limit</span>
            <span className="font-medium">{exam.timeLimit} min</span>
          </div>
          {(exam.numberOfItems || exam.questionCount) && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Items</span>
              <span className="font-medium">{exam.numberOfItems || exam.questionCount}</span>
            </div>
          )}
          {passing && passing.value > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Target className="h-3.5 w-3.5" /> To pass</span>
              <span className="font-medium">
                {passing.value}
                {passing.type === "percentage" ? "%" : ` ${passing.type}`}
              </span>
            </div>
          )}
        </div>
        {exam.instruction && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Instructions</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{exam.instruction}</p>
          </div>
        )}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            The timer starts when the exam starts. Open the Xevra app, or continue in this browser.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button className="h-11" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
          {startMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Continue in the browser
        </Button>
        <OpenInAppButton href={examAppUrl({ examId })} className="h-11" />
        <Button variant="ghost" className="h-11" onClick={() => router.push("/dashboard/my-exams")}>Cancel</Button>
      </CardFooter>
    </CenteredCard>
  );
}
