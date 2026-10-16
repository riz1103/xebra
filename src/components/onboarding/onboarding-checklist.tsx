"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Loader2, Rocket, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Exam } from "@/types";

const dismissKey = (uid: string) => `xebra:onboarding-dismissed:${uid}`;

interface OnboardingChecklistProps {
  /** First page of the proctor's exams (already loaded by the dashboard) */
  exams: Exam[];
  totalExams: number;
  totalResults: number;
  isLoading: boolean;
}

/** First-run guide for proctors; hides itself once every step is done or when dismissed. */
export function OnboardingChecklist({ exams, totalExams, totalResults, isLoading }: OnboardingChecklistProps) {
  const { user } = useAuthStore();
  const uid = user?.uid || user?.id || "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (uid) setDismissed(localStorage.getItem(dismissKey(uid)) === "1");
  }, [uid]);

  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ["invitations", "onboarding-count"],
    queryFn: () => api.getExamInvitations({ page: 1, size: 1 }),
    enabled: !dismissed,
  });

  const sampleMutation = useMutation({
    mutationFn: () => api.createSampleExam(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Sample exam created", { description: "Look around, then edit, publish or delete it." });
      if (res.data?.id) router.push(`/dashboard/exams/${res.data.id}`);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create sample exam"),
  });

  const totalInvitations = invitationsData?.pagination?.total ?? invitationsData?.data?.length ?? 0;
  const firstExam = exams[0];
  const steps = [
    {
      label: "Create your first exam",
      description: "Write questions yourself or generate them with AI from your materials.",
      done: totalExams > 0,
      href: "/dashboard/exams/create",
      action: "Create exam",
    },
    {
      label: "Add questions",
      description: "Mix multiple choice, true/false, identification and essay questions.",
      done: exams.some((e) => (e.questionCount ?? 0) > 0),
      href: firstExam ? `/dashboard/exams/${firstExam.id}/edit` : "/dashboard/exams/create",
      action: "Add questions",
    },
    {
      label: "Publish an exam",
      description: "Drafts can't be taken. Publish when the exam is ready.",
      done: exams.some((e) => e.status === "active"),
      href: firstExam ? `/dashboard/exams/${firstExam.id}` : "/dashboard/exams",
      action: "Open exam",
    },
    {
      label: "Invite examinees",
      description: "Send invitations by email, to a group, or share a link.",
      done: totalInvitations > 0,
      href: "/dashboard/invitations",
      action: "Invite",
    },
    {
      label: "Review your first result",
      description: "See scores, grade essays and export results to CSV.",
      done: totalResults > 0,
      href: "/dashboard/results",
      action: "View results",
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  const hasSample = exams.some((e) => e.isSample);

  if (dismissed || isLoading || invitationsLoading || completed === steps.length) return null;

  const dismiss = () => {
    if (uid) localStorage.setItem(dismissKey(uid), "1");
    setDismissed(true);
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" /> Get started with Xevra
          </CardTitle>
          <CardDescription>
            {completed} of {steps.length} steps done. Run your first exam from start to finish.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss getting started guide" className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={(completed / steps.length) * 100} className="h-2" />
        <ol className="space-y-2">
          {steps.map((step) => (
            <li key={step.label} className="flex items-center gap-3 rounded-lg border bg-background p-3">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}>{step.label}</p>
                {!step.done && <p className="text-xs text-muted-foreground">{step.description}</p>}
              </div>
              {!step.done && (
                <Button variant="outline" size="sm" asChild className="shrink-0">
                  <Link href={step.href}>{step.action}</Link>
                </Button>
              )}
            </li>
          ))}
        </ol>
        {!hasSample && (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Not ready to write your own? Start from a sample exam with every question type, including an essay to grade.
            </p>
            <Button size="sm" onClick={() => sampleMutation.mutate()} disabled={sampleMutation.isPending} className="shrink-0">
              {sampleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Try a sample exam
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
