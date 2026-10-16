"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { ExamQuestion, QuestionResult, GradeQuestionPayload } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/ui/loading";
import { QuestionInsights } from "@/components/exam-generator/question-insights";
import { QuestionSource } from "@/components/exam-generator/question-source";
import { MathAnswerList, MathText } from "@/components/math/math-text";
import { parseBlanks } from "@/lib/question-blanks";
import { GradingPanel } from "@/components/results/grading-panel";
import { ReconcileQuestionDialog } from "@/components/results/reconcile-question-dialog";
import { IntegrityPanel } from "@/components/results/integrity-panel";
import { ExplainMistake } from "@/components/study/explain-mistake";
import { PositionalAnswerReview } from "@/components/questions/positional-answer";
import { AudioPlayer, HotspotInput } from "@/components/questions/media-questions";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Scale,
  Clock,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ResultReviewPage({ params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPart, setCurrentPart] = useState<string | null>(null);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);

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
  const examineeCanViewSources =
    canViewAsExaminee && (result?.sourceViewableByExaminee ?? exam?.sourceViewableByExaminee) === true;

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

  const gradeMutation = useMutation({
    mutationFn: (grade: GradeQuestionPayload) => api.gradeExamResult(resultId, [grade]),
    onSuccess: (data) => {
      if (data?.data) queryClient.setQueryData(["exam-result", resultId], data);
      queryClient.invalidateQueries({ queryKey: ["exam-result", resultId] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
      queryClient.invalidateQueries({ queryKey: ["my-results"] });
      toast.success(data?.message || "Grade saved.");
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || err.message || "Failed to save grade"),
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
  const effectiveResults = result?.questionResults ?? [];
  const resultByQuestionId = effectiveResults.reduce<Record<string, QuestionResult>>((acc, r) => {
    acc[r.questionId] = r;
    return acc;
  }, {});

  const correctCount = effectiveResults.filter((r) => r.isCorrect).length;
  const pendingCount = effectiveResults.filter((r) => r.pendingReview).length;
  const totalQuestions = orderedQuestions.length;
  const progressPercentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < currentQuestions.length) setCurrentIndex(index);
  };

  const goToPart = (partId: string) => {
    setCurrentPart(partId);
    setCurrentIndex(0);
  };

  const partIds = questionsByPart ? Object.keys(questionsByPart) : [];
  const currentPartIdx = currentPart ? partIds.indexOf(currentPart) : -1;
  const prevPartId = currentPartIdx > 0 ? partIds[currentPartIdx - 1] : null;
  const nextPartId = currentPartIdx >= 0 && currentPartIdx < partIds.length - 1 ? partIds[currentPartIdx + 1] : null;
  const isFirstInPart = currentIndex === 0;
  const isLastInPart = currentIndex >= currentQuestions.length - 1;

  const goPrevious = () => {
    if (!isFirstInPart) {
      goToQuestion(currentIndex - 1);
    } else if (prevPartId && questionsByPart) {
      setCurrentPart(prevPartId);
      setCurrentIndex(Math.max(0, questionsByPart[prevPartId].questions.length - 1));
    }
  };

  const goNext = () => {
    if (!isLastInPart) {
      goToQuestion(currentIndex + 1);
    } else if (nextPartId) {
      goToPart(nextPartId);
    }
  };

  const goToNextPending = () => {
    const positions: { partId: string | null; index: number; questionId: string }[] = questionsByPart
      ? Object.entries(questionsByPart).flatMap(([partId, data]) =>
          data.questions.map((q, index) => ({ partId, index, questionId: q.id }))
        )
      : orderedQuestions.map((q, index) => ({ partId: null, index, questionId: q.id }));
    const here = positions.findIndex(
      (p) => p.index === currentIndex && (p.partId === null || p.partId === currentPart)
    );
    const rotated = [...positions.slice(here + 1), ...positions.slice(0, here + 1)];
    const next = rotated.find((p) => resultByQuestionId[p.questionId]?.pendingReview);
    if (!next) return;
    if (next.partId) setCurrentPart(next.partId);
    setCurrentIndex(next.index);
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
  const answerFormat = currentQuestion?.metadata?.answerFormat;
  const isHotspot = answerFormat === "hotspot";
  const isPositional = answerFormat === "ordering" || answerFormat === "matching";
  const isMultipleAnswer =
    currentQuestion &&
    !isPositional &&
    !isHotspot &&
    Array.isArray(currentQuestion.correctAnswer) &&
    currentQuestion.correctAnswer.length > 1;
  const rawUserAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const userAnswerArr = Array.isArray(rawUserAnswer) ? rawUserAnswer : rawUserAnswer ? [rawUserAnswer] : [];
  const userAnswerStr = typeof rawUserAnswer === "string" ? rawUserAnswer : null;
  const qResult = currentQuestion ? resultByQuestionId[currentQuestion.id] : null;
  const isCorrect = qResult?.isCorrect ?? false;
  const correctAnswers = !currentQuestion?.correctAnswer
    ? []
    : Array.isArray(currentQuestion.correctAnswer)
      ? currentQuestion.correctAnswer
      : [currentQuestion.correctAnswer];
  const correctAnswerLabels = correctAnswers.map((answer) => {
    const i = currentQuestion?.options.indexOf(answer) ?? -1;
    return i >= 0 ? `${String.fromCharCode(65 + i)}. ${answer}` : answer;
  });
  const correctAnswersAllApply =
    (currentQuestion?.options.length ?? 0) > 0 || parseBlanks(currentQuestion?.questionText ?? "").blankCount > 1;
  const explanation = currentQuestion?.explanation?.trim();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" asChild className="shrink-0" aria-label="Back">
              <Link href={backHref}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <Image src="/xevra-logo.png" alt="Xevra" width={32} height={32} className="rounded-lg shrink-0" />
            <span className="text-sm font-semibold truncate sm:hidden">
              {result.examTitle || exam?.title || "Exam"}
            </span>
            <span className="text-sm font-semibold hidden truncate sm:inline">
              Review: {result.examTitle || exam?.title || "Exam"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canGrade && (
              <Badge variant="secondary" className="hidden text-xs sm:inline-flex">
                Proctor review
              </Badge>
            )}
            {canGrade && pendingCount > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={goToNextPending}>
                <PenLine className="h-3.5 w-3.5" />
                {pendingCount}<span className="max-sm:hidden">&nbsp;to grade</span>
              </Button>
            )}
            {!canGrade && result.gradingStatus === "pending_review" && (
              <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700 dark:text-amber-400 text-xs">
                <Clock className="h-3 w-3" /> Awaiting grading
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mx-auto max-w-5xl px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>
            {correctCount} of {totalQuestions} correct
          </span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {canGrade && (
        <div className="mx-auto max-w-5xl px-3 pb-3 sm:px-4">
          <IntegrityPanel
            resultId={resultId}
            questionNumber={(questionId) => {
              const index = orderedQuestions.findIndex((q) => q.id === questionId);
              return index >= 0 ? index + 1 : null;
            }}
          />
        </div>
      )}

      {/* Part Tabs */}
      {hasParts && questionsByPart && (
        <div className="mx-auto max-w-5xl px-3 sm:px-4">
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

      <div className="mx-auto max-w-5xl px-3 py-4 flex gap-6 sm:px-4">
        {/* Question Navigator - jump to any question, correct/incorrect visible */}
        <div className="hidden md:block w-[15.5rem] shrink-0">
          <Card className="sticky top-24">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Jump to question</CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Click a number to go to that question. Green = correct, red = incorrect, amber = needs grading.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[min(60vh,28rem)] pr-2">
                <div className="grid grid-cols-5 gap-1.5 p-1">
                  {currentQuestions.map((q, i) => {
                    const res = resultByQuestionId[q.id];
                    const correct = res?.isCorrect ?? false;
                    const pending = res?.pendingReview === true;
                    const isCurrent = i === currentIndex;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => goToQuestion(i)}
                        title={`Question ${i + 1}: ${pending ? "Needs grading" : correct ? "Correct" : "Incorrect"}`}
                        className={cn(
                          "relative flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-all hover:ring-2 hover:ring-offset-1",
                          isCurrent
                            ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                            : pending
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:ring-amber-400"
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
                {pendingCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-amber-100 dark:bg-amber-900/30" /> Needs grading
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Question Content */}
        <div className="flex-1 min-w-0">
          {currentQuestion ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className="text-xs">
                    Question {currentIndex + 1} of {currentQuestions.length}
                    {hasParts && currentPart && questionsByPart && (
                      <span className="ml-2">
                        ({questionsByPart[currentPart]?.part.name})
                      </span>
                    )}
                  </Badge>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {currentQuestion.points} pts
                    </Badge>
                    {qResult?.pendingReview ? (
                      <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 text-xs">
                        <Clock className="h-3 w-3 mr-1" /> Needs grading
                      </Badge>
                    ) : (
                      <Badge variant={isCorrect ? "success" : "destructive"} className="text-xs">
                        {isCorrect ? (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Correct</>
                        ) : (
                          <><XCircle className="h-3 w-3 mr-1" /> Incorrect</>
                        )}
                        {qResult?.manual && ` · ${qResult.score}/${qResult.points}`}
                      </Badge>
                    )}
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
                          onClick={() => setReconcileDialogOpen(true)}
                        >
                          <Scale className="h-3.5 w-3.5" /> Reconcile
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <CardTitle className="text-base sm:text-lg mt-3 leading-relaxed break-words whitespace-pre-wrap">
                  <MathText text={currentQuestion.questionText} />
                </CardTitle>
                {isMultipleAnswer && (
                  <p className="text-xs text-muted-foreground mt-1">Select all that apply</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {currentQuestion.metadata?.audioUrl && (
                  <AudioPlayer url={currentQuestion.metadata.audioUrl} />
                )}
                {isHotspot && currentQuestion.metadata?.hotspotImageUrl ? (
                  <HotspotInput
                    imageUrl={currentQuestion.metadata.hotspotImageUrl}
                    value={userAnswerArr[0] ? String(userAnswerArr[0]) : null}
                    disabled
                    showRegions
                    regions={currentQuestion.metadata.hotspotRegions}
                    correctIds={Array.isArray(currentQuestion.correctAnswer) ? currentQuestion.correctAnswer.map(String) : []}
                  />
                ) : isPositional ? (
                  <PositionalAnswerReview
                    question={currentQuestion}
                    answer={userAnswerArr.map(String)}
                    label={canGrade ? "Examinee's answer" : "Your answer"}
                  />
                ) : isMultipleAnswer ? (
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
                          <MathText text={option} className="text-sm flex-1" />
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
                          <MathText text={option} className="text-sm flex-1" />
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
                {currentQuestion.options.length === 0 && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <span className="font-medium">{canGrade ? "Examinee's answer" : "Your answer"}: </span>
                    {userAnswerArr.length > 0 ? (
                      <MathAnswerList answers={userAnswerArr} joiner="and" className="break-words whitespace-pre-wrap" />
                    ) : (
                      <span className="italic text-muted-foreground">No answer</span>
                    )}
                  </div>
                )}
                {canGrade ? (
                  <>
                    <GradingPanel
                      question={currentQuestion}
                      answer={rawUserAnswer}
                      questionResult={qResult ?? undefined}
                      manualGrade={result.manualGrades?.[currentQuestion.id]}
                      saving={gradeMutation.isPending}
                      onSave={(grade) => gradeMutation.mutate(grade)}
                    />
                    <QuestionInsights
                      explanation={currentQuestion.explanation}
                      metadata={currentQuestion.metadata}
                      className="mt-4"
                    />
                  </>
                ) : (
                  <>
                    {qResult?.pendingReview && (
                      <p className="mt-4 rounded-md border border-dashed border-amber-400 p-3 text-xs text-muted-foreground">
                        Your proctor hasn&apos;t graded this answer yet. Your score will update once they do.
                      </p>
                    )}
                    {qResult?.feedback && (
                      <div className="mt-4 rounded-md border bg-muted/30 p-3 text-sm">
                        <p className="font-medium mb-1">Proctor feedback</p>
                        <p className="text-muted-foreground whitespace-pre-wrap break-words">{qResult.feedback}</p>
                      </div>
                    )}
                    {correctAnswers.length === 0 && exam?.answerRevealTiming === "after_last_attempt" && (
                      <p className="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        Correct answers and explanations will be shown once you pass this exam or use up your attempts.
                      </p>
                    )}
                    {!isCorrect && !isPositional && !isHotspot && correctAnswerLabels.length > 0 && (
                      <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
                        <span className="font-medium text-emerald-800 dark:text-emerald-300">
                          Correct answer{correctAnswers.length > 1 ? "s" : ""}:{" "}
                        </span>
                        <MathAnswerList
                          answers={correctAnswerLabels}
                          joiner={correctAnswersAllApply ? "and" : "or"}
                          className="break-words"
                        />
                      </div>
                    )}
                    {explanation && (
                      <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                        <p className="font-medium mb-1">Explanation</p>
                        <p className="text-muted-foreground whitespace-pre-wrap break-words"><MathText text={explanation} /></p>
                      </div>
                    )}
                    {isExaminee && !isCorrect && !qResult?.pendingReview && !qResult?.manual && correctAnswers.length > 0 && (
                      <ExplainMistake
                        resultId={result.id}
                        questionId={currentQuestion.id}
                        questionText={currentQuestion.questionText}
                        options={currentQuestion.options}
                        userAnswer={userAnswerArr.map(String)}
                        correctAnswers={correctAnswers.map(String)}
                        explanation={explanation}
                      />
                    )}
                    {examineeCanViewSources && currentQuestion.metadata?.ai && (
                      <QuestionSource source={currentQuestion.metadata.ai} className="mt-3 rounded-md bg-muted/40 p-2.5" />
                    )}
                  </>
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
              className="h-10 sm:h-9"
              onClick={goPrevious}
              disabled={isFirstInPart && !prevPartId}
              aria-label="Previous question"
            >
              <ChevronLeft className="h-4 w-4 sm:mr-1" />
              <span className="max-[359px]:hidden">Previous</span>
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {currentIndex + 1} / {currentQuestions.length}
              </span>
              <Select
                value={String(currentIndex + 1)}
                onValueChange={(v) => goToQuestion(Number(v) - 1)}
              >
                <SelectTrigger className="w-[6.5rem] md:hidden h-10 text-xs">
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
              className="h-10 sm:h-9"
              onClick={goNext}
              disabled={isLastInPart && !nextPartId}
              aria-label="Next question"
            >
              <span className="max-[359px]:hidden">Next</span>
              <ChevronRight className="h-4 w-4 sm:ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {result?.examId && (
        <ReconcileQuestionDialog
          open={reconcileDialogOpen}
          onOpenChange={setReconcileDialogOpen}
          examId={result.examId}
          question={currentQuestion ?? null}
          existing={currentQuestion ? reconciliations.find((r) => r.questionId === currentQuestion.id) ?? null : null}
        />
      )}
    </div>
  );
}
