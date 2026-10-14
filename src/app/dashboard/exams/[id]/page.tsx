"use client";

import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Clock, FileText, Users, Settings, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { QuestionInsights } from "@/components/exam-generator/question-insights";
import { ExamOriginBadge } from "@/components/exam-generator/exam-origin-badge";
import { ShareExamCard } from "@/components/exams/share-exam-card";

export default function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["exam", id],
    queryFn: () => api.getExam(id, { includeQuestions: true }),
  });

  const updateMutation = useMutation({
    mutationFn: (status: string) => api.updateExam(id, { status: status as "draft" | "active" | "archived" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam", id] });
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const exam = data?.data;
  const isUpdatingStatus = updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg font-medium">Exam not found</p>
        <Button asChild className="mt-4"><Link href="/dashboard/exams">Back to Exams</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {(isUpdatingStatus || isFetching) && (
        <div className="flex items-center gap-2 rounded-lg border-2 border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground">
          <Loader2 className="h-5 w-5 animate-spin shrink-0 text-primary" />
          <span>{isUpdatingStatus ? "Updating status…" : "Exam details reloading…"}</span>
        </div>
      )}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/exams"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{exam.title}</h1>
            <Badge variant={exam.status === "active" ? "success" : exam.status === "draft" ? "secondary" : "outline"}>
              {exam.status}
            </Badge>
            <ExamOriginBadge origin={exam.origin} />
          </div>
          {exam.description && <p className="text-muted-foreground mt-1">{exam.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {exam.status === "draft" && (
            <Button onClick={() => updateMutation.mutate("active")} size="sm" disabled={isUpdatingStatus}>
              {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className={isUpdatingStatus ? "ml-2" : ""}>Publish</span>
            </Button>
          )}
          {exam.status === "active" && (
            <Button onClick={() => updateMutation.mutate("archived")} variant="outline" size="sm" disabled={isUpdatingStatus}>
              {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className={isUpdatingStatus ? "ml-2" : ""}>Archive</span>
            </Button>
          )}
          {exam.status === "archived" && (
            <Button onClick={() => updateMutation.mutate("active")} size="sm" disabled={isUpdatingStatus}>
              {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className={isUpdatingStatus ? "ml-2" : ""}>Reactivate</span>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/exams/${exam.id}/edit`}>Edit</Link>
          </Button>
        </div>
      </div>

      <div className="relative">
        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-[2px]" aria-busy="true" aria-live="polite">
            <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-primary/30 bg-card px-6 py-4 shadow-lg">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <span className="text-sm font-medium">Updating exam details…</span>
            </div>
          </div>
        )}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="questions">Questions ({exam.questions?.length || exam.questionCount || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Question Order</span>
                  <span className="font-medium capitalize">{exam.questionOrder}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time Type</span>
                  <span className="font-medium">{exam.timeType === "per_exam" ? "Per Exam" : "Per Question"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time Limit</span>
                  <span className="font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> {exam.timeLimit} min</span>
                </div>
                {exam.numberOfItems && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items per Session</span>
                    <span className="font-medium">
                      {exam.numberOfItems}
                      {exam.questions && ` of ${exam.questions.length} (random)`}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Passing Condition</span>
                  <span className="font-medium">
                    {exam.passingCondition?.value || exam.passingScore || 0}
                    {exam.passingCondition?.type === "percentage" ? "%" : ` ${exam.passingCondition?.type || ""}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Visibility</span>
                  <Badge variant={exam.isPublic ? "success" : "secondary"} className="text-xs">
                    {exam.isPublic ? "Public" : "Private"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{formatDate(exam.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="font-medium">{formatDate(exam.updatedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Questions</span>
                  <span className="font-medium">{exam.questions?.length || exam.questionCount || 0}</span>
                </div>
              </CardContent>
            </Card>

            <ShareExamCard exam={exam} />
          </div>
        </TabsContent>

        <TabsContent value="questions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Exam Questions</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/exams/${exam.id}/edit`}>
                  <Users className="mr-1 h-3 w-3" /> Manage Questions
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {!exam.questions || exam.questions.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No questions added yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {exam.questions.map((q, i) => (
                    <div key={q.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium">Q{i + 1}. {q.questionText}</span>
                        <Badge variant="outline" className="text-xs shrink-0 ml-2">{q.points} pts</Badge>
                      </div>
                      <div className="grid gap-1.5 mt-3">
                        {q.options.map((opt, oi) => {
                          const isCorrect = Array.isArray(q.correctAnswer)
                            ? q.correctAnswer.includes(opt)
                            : q.correctAnswer === opt;
                          return (
                            <div key={oi} className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${isCorrect ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" : ""}`}>
                              <span className="text-xs text-muted-foreground w-5">{String.fromCharCode(65 + oi)}.</span>
                              <span>{opt}</span>
                              {isCorrect && <CheckCircle className="h-3 w-3 ml-auto" />}
                            </div>
                          );
                        })}
                      </div>
                      <QuestionInsights explanation={q.explanation} metadata={q.metadata} className="mt-3" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
