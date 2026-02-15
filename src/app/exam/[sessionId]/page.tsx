"use client";

import Image from "next/image";
import { use, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ExamQuestion } from "@/types";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageLoader } from "@/components/ui/loading";
import { toast } from "sonner";
import {
  Clock, ChevronLeft, ChevronRight, Flag, CheckCircle,
  AlertTriangle, Send, Loader2, Info,
} from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";

export default function ExamPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPart, setCurrentPart] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[] | null>>({});
  const [selectedIndices, setSelectedIndices] = useState<Record<string, number>>({}); // Track selected index for each question
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [partTimeRemaining, setPartTimeRemaining] = useState<Record<string, number>>({});
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["exam-session", sessionId],
    queryFn: () => api.getExamSession(sessionId, { includeQuestions: true }),
  });

  const session = data?.data;
  const allQuestions = session?.questions || [];
  const selectedQuestionIds = session?.selectedQuestionIds;
  
  // Filter and sort questions to match selectedQuestionIds order if it exists
  const questions = selectedQuestionIds && selectedQuestionIds.length > 0
    ? selectedQuestionIds
        .map((id) => allQuestions.find((q) => q.id === id))
        .filter((q): q is ExamQuestion => q !== undefined)
    : allQuestions;
  
  // Filter questionsByPart if it exists and selectedQuestionIds is provided
  // Maintain order within each part based on selectedQuestionIds
  const rawQuestionsByPart = session?.questionsByPart || null;
  const questionsByPart = rawQuestionsByPart && selectedQuestionIds && selectedQuestionIds.length > 0
    ? Object.keys(rawQuestionsByPart).reduce((acc, partId) => {
        const partData = rawQuestionsByPart[partId];
        // Filter and sort by selectedQuestionIds order
        const filteredQuestions = selectedQuestionIds
          .map((id) => partData.questions.find((q) => q.id === id))
          .filter((q): q is ExamQuestion => q !== undefined);
        if (filteredQuestions.length > 0) {
          acc[partId] = {
            ...partData,
            questions: filteredQuestions,
          };
        }
        return acc;
      }, {} as typeof rawQuestionsByPart)
    : rawQuestionsByPart;
  
  const partTimeLimits = session?.partTimeLimits || null;
  const hasParts = questionsByPart !== null && Object.keys(questionsByPart).length > 0;
  
  // Get questions for current part or all questions
  const getCurrentQuestions = () => {
    if (hasParts && currentPart && questionsByPart) {
      return questionsByPart[currentPart]?.questions || [];
    }
    return questions;
  };
  
  const currentQuestions = getCurrentQuestions();
  const currentQuestion = currentQuestions[currentIndex];

  // Initialize state from session
  useEffect(() => {
    if (session) {
      setCurrentIndex(session.currentQuestionIndex || 0);
      setAnswers(session.answers || {});
      setTimeRemaining(session.timeRemainingSeconds || 0);
      
      // Initialize selected indices from session answers
      if (session.questions) {
        const initialIndices: Record<string, number> = {};
        session.questions.forEach((q) => {
          const answer = session.answers?.[q.id];
          if (answer && typeof answer === "string") {
            const index = q.options.findIndex((opt) => opt === answer);
            if (index >= 0) {
              initialIndices[q.id] = index;
            }
          }
        });
        setSelectedIndices(initialIndices);
      }
      
      // Initialize part selection
      if (hasParts && questionsByPart) {
        const firstPartId = Object.keys(questionsByPart)[0];
        if (!currentPart) {
          setCurrentPart(firstPartId);
        }
      }
      
      // Initialize part time limits
      if (partTimeLimits) {
        const initialPartTimes: Record<string, number> = {};
        Object.keys(partTimeLimits).forEach((partId) => {
          initialPartTimes[partId] = partTimeLimits[partId].timeLimitSeconds;
        });
        setPartTimeRemaining(initialPartTimes);
      }
    }
  }, [session, hasParts, questionsByPart, partTimeLimits]);

  // Timer countdown
  useEffect(() => {
    if (currentPartTimeRemaining <= 0 || (session?.status !== "in_progress" && session?.status !== "in-progress")) return;

    timerRef.current = setInterval(() => {
      if (hasParts && currentPart && partTimeRemaining[currentPart] !== undefined) {
        // Per-part timer
        setPartTimeRemaining((prev) => {
          const newTime = (prev[currentPart] || 0) - 1;
          if (newTime <= 0) {
            clearInterval(timerRef.current!);
            handleSubmit();
            return { ...prev, [currentPart]: 0 };
          }
          return { ...prev, [currentPart]: newTime };
        });
      } else {
        // Overall timer
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.status, currentPart, hasParts, partTimeRemaining]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const autoSave = setInterval(() => {
      if (session?.status === "in_progress" || session?.status === "in-progress") {
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

  const handleSingleAnswer = (indexStr: string) => {
    if (!currentQuestion) return;
    const index = parseInt(indexStr, 10);
    if (index >= 0 && index < currentQuestion.options.length) {
      // Store both the answer value and the selected index
      setSelectedIndices((prev) => ({ ...prev, [currentQuestion.id]: index }));
      handleAnswer(currentQuestion.options[index]);
    }
  };

  const handleMultipleAnswer = (option: string, checked: boolean) => {
    const current = (answers[currentQuestion?.id] as string[]) || [];
    const updated = checked ? [...current, option] : current.filter((a) => a !== option);
    handleAnswer(updated.length > 0 ? updated : null);
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < currentQuestions.length) {
      setCurrentIndex(index);
    }
  };

  const goToPart = (partId: string) => {
    setCurrentPart(partId);
    setCurrentIndex(0);
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

  const getAnsweredCount = () => {
    // Only count answers for questions in currentQuestions
    return currentQuestions.filter((q) => {
      const answer = answers[q.id];
      if (answer === null || answer === undefined) return false;
      if (typeof answer === "string") return answer.length > 0;
      if (Array.isArray(answer)) return answer.length > 0;
      return true;
    }).length;
  };

  const answeredCount = getAnsweredCount();
  const progressPercentage = currentQuestions.length > 0 ? (answeredCount / currentQuestions.length) * 100 : 0;
  const isMultipleAnswer = Array.isArray(currentQuestion?.correctAnswer) && currentQuestion.correctAnswer.length > 1;
  
  // Get current part time remaining
  const currentPartTimeRemaining = hasParts && currentPart && partTimeRemaining[currentPart] !== undefined
    ? partTimeRemaining[currentPart]
    : timeRemaining;

  // Timer color based on time remaining
  const timerColor =
    currentPartTimeRemaining < 60 ? "text-red-500" : currentPartTimeRemaining < 300 ? "text-amber-500" : "text-foreground";

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

  // Instructions Dialog
  if (showInstructions && session.exam) {
    return (
      <Dialog open={showInstructions} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Exam Instructions
            </DialogTitle>
            <DialogDescription>
              Please read the instructions carefully before starting the exam.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {session.exam.instruction && (
              <div>
                <h3 className="font-semibold mb-2">Instructions:</h3>
                <p className="text-sm whitespace-pre-wrap">{session.exam.instruction}</p>
              </div>
            )}
            {hasParts && questionsByPart && (
              <div>
                <h3 className="font-semibold mb-2">Exam Structure:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {Object.values(questionsByPart).map((partData, idx) => (
                    <li key={partData.part.id}>
                      <span className="font-medium">{partData.part.name}</span>
                      {partData.part.description && ` - ${partData.part.description}`}
                      {" "}({partData.questions.length} questions
                      {partData.part.timeLimit && `, ${partData.part.timeLimit} minutes`})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInstructions(false)} className="w-full">
              Start Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            {formatDuration(currentPartTimeRemaining)}
            {hasParts && currentPart && partTimeLimits && (
              <span className="text-xs font-normal ml-2">
                ({questionsByPart?.[currentPart]?.part.name})
              </span>
            )}
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
          <span>{answeredCount} of {currentQuestions.length} answered</span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Part Navigation Tabs */}
      {hasParts && questionsByPart && (
        <div className="mx-auto max-w-5xl px-4">
          <Tabs value={currentPart || ""} onValueChange={goToPart}>
            <TabsList className="w-full justify-start">
              {Object.entries(questionsByPart).map(([partId, partData]) => {
                const partAnswered = partData.questions.filter((q) => {
                  const answer = answers[q.id];
                  return answer !== null && answer !== undefined && (typeof answer === "string" ? answer.length > 0 : answer.length > 0);
                }).length;
                const partProgress = partData.questions.length > 0 ? (partAnswered / partData.questions.length) * 100 : 0;
                return (
                  <TabsTrigger key={partId} value={partId} className="flex items-center gap-2">
                    {partData.part.name}
                    <Badge variant="secondary" className="text-xs">
                      {partAnswered}/{partData.questions.length}
                    </Badge>
                    {partProgress === 100 && (
                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-4 flex gap-6">
        {/* Question Navigator (sidebar) */}
        <div className="hidden lg:block w-64 shrink-0">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {currentQuestions.map((q, i) => {
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
                  Question {currentIndex + 1} of {currentQuestions.length}
                  {hasParts && currentPart && questionsByPart && (
                    <span className="ml-2">
                      ({questionsByPart[currentPart]?.part.name})
                    </span>
                  )}
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
                  (() => {
                    // Use stored selected index if available, otherwise try to find it
                    const storedIndex = selectedIndices[currentQuestion.id];
                    const selectedAnswer = answers[currentQuestion.id] as string;
                    const selectedIndex = storedIndex !== undefined
                      ? storedIndex
                      : selectedAnswer
                      ? currentQuestion.options.findIndex((opt) => opt === selectedAnswer)
                      : -1;
                    const radioValue = selectedIndex >= 0 ? selectedIndex.toString() : "";
                    
                    return (
                      <RadioGroup
                        value={radioValue}
                        onValueChange={handleSingleAnswer}
                      >
                        {currentQuestion.options.map((option, i) => {
                          // Use stored index to determine selection - this ensures only the exact clicked option is highlighted
                          const isSelected = selectedIndex === i;
                          return (
                            <label
                              key={i}
                              className={cn(
                                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "hover:bg-muted/50"
                              )}
                            >
                              <RadioGroupItem value={i.toString()} />
                              <span className="text-sm font-medium text-muted-foreground mr-2">
                                {String.fromCharCode(65 + i)}.
                              </span>
                              <span className="text-sm">{option}</span>
                            </label>
                          );
                        })}
                      </RadioGroup>
                    );
                  })()
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
              {currentIndex + 1} / {currentQuestions.length}
            </span>

            {currentIndex < currentQuestions.length - 1 ? (
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
              You have answered {answeredCount} out of {currentQuestions.length} questions in {hasParts && currentPart && questionsByPart ? questionsByPart[currentPart]?.part.name : "this exam"}.
              {answeredCount < currentQuestions.length && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
                  Warning: {currentQuestions.length - answeredCount} question(s) are unanswered.
                </span>
              )}
              {hasParts && questionsByPart && Object.keys(questionsByPart).length > 1 && (
                <span className="block mt-2 text-sm">
                  Note: You can switch between parts using the tabs above.
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

      {/* Loading Overlay for Submission */}
      {submitMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Submitting exam...</p>
            <p className="text-xs text-muted-foreground">Please wait, do not close this page.</p>
          </div>
        </div>
      )}
    </div>
  );
}
