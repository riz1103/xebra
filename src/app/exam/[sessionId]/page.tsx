"use client";

import Image from "next/image";
import { use, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ExamQuestion, SessionQuestion, PhraseBlock } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PageLoader } from "@/components/ui/loading";
import { toast } from "sonner";
import {
  Clock, ChevronLeft, ChevronRight, Flag, CheckCircle,
  AlertTriangle, Send, Loader2, Info, LayoutGrid,
} from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { parseBlanks } from "@/lib/question-blanks";
import { getQuestionLayout } from "@/lib/question-layout";
import { Textarea } from "@/components/ui/textarea";
import { MathText, MathPreview } from "@/components/math/math-text";
import { MathKeypad } from "@/components/math/math-keypad";
import { looksMathematical } from "@/lib/math-notation";

const UNASSIGNED_PART_ID = "__unassigned";
const TEXT_SAVE_DELAY_MS = 800;
/** Answer boxes need visible borders on white backgrounds, especially on phone screens */
const ANSWER_FIELD_CLASS =
  "border-2 border-foreground/30 bg-background text-base shadow-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 dark:border-foreground/25 dark:bg-muted/40";

export default function ExamPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isLoading: authLoading, isAuthenticated } = useAuthStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPart, setCurrentPart] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[] | null>>({});
  const [selectedIndices, setSelectedIndices] = useState<Record<string, number>>({}); // Track selected index for each question
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [partTimeRemaining, setPartTimeRemaining] = useState<Record<string, number>>({});
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  /** null until the examinee toggles it; then their choice sticks across questions */
  const [mathKeypadPref, setMathKeypadPref] = useState<boolean | null>(null);
  const answerScopeRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["exam-session", sessionId],
    queryFn: () => api.getExamSession(sessionId, { includeQuestions: true }),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !authLoading && isAuthenticated,
  });

  const session = data?.data;
  const sessionQuestions = session?.questions;
  const selectedQuestionIds = session?.selectedQuestionIds;
  const rawQuestionsByPart = session?.questionsByPart || null;

  // Memoized so effects that depend on these only re-run when the session data changes
  const questions = useMemo<SessionQuestion[]>(() => {
    const allQuestions = (sessionQuestions || []) as SessionQuestion[];
    if (!selectedQuestionIds || selectedQuestionIds.length === 0) return allQuestions;
    const byId = new Map(allQuestions.map((q) => [q.id, q]));
    return selectedQuestionIds
      .map((id) => byId.get(id))
      .filter((q): q is SessionQuestion => q !== undefined);
  }, [sessionQuestions, selectedQuestionIds]);

  // Maintain order within each part based on selectedQuestionIds
  const questionsByPart = useMemo(() => {
    if (!rawQuestionsByPart) return null;
    const questionById = new Map(((sessionQuestions || []) as SessionQuestion[]).map((q) => [q.id, q]));
    const byPart: Record<string, (typeof rawQuestionsByPart)[string] & { questions: SessionQuestion[] }> = {};
    for (const partId of Object.keys(rawQuestionsByPart)) {
      const partData = rawQuestionsByPart[partId];
      const partQuestions: SessionQuestion[] =
        partData.questions ??
        (partData.questionIds ?? [])
          .map((id) => questionById.get(id))
          .filter((q): q is SessionQuestion => q !== undefined);
      const partQuestionById = new Map(partQuestions.map((q) => [q.id, q]));
      const filteredQuestions = selectedQuestionIds && selectedQuestionIds.length > 0
        ? selectedQuestionIds
            .map((id) => partQuestionById.get(id))
            .filter((q): q is SessionQuestion => q !== undefined)
        : partQuestions;
      if (filteredQuestions.length > 0) {
        byPart[partId] = { ...partData, questions: filteredQuestions };
      }
    }
    if (Object.keys(byPart).length > 0) {
      const inPart = new Set(Object.values(byPart).flatMap((p) => p.questions.map((q) => q.id)));
      const unassigned = questions.filter((q) => !inPart.has(q.id));
      if (unassigned.length > 0) {
        byPart[UNASSIGNED_PART_ID] = {
          part: { id: UNASSIGNED_PART_ID, name: "Other questions", description: "" },
          questions: unassigned,
        };
      }
    }
    return byPart;
  }, [rawQuestionsByPart, sessionQuestions, selectedQuestionIds, questions]);

  const { data: questionTypesData } = useQuery({
    queryKey: ["question-types", "exam-layouts"],
    queryFn: () => api.getQuestionTypes({ size: 100 }),
    staleTime: 10 * 60_000,
    enabled: !authLoading && isAuthenticated,
  });
  const layoutByTypeId = useMemo(
    () => new Map((questionTypesData?.data ?? []).map((t) => [t.id, getQuestionLayout(t.name)])),
    [questionTypesData]
  );
  
  const partTimeLimits = session?.partTimeLimits || null;
  const hasParts = questionsByPart !== null && Object.keys(questionsByPart).length > 0;
  
  // Get questions for current part or all questions
  const getCurrentQuestions = () => {
    if (hasParts && currentPart && questionsByPart) {
      return questionsByPart[currentPart]?.questions || [];
    }
    return questions;
  };
  
  const currentQuestions: SessionQuestion[] = getCurrentQuestions();
  const currentQuestion = currentQuestions[currentIndex];

  // Show phrase block once before the first question of each phrase block (backend orders so same phraseId is consecutive)
  const shouldShowPhraseBlock =
    currentQuestion?.phraseId &&
    (currentIndex === 0 || (currentQuestions[currentIndex - 1] as SessionQuestion)?.phraseId !== currentQuestion.phraseId);
  const rawPhrase =
    currentQuestion?.phrase ?? (currentQuestion?.phraseId && session?.phrases?.[currentQuestion.phraseId]);
  const phraseForBlock: PhraseBlock | undefined =
    rawPhrase && rawPhrase !== null && typeof rawPhrase === "object" ? (rawPhrase as PhraseBlock) : undefined;

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
    // Don't start timer if session is not in progress
    if (session?.status !== "in_progress" && session?.status !== "in-progress") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Determine which time value to check based on time type
    const shouldUsePartTimer = hasParts && currentPart && partTimeRemaining[currentPart] !== undefined;
    const currentTime = shouldUsePartTimer ? partTimeRemaining[currentPart] : timeRemaining;

    // Don't start timer if time is already 0 or less
    if (currentTime <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Clear any existing timer before starting a new one
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      if (hasParts && currentPart && partTimeRemaining[currentPart] !== undefined) {
        // Per-part timer
        setPartTimeRemaining((prev) => {
          const newTime = (prev[currentPart] || 0) - 1;
          if (newTime <= 0) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            handleSubmit();
            return { ...prev, [currentPart]: 0 };
          }
          return { ...prev, [currentPart]: newTime };
        });
      } else {
        // Overall timer (per_exam or per_question)
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session?.status, currentPart, hasParts, partTimeRemaining, timeRemaining]);

  // Auto-save every 30 seconds (server computes remaining time; do not send it)
  useEffect(() => {
    const autoSave = setInterval(() => {
      if (session?.status === "in_progress" || session?.status === "in-progress") {
        saveMutation.mutate({
          currentQuestionIndex: currentIndex,
          answers,
        });
      }
    }, 30000);

    return () => clearInterval(autoSave);
  }, [currentIndex, answers, session?.status]);

  const answerMutation = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string | string[] | null }) =>
      api.answerQuestion(sessionId, questionId, { answer }),
    onError: (err: Error) => toast.error("Failed to save answer: " + err.message),
  });

  // Typed answers (identification without blanks, essays) save after a pause instead of on every keystroke
  const pendingTextSave = useRef<{ timer: NodeJS.Timeout; questionId: string; answer: string | null } | null>(null);

  const { mutate: saveAnswer } = answerMutation;
  const flushTextAnswer = useCallback(() => {
    const pending = pendingTextSave.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingTextSave.current = null;
    saveAnswer({ questionId: pending.questionId, answer: pending.answer });
  }, [saveAnswer]);

  const handleTextAnswer = (questionId: string, value: string) => {
    const answer = value.trim() ? value : null;
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    if (pendingTextSave.current && pendingTextSave.current.questionId !== questionId) flushTextAnswer();
    if (pendingTextSave.current) clearTimeout(pendingTextSave.current.timer);
    pendingTextSave.current = { timer: setTimeout(flushTextAnswer, TEXT_SAVE_DELAY_MS), questionId, answer };
  };

  useEffect(() => () => flushTextAnswer(), [flushTextAnswer]);

  const saveMutation = useMutation({
    mutationFn: (payload: { currentQuestionIndex: number; answers: Record<string, string | string[] | null> }) =>
      api.updateExamSession(sessionId, payload),
    onSuccess: (response) => {
      const updated = response?.data;
      if (updated) {
        setTimeRemaining(updated.timeRemainingSeconds ?? 0);
        if (updated.partTimeLimits) {
          const next: Record<string, number> = {};
          Object.keys(updated.partTimeLimits).forEach((partId) => {
            next[partId] = updated.partTimeLimits![partId].timeLimitSeconds;
          });
          setPartTimeRemaining(next);
        }
      }
    },
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

  /** For fill-in-the-blank: one blank → string, multiple blanks → string[] */
  const handleFillInAnswer = useCallback(
    (blankIndex: number, value: string, blankCount: number) => {
      if (!currentQuestion) return;
      const current = answers[currentQuestion.id];
      const base = blankCount === 1
        ? typeof current === "string" ? current : ""
        : (Array.isArray(current) ? [...current] : Array(blankCount).fill(""));
      if (blankCount === 1) {
        handleAnswer(value.trim() ? value : null);
        return;
      }
      const arr = base as string[];
      const next = [...arr];
      next[blankIndex] = value;
      handleAnswer(next.every((v) => !v.trim()) ? null : next);
    },
    [currentQuestion, answers, handleAnswer]
  );

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < currentQuestions.length) {
      setCurrentIndex(index);
    }
  };

  const goToPart = (partId: string) => {
    setCurrentPart(partId);
    setCurrentIndex(0);
  };

  const partIds = hasParts && questionsByPart ? Object.keys(questionsByPart) : [];
  const currentPartIdx = currentPart ? partIds.indexOf(currentPart) : -1;
  const prevPartId = currentPartIdx > 0 ? partIds[currentPartIdx - 1] : null;
  const nextPartId = currentPartIdx >= 0 && currentPartIdx < partIds.length - 1 ? partIds[currentPartIdx + 1] : null;
  const isFirstInPart = currentIndex === 0;
  const isLastInPart = currentIndex >= currentQuestions.length - 1;
  const canGoPrevious = !isFirstInPart || prevPartId !== null;
  const canGoNext = !isLastInPart || nextPartId !== null;

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

  const handleSubmit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    submitMutation.mutate();
  }, [submitMutation]);

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

  const blankResult = currentQuestion ? parseBlanks(currentQuestion.questionText) : { segments: [], blankCount: 0 };
  const blankCount = blankResult.blankCount;
  const isFillInTheBlank = blankCount > 0;
  const hasOptionsForBlank = isFillInTheBlank && currentQuestion?.options?.length > 0;
  const currentLayout = currentQuestion ? layoutByTypeId.get(currentQuestion.questionTypeId) : undefined;
  // Questions without choices or blanks (direct identification, essay) still need somewhere to type
  const isTextAnswer =
    !!currentQuestion &&
    !isFillInTheBlank &&
    (currentLayout === "identification" || currentLayout === "essay" || (currentQuestion.options?.length ?? 0) === 0);
  const isEssay = currentLayout === "essay";
  const showMathKeypad =
    mathKeypadPref ??
    (!!currentQuestion && looksMathematical([currentQuestion.questionText, ...(currentQuestion.options ?? [])].join(" ")));
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const blankAnswers: string[] =
    blankCount === 1
      ? [typeof currentAnswer === "string" ? currentAnswer : ""]
      : Array.isArray(currentAnswer) ? currentAnswer : [];
  
  // Get current part time remaining
  const currentPartTimeRemaining = hasParts && currentPart && partTimeRemaining[currentPart] !== undefined
    ? partTimeRemaining[currentPart]
    : timeRemaining;

  // Timer color based on time remaining
  const timerColor =
    currentPartTimeRemaining < 60 ? "text-red-500" : currentPartTimeRemaining < 300 ? "text-amber-500" : "text-foreground";

  const renderQuestionButtons = (sizeClass: string, onPick?: () => void) =>
    currentQuestions.map((q, i) => {
      const isAnswered = answers[q.id] !== null && answers[q.id] !== undefined;
      const isCurrent = i === currentIndex;
      const isFlagged = flagged.has(q.id);
      return (
        <button
          key={q.id}
          type="button"
          onClick={() => {
            goToQuestion(i);
            onPick?.();
          }}
          aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ""}${isFlagged ? ", flagged" : ""}`}
          className={cn(
            "relative flex items-center justify-center rounded-md text-xs font-medium transition-all",
            sizeClass,
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
    });

  const navigatorLegend = (
    <div className="mt-4 flex items-center gap-3 text-[10px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-900/30" /> Answered
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded bg-muted" /> Unanswered
      </span>
      <span className="flex items-center gap-1">
        <Flag className="h-3 w-3 text-amber-500 fill-amber-500" /> Flagged
      </span>
    </div>
  );

  if (authLoading || isLoading) return <PageLoader />;
  if (!authLoading && !isAuthenticated) return <PageLoader />;
  if (error || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-md">
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
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-md">
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
        <DialogContent className="max-w-2xl">
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
            <Button onClick={() => setShowInstructions(false)} className="h-11 w-full sm:h-9">
              Start Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/xevra-logo.png" alt="Xevra" width={32} height={32} className="rounded-lg shrink-0" />
            <span className="text-sm font-semibold hidden truncate sm:inline">{session.exam?.title || "Exam"}</span>
          </div>
          <div className={cn("flex items-center gap-1.5 font-mono text-base font-bold tabular-nums sm:gap-2 sm:text-lg", timerColor)}>
            <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            {formatDuration(currentPartTimeRemaining)}
            {hasParts && currentPart && partTimeLimits && (
              <span className="hidden text-xs font-normal ml-2 sm:inline">
                ({questionsByPart?.[currentPart]?.part.name})
              </span>
            )}
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="h-9 shrink-0 sm:h-8"
            onClick={() => setShowSubmitDialog(true)}
          >
            <Send className="mr-1 h-3 w-3" /> Submit
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="mx-auto max-w-5xl px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{answeredCount} of {currentQuestions.length} answered</span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Part Navigation Tabs */}
      {hasParts && questionsByPart && (
        <div className="mx-auto max-w-5xl px-3 sm:px-4">
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

      <div className="mx-auto max-w-5xl px-3 py-4 flex gap-6 sm:px-4">
        {/* Question Navigator (sidebar) */}
        <div className="hidden lg:block w-64 shrink-0">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {renderQuestionButtons("h-9 w-9")}
              </div>
              {navigatorLegend}
            </CardContent>
          </Card>
        </div>

        {/* Mobile question navigator */}
        <Sheet open={navigatorOpen} onOpenChange={setNavigatorOpen}>
          <SheetContent side="bottom" className="gap-3 p-4 lg:hidden">
            <div className="pr-8">
              <SheetTitle>Questions</SheetTitle>
              <SheetDescription>
                {answeredCount} of {currentQuestions.length} answered
                {flagged.size > 0 && ` · ${flagged.size} flagged`}
              </SheetDescription>
            </div>
            <div className="overflow-y-auto p-1">
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
                {renderQuestionButtons("h-11 w-full text-sm", () => setNavigatorOpen(false))}
              </div>
            </div>
            {navigatorLegend}
          </SheetContent>
        </Sheet>

        {/* Question Content */}
        <div className="flex-1 min-w-0 pb-24 lg:pb-0">
          {currentQuestion ? (
            <>
            {shouldShowPhraseBlock && phraseForBlock && (
              <Card className="mb-4 border-dashed bg-muted/30">
                <CardHeader className="pb-2">
                  {phraseForBlock.title && (
                    <CardTitle className="text-base">{phraseForBlock.title}</CardTitle>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed"><MathText text={phraseForBlock.body} /></p>
                  {phraseForBlock.imageUrls && phraseForBlock.imageUrls.length > 0 && (
                    <div className="flex flex-col gap-3 pt-2">
                      {phraseForBlock.imageUrls.map((url: string, i: number) => (
                        <img
                          key={i}
                          src={url}
                          alt={phraseForBlock.title ? `${phraseForBlock.title} image ${i + 1}` : `Passage image ${i + 1}`}
                          className="max-w-full h-auto rounded-md border object-contain"
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-xs min-w-0">
                  <span className="truncate">
                    Question {currentIndex + 1} of {currentQuestions.length}
                    {hasParts && currentPart && questionsByPart && (
                      <span className="ml-2">
                        ({questionsByPart[currentPart]?.part.name})
                      </span>
                    )}
                  </span>
                </Badge>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{currentQuestion.points} pts</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFlag(currentQuestion.id)}
                      className={cn("h-9 w-9 p-0 sm:h-8 sm:w-auto sm:px-3", flagged.has(currentQuestion.id) ? "text-amber-500" : "text-muted-foreground")}
                      aria-label={flagged.has(currentQuestion.id) ? "Unflag question" : "Flag question for review"}
                      aria-pressed={flagged.has(currentQuestion.id)}
                    >
                      <Flag className={cn("h-4 w-4", flagged.has(currentQuestion.id) && "fill-amber-500")} />
                    </Button>
                  </div>
                </div>
                {!isFillInTheBlank && (
                  <CardTitle className="text-base sm:text-lg mt-3 leading-relaxed break-words whitespace-pre-wrap">
                    <MathText text={currentQuestion.questionText} />
                  </CardTitle>
                )}
                {isMultipleAnswer && !isFillInTheBlank && (
                  <p className="text-xs text-muted-foreground mt-1">Select all that apply</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {isFillInTheBlank ? (
                  // Fill in the blank: stem with one input/dropdown per blank
                  <div ref={answerScopeRef} className="space-y-3">
                    <p className="text-base sm:text-lg leading-relaxed flex flex-wrap items-baseline gap-x-1 gap-y-2">
                      {blankResult.segments.map((seg, i) => (
                        <span key={i}>
                          <MathText text={seg} />
                          {i < blankCount && (
                            hasOptionsForBlank ? (
                              <Select
                                value={
                                  blankCount === 1
                                    ? (answers[currentQuestion.id] as string) || ""
                                    : ((answers[currentQuestion.id] as string[])?.[i] ?? "")
                                }
                                onValueChange={(v) => handleFillInAnswer(i, v, blankCount)}
                              >
                                <SelectTrigger className="inline-flex w-auto min-w-[120px] h-9 mx-0.5 align-baseline">
                                  <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {currentQuestion.options.map((opt, j) => (
                                    <SelectItem key={j} value={opt}><MathText text={opt} /></SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type="text"
                                placeholder="Type answer"
                                aria-label={`Blank ${i + 1}`}
                                autoComplete="off"
                                autoCapitalize="off"
                                className={cn("inline-flex w-40 max-w-full h-10 mx-0.5 align-baseline", ANSWER_FIELD_CLASS)}
                                value={blankAnswers[i] ?? ""}
                                onChange={(e) => handleFillInAnswer(i, e.target.value, blankCount)}
                              />
                            )
                          )}
                        </span>
                      ))}
                    </p>
                    {!hasOptionsForBlank && (
                      <>
                        {blankAnswers.map((value, i) => (
                          <MathPreview key={i} value={value} label={blankCount > 1 ? `Blank ${i + 1} shows as` : "Shows as"} />
                        ))}
                        <MathKeypad scopeRef={answerScopeRef} open={showMathKeypad} onOpenChange={setMathKeypadPref} />
                      </>
                    )}
                  </div>
                ) : isTextAnswer ? (
                  <div ref={answerScopeRef} className="space-y-2">
                    <Label htmlFor={`answer-${currentQuestion.id}`} className="text-sm text-muted-foreground">
                      {isEssay ? "Write your answer" : "Type your answer"}
                    </Label>
                    {isEssay ? (
                      <Textarea
                        id={`answer-${currentQuestion.id}`}
                        rows={8}
                        placeholder="Write your answer here..."
                        className={cn("min-h-[180px]", ANSWER_FIELD_CLASS)}
                        value={(answers[currentQuestion.id] as string) ?? ""}
                        onChange={(e) => handleTextAnswer(currentQuestion.id, e.target.value)}
                        onBlur={flushTextAnswer}
                      />
                    ) : (
                      <Input
                        id={`answer-${currentQuestion.id}`}
                        type="text"
                        placeholder="Type your answer here"
                        autoComplete="off"
                        autoCapitalize="off"
                        className={cn("h-11", ANSWER_FIELD_CLASS)}
                        value={(answers[currentQuestion.id] as string) ?? ""}
                        onChange={(e) => handleTextAnswer(currentQuestion.id, e.target.value)}
                        onBlur={flushTextAnswer}
                      />
                    )}
                    <MathPreview value={typeof currentAnswer === "string" ? currentAnswer : ""} />
                    <MathKeypad scopeRef={answerScopeRef} open={showMathKeypad} onOpenChange={setMathKeypadPref} />
                  </div>
                ) : isMultipleAnswer ? (
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
                          <MathText text={option} className="min-w-0 break-words text-[15px] sm:text-sm" />
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  // Single answer (radio)
                  (() => {
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
                              <MathText text={option} className="min-w-0 break-words text-[15px] sm:text-sm" />
                            </label>
                          );
                        })}
                      </RadioGroup>
                    );
                  })()
                )}
              </CardContent>
            </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">No question available.</p>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-3 pt-2 pb-safe backdrop-blur lg:static lg:mt-4 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
              <Button
                variant="outline"
                onClick={goPrevious}
                disabled={!canGoPrevious}
                className="h-11 flex-1 lg:h-9 lg:flex-none"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> <span className="max-[359px]:hidden">Previous</span>
              </Button>

              {/* Mobile question indicator */}
              <Button
                variant="ghost"
                onClick={() => setNavigatorOpen(true)}
                className="h-11 shrink-0 gap-1.5 px-3 text-sm text-muted-foreground lg:hidden"
                aria-label="Show all questions"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="tabular-nums">{currentIndex + 1}/{currentQuestions.length}</span>
              </Button>

              {canGoNext ? (
                <Button onClick={goNext} className="h-11 flex-1 lg:h-9 lg:flex-none">
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => setShowSubmitDialog(true)} variant="default" className="h-11 flex-1 lg:h-9 lg:flex-none">
                  <Send className="mr-1 h-4 w-4" /> Finish<span className="max-sm:hidden">&nbsp;&amp; Submit</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <AlertDialog
        open={showSubmitDialog}
        onOpenChange={(open) => {
          if (!submitMutation.isPending) setShowSubmitDialog(open);
        }}
      >
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

      {/* Full-screen overlay during submission: blocks all interaction */}
      {submitMutation.isPending && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md pointer-events-auto"
          aria-live="polite"
          aria-busy="true"
          role="alert"
        >
          <div className="flex flex-col items-center gap-4 max-w-sm px-6 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-base font-semibold">Submitting your exam</p>
              <p className="text-sm text-muted-foreground">
                Your exam is still being submitted. Please wait and do not close this page or navigate away.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
