"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { ExamQuestion, QuestionResult, ExamResult, ExamReconciliation, ReconcileQuestionPayload } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PageLoader } from "@/components/ui/loading";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Scale,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ResultReviewPage({ params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPart, setCurrentPart] = useState<string | null>(null);
  const [reviewOverrides, setReviewOverrides] = useState<QuestionResult[]>([]);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [reconcileType, setReconcileType] = useState<"new_answer" | "bonus">("new_answer");
  const [reconcileNewAnswer, setReconcileNewAnswer] = useState<string>("");
  const [reconcileNoAnswerCountsCorrect, setReconcileNoAnswerCountsCorrect] = useState(true);

  const { data: resultData, isLoading: resultLoading } = useQuery({
    queryKey: ["exam-result", resultId],
    queryFn: () => api.getExamResult(resultId),
    enabled: !!resultId,
  });

  const result = resultData?.data;

  const { data: examData, isLoading: examLoading } = useQuery({
    queryKey: ["exam", result?.examId],
    queryFn: () => api.getExam(result!.examId, { includeQuestions: true }),
    enabled: !!result?.examId,
  });

  const exam = examData?.data;
  const questionsStillLoading = !!result?.examId && examLoading;

  const isProctorOrAdmin = user?.role === "proctor" || user?.role === "admin";
  const isExaminee = user && result && (user.id === result.examineeId || user.uid === result.examineeId);
  const canGrade = isProctorOrAdmin;
  const canViewAsExaminee = isExaminee && result?.reviewableByExaminee === true;
  const allowed = canGrade || canViewAsExaminee;

  const { data: reconciliationsData } = useQuery({
    queryKey: ["exam-reconciliations", result?.examId],
    queryFn: () => api.getExamReconciliations(result!.examId),
    enabled: !!result?.examId && canGrade,
  });
  const reconciliations = reconciliationsData?.data ?? [];

  const questionsById = useMemo(
    () => (exam?.questions || []).reduce<Record<string, ExamQuestion>>((acc, q) => {
      acc[q.id] = q;
      return acc;
    }, {}),
    [exam?.questions]
  );

  const updateResultMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ExamResult> }) =>
      api.updateExamResult(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-result", resultId] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
      queryClient.invalidateQueries({ queryKey: ["my-results"] });
      setReviewOverrides([]);
      toast.success("Review saved. Score updated.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save review"),
  });

  const setQuestionCorrect = useCallback((questionId: string, isCorrect: boolean) => {
    setReviewOverrides((prev) => {
      const base = result?.questionResults ?? [];
      const existing = prev.length > 0 ? prev : base;
      const next = existing.map((r) =>
        r.questionId === questionId
          ? { ...r, isCorrect, score: isCorrect ? r.points : 0 }
          : r
      );
      return next;
    });
  }, [result?.questionResults]);

  const reconcileMutation = useMutation({
    mutationFn: (payload: ReconcileQuestionPayload) =>
      api.reconcileQuestion(result!.examId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["exam-reconciliations", result?.examId] });
      queryClient.invalidateQueries({ queryKey: ["exam-result", resultId] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
      queryClient.invalidateQueries({ queryKey: ["my-results"] });
      const updated = data?.data?.resultsUpdated;
      toast.success(updated != null ? `Reconciliation saved. ${updated} result(s) re-scored.` : "Reconciliation saved.");
      setReconcileDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save reconciliation"),
  });

  const removeReconciliationMutation = useMutation({
    mutationFn: (questionId: string) => api.removeReconciliation(result!.examId, questionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["exam-reconciliations", result?.examId] });
      queryClient.invalidateQueries({ queryKey: ["exam-result", resultId] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
      queryClient.invalidateQueries({ queryKey: ["my-results"] });
      const updated = data?.data?.resultsUpdated;
      toast.success(updated != null ? `Reconciliation removed. ${updated} result(s) re-scored.` : "Reconciliation removed.");
      setReconcileDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to remove reconciliation"),
  });

  const orderedQuestions = useMemo(() => {
    const qr = result?.questionResults ?? [];
    return qr
      .map((r) => questionsById[r.questionId])
      .filter((q): q is ExamQuestion => q != null);
  }, [result?.questionResults, questionsById]);

  const hasParts = useMemo(() => {
    if (!exam?.parts?.length || !exam.questions?.length) return false;
    const withPart = exam.questions.some((q) => q.partId);
    return withPart;
  }, [exam?.parts, exam?.questions]);

  const questionsByPart = useMemo(() => {
    if (!hasParts || !exam?.parts?.length || !orderedQuestions.length) return null;
    const partIds = exam.parts!.map((p) => p.id);
    const map: Record<
      string,
      { part: { id: string; name: string; description?: string }; questions: ExamQuestion[] }
    > = {};
    partIds.forEach((partId) => {
      const part = exam.parts!.find((p) => p.id === partId);
      if (!part) return;
      const questions = orderedQuestions.filter((q) => (q as ExamQuestion & { partId?: string }).partId === partId);
      if (questions.length > 0) {
        map[partId] = {
          part: { id: part.id, name: part.name, description: part.description ?? undefined },
          questions,
        };
      }
    });
    const uncategorized = orderedQuestions.filter(
      (q) => !partIds.includes((q as ExamQuestion & { partId?: string }).partId ?? "")
    );
    if (uncategorized.length > 0 && partIds.length > 0) {
      const firstPartId = partIds[0];
      if (map[firstPartId]) {
        map[firstPartId].questions = [...map[firstPartId].questions, ...uncategorized];
      } else {
        const part = exam.parts!.find((p) => p.id === firstPartId);
        if (part) {
          map[firstPartId] = {
            part: { id: part.id, name: part.name, description: part.description ?? undefined },
            questions: uncategorized,
          };
        }
      }
    }
    return Object.keys(map).length > 0 ? map : null;
  }, [hasParts, exam?.parts, exam?.questions, orderedQuestions]);

  const currentQuestions = questionsByPart && currentPart
    ? questionsByPart[currentPart]?.questions ?? orderedQuestions
    : orderedQuestions;
  const currentQuestion = currentQuestions[currentIndex];

  const answers = (result?.answers || {}) as Record<string, string | string[]>;
  const effectiveResults = reviewOverrides.length > 0 ? reviewOverrides : (result?.questionResults ?? []);
  const resultByQuestionId = effectiveResults.reduce<Record<string, QuestionResult>>((acc, r) => {
    acc[r.questionId] = r;
    return acc;
  }, {});

  const correctCount = effectiveResults.filter((r) => r.isCorrect).length;
  const totalPoints = Number(result?.totalPoints) || 0;
  const totalQuestions = orderedQuestions.length;
  const progressPercentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

  const hasDirtyReview =
    canGrade &&
    reviewOverrides.length > 0 &&
    JSON.stringify(reviewOverrides) !== JSON.stringify(result?.questionResults ?? []);

  const handleSaveReview = useCallback(() => {
    if (!resultId || !result || reviewOverrides.length === 0) return;
    const newScore = reviewOverrides.reduce((s, r) => s + r.score, 0);
    const newCorrectCount = reviewOverrides.filter((r) => r.isCorrect).length;
    const newPercentage = totalPoints > 0 ? Math.round((newScore / totalPoints) * 100) : 0;
    const passingValue =
      result.passingScore ??
      (result.passingCondition?.type === "percentage" ? result.passingCondition.value : undefined) ??
      60;
    const passed = newPercentage >= passingValue;
    updateResultMutation.mutate({
      id: resultId,
      payload: {
        questionResults: reviewOverrides,
        score: newScore,
        correctCount: newCorrectCount,
        percentage: newPercentage,
        passed,
      },
    });
  }, [resultId, result, reviewOverrides, totalPoints, updateResultMutation]);

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < currentQuestions.length) setCurrentIndex(index);
  };

  const goToPart = (partId: string) => {
    setCurrentPart(partId);
    setCurrentIndex(0);
  };

  useEffect(() => {
    if (questionsByPart && !currentPart && Object.keys(questionsByPart).length > 0) {
      setCurrentPart(Object.keys(questionsByPart)[0]);
      setCurrentIndex(0);
    }
  }, [questionsByPart, currentPart]);

  if (resultLoading || !result) {
    return <PageLoader />;
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold">Access denied</h2>
            <p className="text-sm text-muted-foreground mt-2">
              You do not have permission to view this result review.
            </p>
            <Button className="mt-4" asChild>
              <Link href={isProctorOrAdmin ? "/dashboard/results" : "/dashboard/my-results"}>
                Go back
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (questionsStillLoading) {
    return <PageLoader />;
  }

  if (orderedQuestions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No question-level data available for this result.</p>
            <Button className="mt-4" asChild>
              <Link href={canGrade ? "/dashboard/results" : "/dashboard/my-results"}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const backHref = canGrade ? "/dashboard/results" : "/dashboard/my-results";
  const isMultipleAnswer =
    currentQuestion &&
    Array.isArray(currentQuestion.correctAnswer) &&
    currentQuestion.correctAnswer.length > 1;
  const rawUserAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const userAnswerArr = Array.isArray(rawUserAnswer) ? rawUserAnswer : rawUserAnswer ? [rawUserAnswer] : [];
  const userAnswerStr = typeof rawUserAnswer === "string" ? rawUserAnswer : null;
  const qResult = currentQuestion ? resultByQuestionId[currentQuestion.id] : null;
  const isCorrect = qResult?.isCorrect ?? false;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href={backHref}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <Image src="/xevra-logo.png" alt="Xevra" width={32} height={32} className="rounded-lg" />
            <span className="text-sm font-semibold hidden sm:inline">
              Review: {result.examTitle || exam?.title || "Exam"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canGrade && (
              <Badge variant="secondary" className="text-xs">
                Proctor review
              </Badge>
            )}
            {hasDirtyReview && (
              <Button
                size="sm"
                onClick={handleSaveReview}
                disabled={updateResultMutation.isPending}
              >
                {updateResultMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save &amp; update score
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>
            {correctCount} of {totalQuestions} correct
          </span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Part Tabs */}
      {hasParts && questionsByPart && (
        <div className="mx-auto max-w-5xl px-4">
          <Tabs value={currentPart || ""} onValueChange={goToPart}>
            <TabsList className="w-full justify-start">
              {Object.entries(questionsByPart).map(([partId, partData]) => {
                const partCorrect = partData.questions.filter(
                  (q) => resultByQuestionId[q.id]?.isCorrect
                ).length;
                return (
                  <TabsTrigger key={partId} value={partId} className="flex items-center gap-2">
                    {partData.part.name}
                    <Badge variant="secondary" className="text-xs">
                      {partCorrect}/{partData.questions.length}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-4 flex gap-6">
        {/* Question Navigator - jump to any question, correct/incorrect visible */}
        <div className="hidden md:block w-56 shrink-0">
          <Card className="sticky top-24">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Jump to question</CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Click a number to go to that question. Green = correct, red = incorrect.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[min(60vh,28rem)] pr-2">
                <div className="grid grid-cols-5 gap-1.5">
                  {currentQuestions.map((q, i) => {
                    const res = resultByQuestionId[q.id];
                    const correct = res?.isCorrect ?? false;
                    const isCurrent = i === currentIndex;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => goToQuestion(i)}
                        title={`Question ${i + 1}: ${correct ? "Correct" : "Incorrect"}`}
                        className={cn(
                          "relative flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-all hover:ring-2 hover:ring-offset-1",
                          isCurrent
                            ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                            : correct
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 hover:ring-emerald-400"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:ring-red-400"
                        )}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground border-t pt-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-900/30" /> Correct
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-red-100 dark:bg-red-900/30" /> Incorrect
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Question Content */}
        <div className="flex-1 min-w-0">
          {currentQuestion ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    Question {currentIndex + 1} of {currentQuestions.length}
                    {hasParts && currentPart && questionsByPart && (
                      <span className="ml-2">
                        ({questionsByPart[currentPart]?.part.name})
                      </span>
                    )}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {currentQuestion.points} pts
                    </Badge>
                    <Badge variant={isCorrect ? "success" : "destructive"} className="text-xs">
                      {isCorrect ? (
                        <><CheckCircle className="h-3 w-3 mr-1" /> Correct</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" /> Incorrect</>
                      )}
                    </Badge>
                    {canGrade && result?.examId && (
                      <div className="flex items-center gap-1.5">
                        {reconciliations.some((r) => r.questionId === currentQuestion.id) && (
                          <Badge variant="secondary" className="text-xs">Reconciled</Badge>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            const existing = reconciliations.find((r) => r.questionId === currentQuestion.id);
                            if (existing) {
                              setReconcileType(existing.type);
                              setReconcileNewAnswer(Array.isArray(existing.newCorrectAnswer) ? existing.newCorrectAnswer[0] ?? "" : (existing.newCorrectAnswer ?? ""));
                              setReconcileNoAnswerCountsCorrect(existing.noAnswerCountsCorrect ?? true);
                            } else {
                              setReconcileType("new_answer");
                              setReconcileNewAnswer("");
                              setReconcileNoAnswerCountsCorrect(true);
                            }
                            setReconcileDialogOpen(true);
                          }}
                        >
                          <Scale className="h-3.5 w-3.5" /> Reconcile
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <CardTitle className="text-lg mt-3 leading-relaxed">
                  {currentQuestion.questionText}
                </CardTitle>
                {isMultipleAnswer && (
                  <p className="text-xs text-muted-foreground mt-1">Select all that apply</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {isMultipleAnswer ? (
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, i) => {
                      const isUserSelected = userAnswerArr.includes(option);
                      const isCorrectOption = Array.isArray(currentQuestion.correctAnswer)
                        ? currentQuestion.correctAnswer.includes(option)
                        : currentQuestion.correctAnswer === option;
                      const showCorrectHighlight = isCorrectOption && !isCorrect;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-4 transition-all",
                            isUserSelected && isCorrectOption && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
                            isUserSelected && !isCorrectOption && "border-red-500 bg-red-50 dark:bg-red-950/30",
                            isCorrectOption && "border-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30",
                            showCorrectHighlight && "ring-2 ring-emerald-400/50 ring-offset-2"
                          )}
                        >
                          <span className="text-sm font-medium text-muted-foreground mr-2">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          <span className="text-sm flex-1">{option}</span>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {isUserSelected && (
                              <Badge variant={isCorrectOption ? "success" : "destructive"} className="text-xs">
                                Your answer
                              </Badge>
                            )}
                            {isCorrectOption && (
                              <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-700 dark:text-emerald-400">
                                Correct answer
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, i) => {
                      const isUserSelected =
                        userAnswerStr === option || userAnswerArr.includes(option);
                      const isCorrectOption = Array.isArray(currentQuestion.correctAnswer)
                        ? currentQuestion.correctAnswer.includes(option)
                        : currentQuestion.correctAnswer === option;
                      const showCorrectHighlight = isCorrectOption && !isCorrect;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-4 transition-all",
                            isUserSelected && isCorrectOption && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
                            isUserSelected && !isCorrectOption && "border-red-500 bg-red-50 dark:bg-red-950/30",
                            isCorrectOption && "border-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30",
                            showCorrectHighlight && "ring-2 ring-emerald-400/50 ring-offset-2"
                          )}
                        >
                          <span className="text-sm font-medium text-muted-foreground mr-2">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          <span className="text-sm flex-1">{option}</span>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {isUserSelected && (
                              <Badge variant={isCorrectOption ? "success" : "destructive"} className="text-xs">
                                Your answer
                              </Badge>
                            )}
                            {isCorrectOption && (
                              <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-700 dark:text-emerald-400">
                                Correct answer
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">No question available.</p>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => goToQuestion(currentIndex - 1)}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {currentIndex + 1} / {currentQuestions.length}
              </span>
              <Select
                value={String(currentIndex + 1)}
                onValueChange={(v) => goToQuestion(Number(v) - 1)}
              >
                <SelectTrigger className="w-[7rem] md:hidden h-9 text-xs">
                  <SelectValue placeholder="Jump" />
                </SelectTrigger>
                <SelectContent>
                  {currentQuestions.map((_, i) => (
                    <SelectItem key={i} value={String(i + 1)} className="text-xs">
                      Q{i + 1}
                      {resultByQuestionId[currentQuestions[i]?.id]?.isCorrect ? " ✓" : " ✗"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => goToQuestion(currentIndex + 1)}
              disabled={currentIndex >= currentQuestions.length - 1}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Reconcile question dialog */}
      <Dialog open={reconcileDialogOpen} onOpenChange={setReconcileDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" /> Reconcile question
            </DialogTitle>
            <DialogDescription>
              Override the correct answer or mark this question as bonus (everyone correct). All submitted results for this exam will be re-scored.
            </DialogDescription>
          </DialogHeader>
          {currentQuestion && result?.examId && (() => {
            const existingRec = reconciliations.find((r) => r.questionId === currentQuestion.id);
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">{currentQuestion.questionText}</p>
                {existingRec && (
                  <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                    <p className="font-medium text-muted-foreground mb-1">Current reconciliation</p>
                    <p>
                      {existingRec.type === "new_answer"
                        ? `Correct answer set to: ${Array.isArray(existingRec.newCorrectAnswer) ? existingRec.newCorrectAnswer.join(", ") : existingRec.newCorrectAnswer}`
                        : `Bonus (no answer counts correct: ${existingRec.noAnswerCountsCorrect ?? "—"})`}
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="mt-2 gap-1"
                      disabled={removeReconciliationMutation.isPending}
                      onClick={() => removeReconciliationMutation.mutate(currentQuestion.id)}
                    >
                      {removeReconciliationMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      <Trash2 className="h-3 w-3" /> Remove reconciliation
                    </Button>
                  </div>
                )}
                {!existingRec && (
                  <>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={reconcileType} onValueChange={(v) => setReconcileType(v as "new_answer" | "bonus")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new_answer">New correct answer</SelectItem>
                          <SelectItem value="bonus">Bonus (everyone correct)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {reconcileType === "new_answer" && (
                      <div className="space-y-2">
                        <Label>Correct answer</Label>
                        <Select value={reconcileNewAnswer} onValueChange={setReconcileNewAnswer}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            {currentQuestion.options.map((opt, i) => (
                              <SelectItem key={i} value={opt}>
                                {String.fromCharCode(65 + i)}. {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {reconcileType === "bonus" && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="noAnswerCountsCorrect"
                          checked={reconcileNoAnswerCountsCorrect}
                          onCheckedChange={(v) => setReconcileNoAnswerCountsCorrect(v === true)}
                        />
                        <Label htmlFor="noAnswerCountsCorrect" className="text-sm font-normal">
                          Count no answer as correct
                        </Label>
                      </div>
                    )}
                  </>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReconcileDialogOpen(false)}>
                    Cancel
                  </Button>
                  {!existingRec && (
                    <Button
                      disabled={
                        reconcileMutation.isPending ||
                        (reconcileType === "new_answer" && !reconcileNewAnswer)
                      }
                      onClick={() => {
                        const payload: ReconcileQuestionPayload =
                          reconcileType === "new_answer"
                            ? { questionId: currentQuestion.id, type: "new_answer", newCorrectAnswer: reconcileNewAnswer }
                            : { questionId: currentQuestion.id, type: "bonus", noAnswerCountsCorrect: reconcileNoAnswerCountsCorrect };
                        reconcileMutation.mutate(payload);
                      }}
                    >
                      {reconcileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save reconciliation
                    </Button>
                  )}
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
