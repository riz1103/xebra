"use client";

import Image from "next/image";
import { use, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageLoader } from "@/components/ui/loading";
import { toast } from "sonner";
import {
  Clock, ChevronLeft, ChevronRight, Flag, CheckCircle,
  AlertTriangle, Send, Loader2,
} from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";

export default function ExamPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[] | null>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["exam-session", sessionId],
    queryFn: () => api.getExamSession(sessionId, { includeQuestions: true }),
  });

  const session = data?.data;
  const questions = session?.questions || [];
  const currentQuestion = questions[currentIndex];

  // Initialize state from session
  useEffect(() => {
    if (session) {
      setCurrentIndex(session.currentQuestionIndex || 0);
      setAnswers(session.answers || {});
      setTimeRemaining(session.timeRemainingSeconds || 0);
    }
  }, [session]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining <= 0 || session?.status !== "in_progress") return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time's up - auto submit
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.status]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const autoSave = setInterval(() => {
      if (session?.status === "in_progress") {
        saveMutation.mutate({
          currentQuestionIndex: currentIndex,
          answers,
          timeRemainingSeconds: timeRemaining,
        });
      }
    }, 30000);

    return () => clearInterval(autoSave);
  }, [currentIndex, answers, timeRemaining, session?.status]);

  const answerMutation = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string | string[] | null }) =>
      api.answerQuestion(sessionId, questionId, { answer, timeRemainingSeconds: timeRemaining }),
    onError: (err: Error) => toast.error("Failed to save answer: " + err.message),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { currentQuestionIndex: number; answers: Record<string, string | string[] | null>; timeRemainingSeconds: number }) =>
      api.updateExamSession(sessionId, payload),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.submitExamSession(sessionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["my-results"] });
      toast.success("Exam submitted successfully!");
      router.push("/dashboard/my-results");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleAnswer = useCallback(
    (answer: string | string[] | null) => {
      if (!currentQuestion) return;
      const newAnswers = { ...answers, [currentQuestion.id]: answer };
      setAnswers(newAnswers);
      answerMutation.mutate({ questionId: currentQuestion.id, answer });
    },
    [currentQuestion, answers, answerMutation]
  );

  const handleSingleAnswer = (value: string) => {
    handleAnswer(value);
  };

  const handleMultipleAnswer = (option: string, checked: boolean) => {
    const current = (answers[currentQuestion?.id] as string[]) || [];
    const updated = checked ? [...current, option] : current.filter((a) => a !== option);
    handleAnswer(updated.length > 0 ? updated : null);
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
    }
  };

  const handleSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    submitMutation.mutate();
  };

  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const answeredCount = Object.values(answers).filter((a) => a !== null && a !== undefined && (typeof a === "string" ? a.length > 0 : a.length > 0)).length;
  const progressPercentage = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const isMultipleAnswer = Array.isArray(currentQuestion?.correctAnswer) && currentQuestion.correctAnswer.length > 1;

  // Timer color based on time remaining
  const timerColor =
    timeRemaining < 60 ? "text-red-500" : timeRemaining < 300 ? "text-amber-500" : "text-foreground";

  if (isLoading) return <PageLoader />;
  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold">Session Not Found</h2>
            <p className="text-sm text-muted-foreground mt-2">This exam session may have expired or doesn&apos;t exist.</p>
            <Button className="mt-4" onClick={() => router.push("/dashboard/my-exams")}>Back to My Exams</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session.status === "completed") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold">Exam Completed</h2>
            <p className="text-sm text-muted-foreground mt-2">You have already completed this exam.</p>
            <Button className="mt-4" onClick={() => router.push("/dashboard/my-results")}>View Results</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Image src="/xevra-logo.png" alt="Xevra" width={32} height={32} className="rounded-lg" />
            <span className="text-sm font-semibold hidden sm:inline">{session.exam?.title || "Exam"}</span>
          </div>
          <div className={cn("flex items-center gap-2 font-mono text-lg font-bold", timerColor)}>
            <Clock className="h-5 w-5" />
            {formatDuration(timeRemaining)}
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowSubmitDialog(true)}
          >
            <Send className="mr-1 h-3 w-3" /> Submit
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{answeredCount} of {questions.length} answered</span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-4 flex gap-6">
        {/* Question Navigator (sidebar) */}
        <div className="hidden lg:block w-64 shrink-0">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, i) => {
                  const isAnswered = answers[q.id] !== null && answers[q.id] !== undefined;
                  const isCurrent = i === currentIndex;
                  const isFlagged = flagged.has(q.id);
                  return (
                    <button
                      key={q.id}
                      onClick={() => goToQuestion(i)}
                      className={cn(
                        "relative flex h-9 w-9 items-center justify-center rounded-md text-xs font-medium transition-all",
                        isCurrent
                          ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                          : isAnswered
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {i + 1}
                      {isFlagged && (
                        <Flag className="absolute -top-1 -right-1 h-3 w-3 text-amber-500 fill-amber-500" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-900/30" /> Answered
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded bg-muted" /> Unanswered
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
                    Question {currentIndex + 1} of {questions.length}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{currentQuestion.points} pts</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFlag(currentQuestion.id)}
                      className={flagged.has(currentQuestion.id) ? "text-amber-500" : "text-muted-foreground"}
                    >
                      <Flag className={cn("h-4 w-4", flagged.has(currentQuestion.id) && "fill-amber-500")} />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-lg mt-3 leading-relaxed">{currentQuestion.questionText}</CardTitle>
                {isMultipleAnswer && (
                  <p className="text-xs text-muted-foreground mt-1">Select all that apply</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {isMultipleAnswer ? (
                  // Multiple answer (checkboxes)
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, i) => {
                      const currentAnswers = (answers[currentQuestion.id] as string[]) || [];
                      const isChecked = currentAnswers.includes(option);
                      return (
                        <label
                          key={i}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                            isChecked
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => handleMultipleAnswer(option, !!checked)}
                          />
                          <span className="text-sm font-medium text-muted-foreground mr-2">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          <span className="text-sm">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  // Single answer (radio)
                  <RadioGroup
                    value={(answers[currentQuestion.id] as string) || ""}
                    onValueChange={handleSingleAnswer}
                  >
                    {currentQuestion.options.map((option, i) => (
                      <label
                        key={i}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                          answers[currentQuestion.id] === option
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <RadioGroupItem value={option} />
                        <span className="text-sm font-medium text-muted-foreground mr-2">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        <span className="text-sm">{option}</span>
                      </label>
                    ))}
                  </RadioGroup>
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

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              onClick={() => goToQuestion(currentIndex - 1)}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>

            {/* Mobile question indicator */}
            <span className="text-sm text-muted-foreground lg:hidden">
              {currentIndex + 1} / {questions.length}
            </span>

            {currentIndex < questions.length - 1 ? (
              <Button onClick={() => goToQuestion(currentIndex + 1)}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => setShowSubmitDialog(true)} variant="default">
                <Send className="mr-1 h-4 w-4" /> Finish & Submit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} out of {questions.length} questions.
              {answeredCount < questions.length && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
                  Warning: {questions.length - answeredCount} question(s) are unanswered.
                </span>
              )}
              {flagged.size > 0 && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400">
                  You have {flagged.size} flagged question(s).
                </span>
              )}
              <span className="block mt-2">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Exam</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="bg-primary"
            >
              {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
