"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Dumbbell,
  FileUp,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { extractSource, SOURCE_ACCEPT, type ExtractedSource } from "@/lib/source-extract";
import {
  generatePracticeQuiz,
  practiceAnswerIsCorrect,
  type PracticeQuestion,
  type PracticeQuizRequest,
} from "@/lib/study-ai";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";
import { MathText } from "@/components/math/math-text";
import { useT } from "@/lib/i18n";

const COUNTS = [5, 10, 15, 20];
const DIFFICULTY_OPTIONS: { value: PracticeQuizRequest["difficulty"]; label: string }[] = [
  { value: "mixed", label: "Mixed" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];
const HISTORY_LIMIT = 20;
const AUTO_LANGUAGE = "__auto__";
const QUIZ_LANGUAGES = ["English", "Filipino", "Spanish", "French", "German", "Japanese", "Chinese", "Korean", "Arabic", "Hindi", "Indonesian", "Portuguese", "Vietnamese"];

interface PracticeAttempt {
  at: string;
  topics: string[];
  notes: string[];
  score: number;
  total: number;
}

const historyKey = (uid: string) => `xebra:practice-history:${uid}`;

function loadHistory(uid: string): PracticeAttempt[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyKey(uid)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function PracticeSetup({
  onStart,
  generating,
  history,
}: {
  onStart: (req: PracticeQuizRequest) => void;
  generating: boolean;
  history: PracticeAttempt[];
}) {
  const searchParams = useSearchParams();
  const requestedTopics = useMemo(
    () => (searchParams.get("topics") || "").split("|").map((t) => t.trim()).filter(Boolean),
    [searchParams]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["study-topics"],
    queryFn: () => api.getStudyTopics(),
    retry: false,
  });
  const studyTopics = data?.data?.topics ?? [];

  const [selected, setSelected] = useState<string[]>(requestedTopics);
  const [customTopic, setCustomTopic] = useState("");
  const [sources, setSources] = useState<ExtractedSource[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<PracticeQuizRequest["difficulty"]>("mixed");
  const [language, setLanguage] = useState(AUTO_LANGUAGE);
  const fileInput = useRef<HTMLInputElement>(null);
  const preselected = useRef(requestedTopics.length > 0);

  useEffect(() => {
    if (preselected.current || studyTopics.length === 0) return;
    preselected.current = true;
    setSelected(studyTopics.filter((t) => t.weak).map((t) => t.topic).slice(0, 5));
  }, [studyTopics]);

  const toggle = (topic: string) =>
    setSelected((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]));

  const addCustomTopic = () => {
    const topic = customTopic.trim();
    if (!topic) return;
    setSelected((prev) => (prev.includes(topic) ? prev : [...prev, topic]));
    setCustomTopic("");
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setExtracting(true);
    try {
      for (const file of Array.from(files)) {
        try {
          const source = await extractSource(file);
          setSources((prev) => [...prev, source]);
          source.warnings.forEach((w) => toast.warning(w));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Could not read ${file.name}`);
        }
      }
    } finally {
      setExtracting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const otherSelected = selected.filter((t) => !studyTopics.some((s) => s.topic === t));
  const canStart = (selected.length > 0 || sources.length > 0) && !generating && !extracting;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose what to practice</CardTitle>
          <CardDescription>
            Pick topics from your recent exams, add your own, or upload notes to be quizzed on them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Topics from your exams</Label>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : studyTopics.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No topic data yet. Topics appear here after you finish exams that allow answer review.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {studyTopics.map((t) => {
                  const active = selected.includes(t.topic);
                  return (
                    <button
                      key={t.topic}
                      type="button"
                      onClick={() => toggle(t.topic)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                        !active && t.weak && "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"
                      )}
                    >
                      {t.topic} · {t.percentage}%
                    </button>
                  );
                })}
              </div>
            )}
            {studyTopics.some((t) => t.weak) && (
              <p className="text-xs text-muted-foreground">Topics in red are below {data?.data?.threshold ?? 70}%.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-topic">Other topics</Label>
            <div className="flex gap-2">
              <Input
                id="custom-topic"
                value={customTopic}
                placeholder="e.g. Photosynthesis"
                onChange={(e) => setCustomTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTopic();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addCustomTopic} disabled={!customTopic.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {otherSelected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {otherSelected.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button type="button" onClick={() => toggle(t)} aria-label={`Remove ${t}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Your notes (optional)</Label>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={SOURCE_ACCEPT}
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={extracting}>
              {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              Upload notes
            </Button>
            <p className="text-xs text-muted-foreground">PDF, Word, PowerPoint, text, or photos of handwritten notes.</p>
            {sources.length > 0 && (
              <ul className="space-y-1">
                {sources.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                    <span className="min-w-0 truncate">{s.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Remove ${s.name}`}
                      onClick={() => setSources((prev) => prev.filter((p) => p.id !== s.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Quiz settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Questions</Label>
            <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTS.map((c) => <SelectItem key={c} value={String(c)}>{c} questions</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as PracticeQuizRequest["difficulty"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTY_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO_LANGUAGE}>Same as my notes or topics</SelectItem>
                {QUIZ_LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        size="lg"
        disabled={!canStart}
        onClick={() =>
          onStart({ topics: selected, sources, count, difficulty, language: language === AUTO_LANGUAGE ? undefined : language })
        }
      >
        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        {generating ? "Writing your quiz…" : "Start practice quiz"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Practice quizzes are written by AI and count toward your daily AI limit. They don&apos;t affect your grades.
      </p>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent practice</CardTitle>
            <CardDescription>Saved on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {history.map((h) => (
                <li key={h.at} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{[...h.topics, ...h.notes].join(", ") || "Practice"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(h.at)}</p>
                  </div>
                  <Badge variant={h.score / h.total >= 0.7 ? "success" : "secondary"}>
                    {h.score}/{h.total}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PracticeQuiz({
  questions,
  onFinish,
}: {
  questions: PracticeQuestion[];
  onFinish: (answers: string[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [checked, setChecked] = useState(false);
  const question = questions[index];
  const answer = answers[index];
  const correct = checked && practiceAnswerIsCorrect(question, answer);
  const isLast = index === questions.length - 1;

  const setAnswer = (value: string) => {
    if (checked) return;
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  };

  const next = () => {
    if (isLast) return onFinish(answers);
    setIndex(index + 1);
    setChecked(false);
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Question {index + 1} of {questions.length}</span>
          {question.topic && <Badge variant="outline">{question.topic}</Badge>}
        </div>
        <Progress value={((index + (checked ? 1 : 0)) / questions.length) * 100} className="h-1.5" />
        <CardTitle className="whitespace-pre-wrap text-lg leading-snug">
          <MathText text={question.question} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {question.type === "identification" ? (
          <Input
            autoFocus
            value={answer}
            disabled={checked}
            placeholder="Type your answer"
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && answer.trim()) (checked ? next() : setChecked(true));
            }}
          />
        ) : (
          <div className="grid gap-2">
            {question.options.map((option, i) => {
              const isKey = checked && practiceAnswerIsCorrect(question, option);
              const isWrongPick = checked && option === answer && !isKey;
              return (
                <button
                  key={`${i}-${option}`}
                  type="button"
                  disabled={checked}
                  onClick={() => setAnswer(option)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                    !checked && option === answer && "border-primary bg-primary/5",
                    !checked && option !== answer && "hover:bg-muted",
                    isKey && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
                    isWrongPick && "border-red-500 bg-red-50 dark:bg-red-950/30"
                  )}
                >
                  <span className="font-semibold text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                  <MathText text={option} className="min-w-0 flex-1 break-words" />
                  {isKey && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                  {isWrongPick && <XCircle className="h-4 w-4 shrink-0 text-red-600" />}
                </button>
              );
            })}
          </div>
        )}

        {checked && (
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              correct
                ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20"
                : "border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/20"
            )}
          >
            <p className="font-semibold">
              {correct ? (
                "Correct!"
              ) : (
                <>
                  Not quite. The answer is: <MathText text={question.answer} />
                </>
              )}
            </p>
            {question.explanation && (
              <p className="mt-1 text-muted-foreground">
                <MathText text={question.explanation} />
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          {checked ? (
            <Button onClick={next}>{isLast ? "See results" : "Next question"}</Button>
          ) : (
            <Button onClick={() => setChecked(true)} disabled={!answer.trim()}>Check answer</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PracticeResults({
  questions,
  answers,
  onRetry,
  onNew,
}: {
  questions: PracticeQuestion[];
  answers: string[];
  onRetry: () => void;
  onNew: () => void;
}) {
  const score = questions.filter((q, i) => practiceAnswerIsCorrect(q, answers[i])).length;
  const percentage = Math.round((score / questions.length) * 100);
  const missedTopics = [
    ...new Set(questions.filter((q, i) => !practiceAnswerIsCorrect(q, answers[i]) && q.topic).map((q) => q.topic)),
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-4xl font-bold">{percentage}%</p>
          <p className="text-muted-foreground">
            {score} of {questions.length} correct
          </p>
          {missedTopics.length > 0 && (
            <p className="max-w-md text-sm text-muted-foreground">Worth another look: {missedTopics.join(", ")}</p>
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={onRetry}>
              <RotateCcw className="mr-2 h-4 w-4" /> Same settings, new questions
            </Button>
            <Button onClick={onNew}>
              <Dumbbell className="mr-2 h-4 w-4" /> New practice
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.map((q, i) => {
            const ok = practiceAnswerIsCorrect(q, answers[i]);
            return (
              <div key={i} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start gap-2">
                  {ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  )}
                  <div className="min-w-0 space-y-1">
                    <p className="whitespace-pre-wrap font-medium">
                      <MathText text={q.question} />
                    </p>
                    <p className="text-muted-foreground">
                      Your answer: {answers[i] ? <MathText text={answers[i]} /> : "—"}
                      {!ok && (
                        <>
                          {" "}
                          · Correct:{" "}
                          <span className="font-medium text-foreground">
                            <MathText text={q.answer} />
                          </span>
                        </>
                      )}
                    </p>
                    {!ok && q.explanation && (
                      <p className="text-muted-foreground">
                        <MathText text={q.explanation} />
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function PracticePageContent() {
  const { user } = useAuthStore();
  const t = useT();
  const [phase, setPhase] = useState<"setup" | "quiz" | "results">("setup");
  const [request, setRequest] = useState<PracticeQuizRequest | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<PracticeAttempt[]>([]);

  useEffect(() => {
    if (user?.uid) setHistory(loadHistory(user.uid));
  }, [user?.uid]);

  const start = async (req: PracticeQuizRequest) => {
    setGenerating(true);
    try {
      const quiz = await generatePracticeQuiz(req);
      if (quiz.length === 0) {
        toast.error("The AI couldn't write questions for that. Try different topics or notes.");
        return;
      }
      setRequest(req);
      setQuestions(quiz);
      setAnswers([]);
      setPhase("quiz");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create a practice quiz.");
    } finally {
      setGenerating(false);
    }
  };

  const finish = (final: string[]) => {
    setAnswers(final);
    setPhase("results");
    if (!user?.uid || !request) return;
    const attempt: PracticeAttempt = {
      at: new Date().toISOString(),
      topics: request.topics,
      notes: (request.sources ?? []).map((s) => s.name),
      score: questions.filter((q, i) => practiceAnswerIsCorrect(q, final[i])).length,
      total: questions.length,
    };
    const next = [attempt, ...loadHistory(user.uid)].slice(0, HISTORY_LIMIT);
    try {
      localStorage.setItem(historyKey(user.uid), JSON.stringify(next));
    } catch {
      // Storage full or disabled; history is a convenience only
    }
    setHistory(next);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Dumbbell className="h-6 w-6" /> {t("practice.title")}
        </h1>
        <p className="text-muted-foreground">{t("practice.subtitle")}</p>
      </div>

      {phase === "setup" && <PracticeSetup onStart={start} generating={generating} history={history} />}
      {phase === "quiz" && <PracticeQuiz key={questions.map((q) => q.question).join("|")} questions={questions} onFinish={finish} />}
      {phase === "results" && (
        <PracticeResults
          questions={questions}
          answers={answers}
          onRetry={() => request && start(request)}
          onNew={() => setPhase("setup")}
        />
      )}
      {phase === "results" && generating && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Writing new questions…
        </p>
      )}
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-2xl" />}>
      <PracticePageContent />
    </Suspense>
  );
}
