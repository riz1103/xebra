"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { examSchema, type ExamFormValues } from "@/lib/validations";
import { parseExamFile, parsedToPayload } from "@/lib/exam-parser";
import type { ParseResult } from "@/lib/exam-parser";
import { getLayoutConfig, type LayoutConfig } from "@/lib/question-layout";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Upload,
  FileText,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  X,
  ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { parseBlanks } from "@/lib/question-blanks";
import type { CreateExamQuestionPayload, ExamPart } from "@/types";

/** One item in the Questions section: either a standalone question or a phrase block with nested questions */
type QuestionSection =
  | { id: string; type: "standalone"; question: CreateExamQuestionPayload }
  | {
      id: string;
      type: "phrase";
      phrase: { title: string; body: string; usageType?: string };
      imageFiles: File[];
      questions: CreateExamQuestionPayload[];
    };

function genSectionId() {
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const MAX_PHRASE_IMAGES_BYTES = 10 * 1024 * 1024; // 10MB per phrase

/** Thumbnail for a phrase image with limited height; click to open full preview */
function PhraseImageThumbnail({
  file,
  onPreview,
  onRemove,
}: {
  file: File;
  onPreview: (url: string) => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  return (
    <li className="flex items-center gap-2 rounded border overflow-hidden bg-muted/30">
      <button
        type="button"
        onClick={() => onPreview(url)}
        className="flex-1 min-w-0 flex items-center gap-2 p-1.5 text-left hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <img
          src={url}
          alt={file.name}
          className="h-20 w-auto max-w-[120px] object-contain shrink-0 rounded"
        />
        <span className="truncate text-sm flex-1">{file.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onRemove}
        aria-label="Remove image"
      >
        <X className="h-3 w-3" />
      </Button>
    </li>
  );
}

/** Renders one question form (standalone or under a phrase) */
function QuestionCard({
  question: q,
  questionLabel,
  layoutConfig,
  needsAnswer,
  questionTypes,
  parts,
  getQuestionCountForPart,
  onRemove,
  updateQuestion,
  handleQuestionTypeChange,
  updateOption,
  addOption,
  removeOption,
  toggleCorrectAnswer,
  setQuestion,
}: {
  sectionId: string;
  question: CreateExamQuestionPayload;
  questionLabel: string;
  layoutConfig: LayoutConfig;
  needsAnswer: boolean;
  questionTypes: { id: string; name: string }[];
  parts: ExamPart[];
  getQuestionCountForPart: (partId: string) => number;
  onRemove: () => void;
  phraseQuestionIndex: number | undefined;
  updateQuestion: (field: string, value: unknown) => void;
  handleQuestionTypeChange: (newTypeId: string) => void;
  updateOption: (oIndex: number, value: string) => void;
  addOption: () => void;
  removeOption: (oIndex: number) => void;
  toggleCorrectAnswer: (optionIndex: number, checked: boolean) => void;
  setQuestion: (q: CreateExamQuestionPayload) => void;
  sections: QuestionSection[];
  setSections: React.Dispatch<React.SetStateAction<QuestionSection[]>>;
}) {
  return (
    <div
      className={`rounded-lg border p-4 space-y-4 ${
        needsAnswer ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm">{questionLabel}</h4>
          {needsAnswer && (
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mr-1 h-2.5 w-2.5" /> Needs answer
            </Badge>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-destructive">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Question Text *</Label>
          <Textarea
            value={q.questionText}
            onChange={(e) => updateQuestion("questionText", e.target.value)}
            placeholder="Enter your question..."
          />
          {layoutConfig.layout === "identification" && (
            <p className="text-xs text-muted-foreground">
              Tip: Use _____ (two or more underscores) for fill-in-the-blank. One input per blank; answer as text or multiple accepted answers.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Question Type</Label>
          <Select value={q.questionTypeId} onValueChange={handleQuestionTypeChange}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {questionTypes.map((qt) => (
                <SelectItem key={qt.id} value={qt.id}>{qt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Points</Label>
          <Input
            type="number"
            min={1}
            value={q.points}
            onChange={(e) => updateQuestion("points", parseInt(e.target.value) || 1)}
          />
        </div>
        {parts.length > 0 && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Exam Part (Optional)</Label>
            <Select
              value={q.partId || "none"}
              onValueChange={(v) => updateQuestion("partId", v && v !== "none" ? v : null)}
            >
              <SelectTrigger><SelectValue placeholder="No Part" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Part</SelectItem>
                {parts.map((part) => (
                  <SelectItem key={part.id} value={part.id}>
                    {part.name} ({getQuestionCountForPart(part.id)} questions)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {layoutConfig.showOptions && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Options</Label>
              {layoutConfig.editableOptions && (
                <Button type="button" variant="ghost" size="sm" onClick={addOption}>
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              )}
            </div>
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6">{String.fromCharCode(65 + oi)}.</span>
                {layoutConfig.editableOptions ? (
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(oi, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                    className="flex-1"
                  />
                ) : (
                  <span className="text-sm flex-1">{opt}</span>
                )}
                {layoutConfig.editableOptions && q.options.length > 2 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(oi)} className="shrink-0">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {layoutConfig.showCorrectAnswer && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label>{layoutConfig.correctAnswerLabel}</Label>
            {layoutConfig.correctAnswerIsText ? (
              (() => {
                const blankCount =
                  layoutConfig.layout === "identification"
                    ? parseBlanks(q.questionText).blankCount
                    : 0;
                if (blankCount > 0) {
                  const base = Array.isArray(q.correctAnswer)
                    ? (q.correctAnswer as string[])
                    : typeof q.correctAnswer === "string"
                      ? [q.correctAnswer]
                      : [""];
                  const answers = Array.from({ length: blankCount }, (_, i) =>
                    base[i] !== undefined ? base[i] : ""
                  );
                  return (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        This question has {blankCount} blank{blankCount !== 1 ? "s" : ""}. Provide the correct answer for each in order.
                      </p>
                      {answers.map((ans, ai) => (
                        <div key={ai} className="flex items-center gap-2">
                          <Label className="shrink-0 text-xs w-24">Blank {ai + 1}</Label>
                          <Input
                            value={ans}
                            onChange={(e) => {
                              const next = [...answers];
                              next[ai] = e.target.value;
                              setQuestion({ ...q, correctAnswer: next });
                            }}
                            placeholder={layoutConfig.correctAnswerPlaceholder}
                            className="flex-1"
                          />
                        </div>
                      ))}
                    </div>
                  );
                }
                const answers = Array.isArray(q.correctAnswer)
                  ? (q.correctAnswer as string[])
                  : typeof q.correctAnswer === "string" && q.correctAnswer
                    ? [q.correctAnswer]
                    : [""];
                return (
                  <div className="space-y-2">
                    {answers.map((ans, ai) => (
                      <div key={ai} className="flex items-center gap-2">
                        <Input
                          value={ans}
                          onChange={(e) => {
                            const arr = Array.isArray(q.correctAnswer)
                              ? [...(q.correctAnswer as string[])]
                              : [String(q.correctAnswer || "")];
                            arr[ai] = e.target.value;
                            setQuestion({ ...q, correctAnswer: arr });
                          }}
                          placeholder={answers.length > 1 ? `Accepted answer ${ai + 1}` : layoutConfig.correctAnswerPlaceholder}
                          className="flex-1"
                        />
                        {answers.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const arr = Array.isArray(q.correctAnswer)
                                ? [...(q.correctAnswer as string[])]
                                : [String(q.correctAnswer || "")];
                              arr.splice(ai, 1);
                              setQuestion({ ...q, correctAnswer: arr });
                            }}
                            className="shrink-0"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const arr = Array.isArray(q.correctAnswer)
                          ? [...(q.correctAnswer as string[])]
                          : [String(q.correctAnswer || "")];
                        arr.push("");
                        setQuestion({ ...q, correctAnswer: arr });
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add Accepted Answer
                    </Button>
                  </div>
                );
              })()
            ) : (
              <div className="space-y-2">
                {q.options.filter(Boolean).map((opt, oi) => {
                  const selectedIndices = Array.isArray(q.correctAnswer) ? (q.correctAnswer as string[]) : [];
                  return (
                    <label key={oi} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedIndices.includes(String(oi))}
                        onCheckedChange={(checked) => toggleCorrectAnswer(oi, !!checked)}
                      />
                      <span className="text-xs text-muted-foreground">{String.fromCharCode(65 + oi)}.</span>
                      <span className="text-sm">{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      {!layoutConfig.showCorrectAnswer && !layoutConfig.showOptions && (
        <>
          <Separator />
          <p className="text-xs text-muted-foreground italic">
            This question type will be graded manually. No options or correct answer needed.
          </p>
        </>
      )}
    </div>
  );
}

export default function CreateExamPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sections, setSections] = useState<QuestionSection[]>([]);
  const [parts, setParts] = useState<ExamPart[]>([]);
  const [passingConditionType, setPassingConditionType] = useState<"whole_exam" | "per_part">("whole_exam");

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const phraseImageInputRef = useRef<HTMLInputElement>(null);
  const phraseImageTargetSectionIdRef = useRef<string | null>(null);
  const [phrasePreviewUrl, setPhrasePreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<ParseResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const { data: questionTypesData } = useQuery({
    queryKey: ["question-types"],
    queryFn: () => api.getQuestionTypes(),
  });
  const questionTypes = questionTypesData?.data || [];

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title: "",
      description: "",
      instruction: null,
      parts: null,
      questionOrder: "fixed",
      timeType: "per_exam",
      timeLimit: 60,
      passingCondition: { type: "percentage", value: 70 },
      isPublic: false,
      reviewableByExaminee: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { values: ExamFormValues; sections: QuestionSection[] }) => {
      const { values, sections: secs } = payload;
      const layoutMap = new Map(
        questionTypes.map((qt) => [qt.id, getLayoutConfig(qt.name)])
      );
      const toQuestionPayload = (q: CreateExamQuestionPayload) => {
        const config = layoutMap.get(q.questionTypeId);
        if (Array.isArray(q.correctAnswer) && config) {
          if (config.correctAnswerIsText) {
            const filtered = (q.correctAnswer as string[]).filter(Boolean);
            return { ...q, correctAnswer: filtered.length === 1 ? filtered[0] : filtered };
          }
          return {
            ...q,
            correctAnswer: (q.correctAnswer as string[])
              .map((idx) => q.options[Number(idx)])
              .filter(Boolean),
          };
        }
        return q;
      };

      let finalTimeLimit = values.timeLimit;
      if (values.timeType === "per_part" && parts.length > 0) {
        finalTimeLimit = parts.reduce((sum, part) => sum + (part.timeLimit || 0), 0);
      }
      let finalPassingCondition = values.passingCondition;
      let finalParts: ExamPart[] | null =
        parts.length > 0
          ? parts.map((p): ExamPart => ({
              id: p.id,
              name: p.name,
              description: p.description,
              numberOfItems: p.numberOfItems ?? null,
              timeLimit: p.timeLimit ?? null,
              passingCondition: p.passingCondition ?? null,
            }))
          : null;
      if (passingConditionType === "per_part") {
        finalPassingCondition = { type: "percentage" as const, value: 0 };
      } else if (finalParts) {
        finalParts = finalParts.map((p) => ({ ...p, passingCondition: null }));
      }

      const examRes = await api.createExam({
        ...values,
        instruction: values.instruction || null,
        parts: finalParts,
        passingCondition: finalPassingCondition,
        timeLimit: finalTimeLimit,
        questions: [], // We add questions (and phrases) below
      });
      const examId = (examRes?.data as { id?: string })?.id;
      if (!examId) throw new Error("Exam created but no ID returned");

      for (const sec of secs) {
        if (sec.type === "standalone") {
          await api.createExamQuestion({ ...toQuestionPayload(sec.question), examId });
        } else {
          const hasImages = sec.imageFiles.length > 0;
          let phraseId: string;
          if (hasImages) {
            const formData = new FormData();
            formData.set("body", (sec.phrase.body || "").trim() || "(No content)");
            const title = (sec.phrase.title || "").trim();
            if (title) formData.set("title", title);
            formData.set("examId", examId);
            formData.set("usageType", sec.phrase.usageType || "passage");
            sec.imageFiles.forEach((f) => formData.append("images", f));
            const phraseRes = await api.createPhraseWithFiles(formData);
            phraseId = (phraseRes?.data as { id?: string })?.id ?? "";
          } else {
            const phraseRes = await api.createPhrase({
              body: (sec.phrase.body || "").trim() || "(No content)",
              title: (sec.phrase.title || "").trim() || null,
              examId,
              usageType: sec.phrase.usageType || "passage",
            });
            phraseId = (phraseRes?.data as { id?: string })?.id ?? "";
          }
          if (!phraseId) throw new Error("Phrase created but no ID returned");
          for (const q of sec.questions) {
            await api.createExamQuestion({
              ...toQuestionPayload(q),
              examId,
              phraseId,
            });
          }
        }
      }
      return { examId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam created successfully!");
      router.push("/dashboard/exams");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create exam"),
  });

  const getTypeName = (typeId: string) =>
    questionTypes.find((qt) => qt.id === typeId)?.name || "";

  /** Flatten all questions from sections (for counts and for legacy upload) */
  const allQuestions = sections.flatMap((s) =>
    s.type === "standalone" ? [s.question] : s.questions
  );

  const addQuestion = () => {
    const defaultTypeId = questionTypes[0]?.id || "";
    const layout = getLayoutConfig(getTypeName(defaultTypeId));
    setSections((prev) => [
      ...prev,
      {
        id: genSectionId(),
        type: "standalone",
        question: {
          questionTypeId: defaultTypeId,
          questionText: "",
          options: layout.defaultOptions.length > 0 ? [...layout.defaultOptions] : ["", "", "", ""],
          correctAnswer: layout.correctAnswerIsText ? "" : [],
          points: 1,
          examId: "",
        },
      },
    ]);
  };

  const addPhrase = () => {
    setSections((prev) => [
      ...prev,
      {
        id: genSectionId(),
        type: "phrase",
        phrase: { title: "", body: "", usageType: "passage" },
        imageFiles: [],
        questions: [],
      },
    ]);
  };

  const addPhraseImages = (sectionId: string, files: File[]) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.type !== "phrase" || s.id !== sectionId) return s;
        const total = [...s.imageFiles, ...files].reduce((sum, f) => sum + f.size, 0);
        if (total > MAX_PHRASE_IMAGES_BYTES) {
          toast.error("Total images for this passage must be 10 MB or less.");
          return s;
        }
        return { ...s, imageFiles: [...s.imageFiles, ...files] };
      })
    );
  };

  const removePhraseImage = (sectionId: string, index: number) => {
    setPhrasePreviewUrl(null);
    setSections((prev) =>
      prev.map((s) =>
        s.type === "phrase" && s.id === sectionId
          ? { ...s, imageFiles: s.imageFiles.filter((_, i) => i !== index) }
          : s
      )
    );
  };

  const openPhraseImagePicker = (sectionId: string) => {
    phraseImageTargetSectionIdRef.current = sectionId;
    phraseImageInputRef.current?.click();
  };

  const onPhraseImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sectionId = phraseImageTargetSectionIdRef.current;
    if (!sectionId) return;
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addPhraseImages(sectionId, files);
    phraseImageTargetSectionIdRef.current = null;
    if (phraseImageInputRef.current) phraseImageInputRef.current.value = "";
  };

  const addQuestionUnderPhrase = (sectionId: string) => {
    const defaultTypeId = questionTypes[0]?.id || "";
    const layout = getLayoutConfig(getTypeName(defaultTypeId));
    const newQ: CreateExamQuestionPayload = {
      questionTypeId: defaultTypeId,
      questionText: "",
      options: layout.defaultOptions.length > 0 ? [...layout.defaultOptions] : ["", "", "", ""],
      correctAnswer: layout.correctAnswerIsText ? "" : [],
      points: 1,
      examId: "",
    };
    setSections((prev) =>
      prev.map((s) =>
        s.type === "phrase" && s.id === sectionId
          ? { ...s, questions: [...s.questions, newQ] }
          : s
      )
    );
  };

  const updatePhraseBlock = (sectionId: string, phrase: { title: string; body: string; usageType?: string }) => {
    setSections((prev) =>
      prev.map((s) =>
        s.type === "phrase" && s.id === sectionId ? { ...s, phrase } : s
      )
    );
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const removeQuestionUnderPhrase = (sectionId: string, qIndex: number) => {
    setSections((prev) =>
      prev.map((s) =>
        s.type === "phrase" && s.id === sectionId
          ? { ...s, questions: s.questions.filter((_, i) => i !== qIndex) }
          : s
      )
    );
  };

  const getQuestionAt = (sectionId: string, phraseQuestionIndex?: number): CreateExamQuestionPayload | null => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return null;
    if (sec.type === "standalone") return sec.question;
    if (sec.type === "phrase" && typeof phraseQuestionIndex === "number") {
      return sec.questions[phraseQuestionIndex] ?? null;
    }
    return null;
  };

  const setQuestionAt = (sectionId: string, phraseQuestionIndex: number | undefined, q: CreateExamQuestionPayload) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        if (s.type === "standalone") return { ...s, question: q };
        if (s.type === "phrase" && typeof phraseQuestionIndex === "number") {
          const next = [...s.questions];
          next[phraseQuestionIndex] = q;
          return { ...s, questions: next };
        }
        return s;
      })
    );
  };

  const handleQuestionTypeChange = (sectionId: string, phraseQuestionIndex: number | undefined, newTypeId: string) => {
    const q = getQuestionAt(sectionId, phraseQuestionIndex);
    if (!q) return;
    const oldLayout = getLayoutConfig(getTypeName(q.questionTypeId));
    const newLayout = getLayoutConfig(getTypeName(newTypeId));
    const next: CreateExamQuestionPayload = { ...q, questionTypeId: newTypeId };
    if (oldLayout.layout !== newLayout.layout) {
      next.options = [...newLayout.defaultOptions];
      next.numberOfChoices = newLayout.defaultOptions.length || undefined;
      next.correctAnswer = newLayout.correctAnswerIsText ? "" : [];
    }
    setQuestionAt(sectionId, phraseQuestionIndex, next);
  };

  const toggleCorrectAnswer = (sectionId: string, phraseQuestionIndex: number | undefined, optionIndex: number, checked: boolean) => {
    const q = getQuestionAt(sectionId, phraseQuestionIndex);
    if (!q) return;
    const existing = q.correctAnswer;
    const current = Array.isArray(existing) ? (existing as string[]) : [];
    const idx = String(optionIndex);
    const next = { ...q, correctAnswer: checked ? [...current, idx] : current.filter((a) => a !== idx) };
    setQuestionAt(sectionId, phraseQuestionIndex, next);
  };

  const updateQuestion = (sectionId: string, phraseQuestionIndex: number | undefined, field: string, value: unknown) => {
    const q = getQuestionAt(sectionId, phraseQuestionIndex);
    if (!q) return;
    setQuestionAt(sectionId, phraseQuestionIndex, { ...q, [field]: value });
  };

  const updateOption = (sectionId: string, phraseQuestionIndex: number | undefined, oIndex: number, value: string) => {
    const q = getQuestionAt(sectionId, phraseQuestionIndex);
    if (!q) return;
    const next = [...q.options];
    next[oIndex] = value;
    setQuestionAt(sectionId, phraseQuestionIndex, { ...q, options: next });
  };

  const addOption = (sectionId: string, phraseQuestionIndex: number | undefined) => {
    const q = getQuestionAt(sectionId, phraseQuestionIndex);
    if (!q) return;
    setQuestionAt(sectionId, phraseQuestionIndex, {
      ...q,
      options: [...q.options, ""],
      numberOfChoices: q.options.length + 1,
    });
  };

  const removeOption = (sectionId: string, phraseQuestionIndex: number | undefined, oIndex: number) => {
    const q = getQuestionAt(sectionId, phraseQuestionIndex);
    if (!q) return;
    const nextOpts = q.options.filter((_, i) => i !== oIndex);
    let nextAnswer = q.correctAnswer;
    if (Array.isArray(nextAnswer)) {
      nextAnswer = (nextAnswer as string[])
        .map((idx) => Number(idx))
        .filter((idx) => idx !== oIndex)
        .map((idx) => String(idx > oIndex ? idx - 1 : idx));
    }
    setQuestionAt(sectionId, phraseQuestionIndex, {
      ...q,
      options: nextOpts,
      numberOfChoices: nextOpts.length,
      correctAnswer: nextAnswer,
    });
  };

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
      ];
      const validExtensions = [".pdf", ".docx", ".doc"];
      const hasValidExtension = validExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );

      if (!validTypes.includes(file.type) && !hasValidExtension) {
        toast.error("Please upload a PDF or Word document (.pdf, .docx, .doc)");
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File is too large. Maximum size is 10MB.");
        return;
      }

      setIsScanning(true);
      setScanProgress(0);
      setScanError(null);
      setScanResult(null);
      setUploadedFileName(file.name);

      try {
        // Simulate progress stages
        setScanProgress(10);
        await new Promise((r) => setTimeout(r, 200));
        setScanProgress(30);

        const result = await parseExamFile(file);

        setScanProgress(70);
        await new Promise((r) => setTimeout(r, 300));
        setScanProgress(90);

        setScanResult(result);

        // Create exam parts from detected section headers (e.g. "True or False (11-20)", "Grammar and Vocabulary (21-40)")
        const newParts: ExamPart[] =
          result.sections?.length > 0
            ? result.sections.map((s) => ({
                id: generatePartId(),
                name: s.name,
                description: "",
                numberOfItems: null,
                timeLimit: null,
                passingCondition: null,
              }))
            : [];
        if (newParts.length > 0) {
          setParts((prev) => [...prev, ...newParts]);
        }

        const defaultTypeId = questionTypes[0]?.id || "";
        const payloads = parsedToPayload(
          result.questions,
          defaultTypeId,
          questionTypes,
          result.sections
        );
        const newQuestions = payloads.map((q, i) => {
          const partId =
            result.questions[i].sectionIndex !== undefined &&
            result.questions[i].sectionIndex! >= 0 &&
            newParts[result.questions[i].sectionIndex!]
              ? newParts[result.questions[i].sectionIndex!].id
              : null;
          let out = { ...q, examId: "", partId: partId ?? undefined };
          if (typeof q.correctAnswer === "string" && q.correctAnswer) {
            const idx = q.options.indexOf(q.correctAnswer);
            out = { ...out, correctAnswer: idx >= 0 ? [String(idx)] : [] };
          } else if (Array.isArray(q.correctAnswer)) {
            out = {
              ...out,
              correctAnswer: (q.correctAnswer as string[])
                .map((ans) => String(q.options.indexOf(ans)))
                .filter((idx) => idx !== "-1"),
            };
          } else {
            out = { ...out, correctAnswer: [] };
          }
          return out;
        });
        setSections((prev) => [
          ...prev,
          ...newQuestions.map((q) => ({
            id: genSectionId(),
            type: "standalone" as const,
            question: q,
          })),
        ]);

        setScanProgress(100);
        toast.success(
          `Successfully extracted ${result.questions.length} question(s) from the file!`
        );

        if (result.warnings.length > 0) {
          result.warnings.forEach((w) => toast.warning(w));
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to parse the file.";
        setScanError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsScanning(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [questionTypes]
  );

  const clearScanResult = () => {
    setScanResult(null);
    setScanError(null);
    setUploadedFileName(null);
    setScanProgress(0);
  };

  const generatePartId = () => {
    // Generate a GUID-like unique ID
    return `part_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const addPart = () => {
    const newPart: ExamPart = {
      id: generatePartId(),
      name: "",
      description: "",
      numberOfItems: null,
      timeLimit: null,
      passingCondition: null,
    };
    setParts([...parts, newPart]);
  };

  const updatePart = (index: number, updatedPart: ExamPart) => {
    const updated = [...parts];
    updated[index] = updatedPart;
    setParts(updated);
  };

  const deletePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const getQuestionCountForPart = (partId: string) => {
    return allQuestions.filter((q) => q.partId === partId).length;
  };

  const onSubmit = (values: ExamFormValues) => {
    const layoutMap = new Map(
      questionTypes.map((qt) => [qt.id, getLayoutConfig(qt.name)])
    );
    const allQuestions: { q: CreateExamQuestionPayload; label: string }[] = [];
    sections.forEach((sec, si) => {
      if (sec.type === "standalone") {
        allQuestions.push({ q: sec.question, label: `Question ${si + 1}` });
      } else {
        sec.questions.forEach((q, qi) => {
          allQuestions.push({
            q,
            label: `Section ${si + 1} (passage), question ${qi + 1}`,
          });
        });
      }
    });
    for (const { q, label } of allQuestions) {
      const config = layoutMap.get(q.questionTypeId);
      if (config?.layout === "identification" && config.correctAnswerIsText) {
        const blankCount = parseBlanks(q.questionText).blankCount;
        if (blankCount > 0) {
          const arr = Array.isArray(q.correctAnswer)
            ? (q.correctAnswer as string[])
            : typeof q.correctAnswer === "string"
              ? [q.correctAnswer]
              : [];
          const filled = arr.slice(0, blankCount).map((a) => (a ?? "").trim());
          if (filled.length !== blankCount || filled.some((a) => !a)) {
            toast.error(
              `${label}: Fill in the blanks requires ${blankCount} answer(s), one per blank. Please provide all.`
            );
            return;
          }
        }
      }
    }
    createMutation.mutate({ values, sections });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/exams"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Exam</h1>
          <p className="text-muted-foreground">Set up a new examination with questions.</p>
        </div>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          const firstError = Object.values(errors)[0]?.message;
          toast.error(firstError ?? "Please fix the errors below before saving.");
        })}
        className="space-y-6"
      >
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Configure the exam title, description, and settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Exam Title *</Label>
              <Input id="title" placeholder="e.g., Mathematics Final Exam" {...form.register("title")} />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Brief description of the exam..." {...form.register("description")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instruction">Exam Instructions</Label>
              <Textarea
                id="instruction"
                placeholder="Enter instructions for examinees (e.g., 'Please read all instructions carefully. You have 60 minutes to complete all parts.')"
                rows={4}
                {...form.register("instruction")}
              />
              <p className="text-xs text-muted-foreground">
                These instructions will be shown to examinees before they start the exam
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Question Order</Label>
                <Select value={form.watch("questionOrder")} onValueChange={(v) => form.setValue("questionOrder", v as "random" | "fixed")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Order</SelectItem>
                    <SelectItem value="random">Randomized</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time Type</Label>
                <Select value={form.watch("timeType")} onValueChange={(v) => form.setValue("timeType", v as "per_exam" | "per_question" | "per_part")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_exam">Per Exam (Total)</SelectItem>
                    <SelectItem value="per_question">Per Question</SelectItem>
                    <SelectItem value="per_part">Per Part</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timeLimit">Time Limit (minutes) *</Label>
                <Input
                  id="timeLimit"
                  type="number"
                  min={1}
                  {...form.register("timeLimit")}
                  disabled={form.watch("timeType") === "per_part"}
                />
                {form.watch("timeType") === "per_part" && (
                  <p className="text-xs text-muted-foreground">
                    Time limit will be calculated from part time limits
                  </p>
                )}
                {form.formState.errors.timeLimit && (
                  <p className="text-xs text-destructive">{form.formState.errors.timeLimit.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="numberOfItems">Number of Items (optional)</Label>
                <Input id="numberOfItems" type="number" min={1} placeholder="All" {...form.register("numberOfItems")} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Passing Condition */}
        <Card>
          <CardHeader>
            <CardTitle>Passing Condition</CardTitle>
            <CardDescription>Define what it takes to pass this exam.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Passing Condition Scope</Label>
              <Select
                value={passingConditionType}
                onValueChange={(v) => setPassingConditionType(v as "whole_exam" | "per_part")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whole_exam">Whole Exam</SelectItem>
                  <SelectItem value="per_part">Per Part</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {passingConditionType === "whole_exam"
                  ? "Set a single passing condition for the entire exam"
                  : "Set individual passing conditions for each part"}
              </p>
            </div>
            {passingConditionType === "whole_exam" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Condition Type</Label>
                  <Select
                    value={form.watch("passingCondition.type")}
                    onValueChange={(v) => form.setValue("passingCondition.type", v as "percentage" | "points" | "items")}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="points">Minimum Points</SelectItem>
                      <SelectItem value="items">Minimum Correct Items</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passingValue">Value *</Label>
                  <Input id="passingValue" type="number" min={0} {...form.register("passingCondition.value")} />
                </div>
              </div>
            )}
            {passingConditionType === "per_part" && parts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Add parts below to set per-part passing conditions. Each part can have its own passing requirement.
              </p>
            )}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.watch("isPublic")}
                onCheckedChange={(v) => form.setValue("isPublic", v)}
              />
              <Label>Make this exam public (accessible without invitation)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.watch("reviewableByExaminee") ?? false}
                onCheckedChange={(v) => form.setValue("reviewableByExaminee", v)}
              />
              <div>
                <Label>Allow examinees to review their answers</Label>
                <p className="text-xs text-muted-foreground">
                  When on, examinees can open &quot;View my answers&quot; after submitting to see questions and correct/incorrect.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exam Parts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Exam Parts</CardTitle>
              <CardDescription>
                Organize your exam into multiple parts (optional). Leave empty for a single-part exam.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addPart}>
              <Plus className="mr-1 h-3 w-3" /> Add Part
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {parts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No parts defined. This will be a single-part exam.
              </p>
            ) : (
              parts.map((part, index) => {
                const questionCount = getQuestionCountForPart(part.id);
                return (
                  <div key={index} className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Part {index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePart(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Part Name *</Label>
                      <Input
                        value={part.name}
                        onChange={(e) => updatePart(index, { ...part, name: e.target.value })}
                        placeholder="e.g., Mathematics"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={part.description}
                        onChange={(e) => updatePart(index, { ...part, description: e.target.value })}
                        placeholder="Optional description for this part"
                        rows={2}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Number of Items</Label>
                        <Input
                          type="number"
                          min={1}
                          value={part.numberOfItems ?? ""}
                          onChange={(e) =>
                            updatePart(index, {
                              ...part,
                              numberOfItems: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                          placeholder="All"
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty for all questions. Available: {questionCount} questions
                        </p>
                      </div>
                      {form.watch("timeType") === "per_part" && (
                        <div className="space-y-2">
                          <Label>Time Limit (minutes) *</Label>
                          <Input
                            type="number"
                            min={1}
                            value={part.timeLimit ?? ""}
                            onChange={(e) =>
                              updatePart(index, {
                                ...part,
                                timeLimit: e.target.value ? parseInt(e.target.value) : null,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                    {passingConditionType === "per_part" && (
                      <div className="space-y-2">
                        <Label>Passing Condition</Label>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Select
                            value={part.passingCondition?.type || "none"}
                            onValueChange={(v) =>
                              updatePart(index, {
                                ...part,
                                passingCondition: v && v !== "none"
                                  ? {
                                      type: v as "percentage" | "points" | "items",
                                      value: part.passingCondition?.value || 0,
                                    }
                                  : null,
                              })
                            }
                          >
                            <SelectTrigger><SelectValue placeholder="No Passing Condition" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Passing Condition</SelectItem>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="points">Points</SelectItem>
                              <SelectItem value="items">Items (Correct Answers)</SelectItem>
                            </SelectContent>
                          </Select>
                          {part.passingCondition && (
                            <Input
                              type="number"
                              min={0}
                              max={part.passingCondition.type === "percentage" ? 100 : undefined}
                              value={part.passingCondition.value}
                              onChange={(e) =>
                                updatePart(index, {
                                  ...part,
                                  passingCondition: {
                                    ...part.passingCondition!,
                                    value: parseFloat(e.target.value) || 0,
                                  },
                                })
                              }
                              placeholder={
                                part.passingCondition.type === "percentage"
                                  ? "Percentage (0-100)"
                                  : part.passingCondition.type === "points"
                                  ? "Minimum points"
                                  : "Minimum correct answers"
                              }
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          If this part doesn't meet its passing requirement, the entire exam will fail.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {form.formState.errors.parts && (
              <p className="text-xs text-destructive">{form.formState.errors.parts.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Questions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                Upload a file to auto-scan questions, or add them manually.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
              >
                <Upload className="mr-1 h-3 w-3" /> Upload File
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="mr-1 h-3 w-3" /> Add Question
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={addPhrase}>
                <BookOpen className="mr-1 h-3 w-3" /> Add Phrase (passage)
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                ref={phraseImageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onPhraseImageChange}
                className="hidden"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload Status */}
            {(isScanning || scanResult || scanError) && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {uploadedFileName}
                    </span>
                    {scanResult && !isScanning && (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3 text-green-500" />
                        {scanResult.questions.length} question(s) found
                      </Badge>
                    )}
                    {scanError && (
                      <Badge variant="destructive" className="text-xs">
                        Failed
                      </Badge>
                    )}
                  </div>
                  {!isScanning && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={clearScanResult}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Scanning progress */}
                {isScanning && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">
                        {scanProgress < 30
                          ? "Reading file..."
                          : scanProgress < 70
                            ? "Extracting questions..."
                            : scanProgress < 90
                              ? "Processing answers..."
                              : "Finalizing..."}
                      </span>
                    </div>
                    <Progress value={scanProgress} className="h-1.5" />
                  </div>
                )}

                {/* Scan error */}
                {scanError && (
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{scanError}</span>
                  </div>
                )}

                {/* Warnings */}
                {scanResult && scanResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    {scanResult.warnings.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400"
                      >
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Success info */}
                {scanResult && !isScanning && (
                  <p className="text-xs text-muted-foreground">
                    Questions have been added below for review. Please verify
                    each question, set the correct answers if missing, and adjust
                    any details before creating the exam.
                  </p>
                )}
              </div>
            )}

            {/* Drop zone when no sections */}
            {sections.length === 0 && !isScanning && !scanResult && !scanError ? (
              <div
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 px-6 cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("border-primary", "bg-muted/50");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-primary", "bg-muted/50");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-primary", "bg-muted/50");
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    // Create a synthetic event for the handler
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    if (fileInputRef.current) {
                      fileInputRef.current.files = dt.files;
                      fileInputRef.current.dispatchEvent(
                        new Event("change", { bubbles: true })
                      );
                    }
                  }
                }}
              >
                <div className="rounded-full bg-muted p-3 mb-3">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">
                  Upload an exam file to auto-scan questions
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Drag & drop or click to browse. Supports PDF and Word (.docx, .doc)
                </p>
                <a
                  href="/api/template/exam"
                  download="XEVRA-Exam-Import-Template.docx"
                  className="text-xs text-primary hover:underline mb-3 inline-block"
                  onClick={(e) => e.stopPropagation()}
                >
                  Download Word template (.docx) — proctor guide with all question types
                </a>
                <p className="text-xs text-muted-foreground">
                  Or add questions manually, or add a passage (phrase) and then add questions under it.
                </p>
              </div>
            ) : sections.length === 0 && !isScanning ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                No questions added yet. Add a question or add a phrase and then add questions under it.
              </p>
            ) : (
              sections.map((sec) => {
                if (sec.type === "standalone") {
                  const q = sec.question;
                  const layoutConfig = getLayoutConfig(getTypeName(q.questionTypeId));
                  const needsAnswer = layoutConfig.showCorrectAnswer && (
                    Array.isArray(q.correctAnswer)
                      ? q.correctAnswer.length === 0 || q.correctAnswer.every((a) => !a)
                      : !q.correctAnswer
                  );
                  const qNum = allQuestions.indexOf(q) + 1;
                  return (
                    <QuestionCard
                      key={sec.id}
                      sectionId={sec.id}
                      question={q}
                      questionLabel={`Question ${qNum}`}
                      layoutConfig={layoutConfig}
                      needsAnswer={!!needsAnswer}
                      questionTypes={questionTypes}
                      parts={parts}
                      getQuestionCountForPart={getQuestionCountForPart}
                      onRemove={() => removeSection(sec.id)}
                      phraseQuestionIndex={undefined}
                      updateQuestion={(field, value) => updateQuestion(sec.id, undefined, field, value)}
                      handleQuestionTypeChange={(newTypeId) => handleQuestionTypeChange(sec.id, undefined, newTypeId)}
                      updateOption={(oIndex, value) => updateOption(sec.id, undefined, oIndex, value)}
                      addOption={() => addOption(sec.id, undefined)}
                      removeOption={(oIndex) => removeOption(sec.id, undefined, oIndex)}
                      toggleCorrectAnswer={(optionIndex, checked) => toggleCorrectAnswer(sec.id, undefined, optionIndex, checked)}
                      setQuestion={(next) => setQuestionAt(sec.id, undefined, next)}
                      sections={sections}
                      setSections={setSections}
                    />
                  );
                }
                const phraseSec = sec;
                return (
                  <div key={phraseSec.id} className="rounded-lg border-2 border-primary/20 bg-muted/20 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <h4 className="font-medium text-sm">Passage (phrase)</h4>
                        <Badge variant="secondary" className="text-xs">
                          {phraseSec.questions.length} question(s) under this passage
                        </Badge>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeSection(phraseSec.id)} className="text-destructive">
                        <Trash2 className="h-3 w-3" /> Remove passage
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Passage title (optional)</Label>
                        <Input
                          value={phraseSec.phrase.title}
                          onChange={(e) => updatePhraseBlock(phraseSec.id, { ...phraseSec.phrase, title: e.target.value })}
                          placeholder="e.g. Reading passage"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Passage body *</Label>
                        <Textarea
                          value={phraseSec.phrase.body}
                          onChange={(e) => updatePhraseBlock(phraseSec.id, { ...phraseSec.phrase, body: e.target.value })}
                          placeholder="Enter the text that will appear above the questions..."
                          rows={5}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Usage type</Label>
                        <Select
                          value={phraseSec.phrase.usageType || "passage"}
                          onValueChange={(v) => updatePhraseBlock(phraseSec.id, { ...phraseSec.phrase, usageType: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="passage">Passage</SelectItem>
                            <SelectItem value="instruction">Instruction</SelectItem>
                            <SelectItem value="scenario">Scenario</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Images (optional)</Label>
                        <p className="text-xs text-muted-foreground">
                          Add images to this passage. Total size ≤ 10 MB.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openPhraseImagePicker(phraseSec.id)}
                        >
                          <ImageIcon className="mr-1 h-3 w-3" /> Choose images
                        </Button>
                        {phraseSec.imageFiles.length > 0 && (
                          <ul className="space-y-2 mt-2">
                            {phraseSec.imageFiles.map((f, i) => (
                              <PhraseImageThumbnail
                                key={`${phraseSec.id}-${i}-${f.name}`}
                                file={f}
                                onPreview={setPhrasePreviewUrl}
                                onRemove={() => removePhraseImage(phraseSec.id, i)}
                              />
                            ))}
                            <p className="text-xs text-muted-foreground">
                              Total: {(phraseSec.imageFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2)} MB / 10 MB
                            </p>
                          </ul>
                        )}
                      </div>
                    </div>
                    <div className="pt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => addQuestionUnderPhrase(phraseSec.id)}>
                        <Plus className="mr-1 h-3 w-3" /> Add question under this passage
                      </Button>
                    </div>
                    {phraseSec.questions.map((q, qIdx) => {
                      const layoutConfig = getLayoutConfig(getTypeName(q.questionTypeId));
                      const needsAnswer = layoutConfig.showCorrectAnswer && (
                        Array.isArray(q.correctAnswer)
                          ? q.correctAnswer.length === 0 || q.correctAnswer.every((a) => !a)
                          : !q.correctAnswer
                      );
                      const qNum = allQuestions.indexOf(q) + 1;
                      return (
                        <div key={qIdx} className="mt-4 pl-4 border-l-2 border-primary/30">
                          <QuestionCard
                            sectionId={phraseSec.id}
                            question={q}
                            questionLabel={`Question ${qNum} (under passage)`}
                            layoutConfig={layoutConfig}
                            needsAnswer={!!needsAnswer}
                            questionTypes={questionTypes}
                            parts={parts}
                            getQuestionCountForPart={getQuestionCountForPart}
                            onRemove={() => removeQuestionUnderPhrase(phraseSec.id, qIdx)}
                            phraseQuestionIndex={qIdx}
                            updateQuestion={(field, value) => updateQuestion(phraseSec.id, qIdx, field, value)}
                            handleQuestionTypeChange={(newTypeId) => handleQuestionTypeChange(phraseSec.id, qIdx, newTypeId)}
                            updateOption={(oIndex, value) => updateOption(phraseSec.id, qIdx, oIndex, value)}
                            addOption={() => addOption(phraseSec.id, qIdx)}
                            removeOption={(oIndex) => removeOption(phraseSec.id, qIdx, oIndex)}
                            toggleCorrectAnswer={(optionIndex, checked) => toggleCorrectAnswer(phraseSec.id, qIdx, optionIndex, checked)}
                            setQuestion={(next) => setQuestionAt(phraseSec.id, qIdx, next)}
                            sections={sections}
                            setSections={setSections}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/exams">Cancel</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Exam
          </Button>
        </div>
      </form>

      {/* Full-size image preview for phrase images */}
      <Dialog open={!!phrasePreviewUrl} onOpenChange={(open) => !open && setPhrasePreviewUrl(null)}>
        <DialogContent className="max-w-[90vw] w-auto max-h-[90vh] p-4 flex items-center justify-center bg-black/90 border-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Image preview</DialogTitle>
          </DialogHeader>
          {phrasePreviewUrl && (
            <img
              src={phrasePreviewUrl}
              alt="Preview"
              className="max-h-[85vh] max-w-full w-auto object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
