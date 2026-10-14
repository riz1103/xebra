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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ChevronDown,
  ChevronRight,
  Layers,
  GripVertical,
  MoreVertical,
  Sparkles,
} from "lucide-react";
import {
  GenerateFromMaterialDialog,
  type GeneratedExamApplication,
} from "@/components/exam-generator/generate-from-material-dialog";
import { QuestionSource } from "@/components/exam-generator/question-source";
import { SourceViewableSwitch } from "@/components/exams/source-viewable-switch";
import { AnswerRevealSelect } from "@/components/exams/answer-reveal-select";
import { buildExamInstruction } from "@/lib/exam-blueprint";
import Link from "next/link";
import { parseBlanks } from "@/lib/question-blanks";
import type { CreateExamQuestionPayload, ExamPart } from "@/types";
import {
  genPartPhraseId,
  genSectionId,
  toExamPartPayload,
  type PartPhrase,
  type QuestionSection,
} from "@/lib/exam-sections";
import { examOriginFor, saveSectionsToExam, sectionQuestions } from "@/lib/exam-save";

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
  hideRemoveButton = false,
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
  /** When true, the card header does not show a delete button (parent list row already has one). */
  hideRemoveButton?: boolean;
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
      className={`rounded-lg border p-5 space-y-5 ${
        needsAnswer ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="font-medium text-sm truncate">{questionLabel}</h4>
          {needsAnswer && (
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mr-1 h-2.5 w-2.5" /> Needs answer
            </Badge>
          )}
        </div>
        {!hideRemoveButton && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Question Text *</Label>
          <Textarea
            value={q.questionText}
            onChange={(e) => updateQuestion("questionText", e.target.value)}
            placeholder="Enter your question..."
            rows={3}
            className="min-h-[6rem] resize-y"
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
          <Separator className="my-4" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Options</Label>
              {layoutConfig.editableOptions && (
                <Button type="button" variant="ghost" size="sm" onClick={addOption}>
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              )}
            </div>
            <div className="space-y-2">
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
      <Separator />
      <div className="space-y-3">
        {q.metadata?.ai && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Sparkles className="h-2.5 w-2.5" /> AI generated
            </Badge>
            {q.metadata.ai.difficulty && (
              <Badge variant="outline" className="text-[10px] capitalize">{q.metadata.ai.difficulty}</Badge>
            )}
            {q.metadata.ai.topic && <Badge variant="outline" className="text-[10px]">{q.metadata.ai.topic}</Badge>}
            <QuestionSource source={q.metadata.ai} />
          </div>
        )}
        <div className="space-y-2">
          <Label>Explanation (proctors only)</Label>
          <Textarea
            value={q.explanation ?? ""}
            onChange={(e) => updateQuestion("explanation", e.target.value)}
            placeholder="Why the correct answer is correct. Never shown to examinees during the exam."
            rows={2}
            className="resize-y"
          />
        </div>
        {layoutConfig.layout === "essay" && q.metadata?.ai && (
          <div className="space-y-2">
            <Label>Grading rubric (proctors only)</Label>
            <Textarea
              value={q.metadata.ai.rubric ?? ""}
              onChange={(e) =>
                setQuestion({ ...q, metadata: { ...q.metadata, ai: { ...q.metadata!.ai!, rubric: e.target.value } } })
              }
              rows={3}
              className="resize-y"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreateExamPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sections, setSections] = useState<QuestionSection[]>([]);
  /** Collapsed section or nested phrase ids (when present, that block is collapsed). Default expanded. */
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  /** Collapsed question ids (composite keys). Default expanded. */
  const [questionCollapsedIds, setQuestionCollapsedIds] = useState<Set<string>>(new Set());
  const [passingConditionType, setPassingConditionType] = useState<"whole_exam" | "per_part">("whole_exam");

  /** Parts are derived from part-type sections (no separate Exam Parts card). */
  const parts = sections
    .filter((s): s is QuestionSection & { type: "part" } => s.type === "part")
    .map((s) => s.part);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const phraseImageInputRef = useRef<HTMLInputElement>(null);
  const phraseImageTargetRef = useRef<{ sectionId: string; phraseId?: string } | null>(null);
  const [phrasePreviewUrl, setPhrasePreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<ParseResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [recentDropId, setRecentDropId] = useState<string | null>(null);
  type ConfirmRemove =
    | { type: "section"; sectionId: string }
    | { type: "part"; sectionId: string }
    | { type: "phrase-under-part"; sectionId: string; phraseId: string }
    | { type: "question-phrase"; sectionId: string; qIndex: number }
    | { type: "question-part"; sectionId: string; qIndex: number }
    | { type: "question-part-phrase"; sectionId: string; phraseId: string; qIndex: number };
  const [confirmRemove, setConfirmRemove] = useState<ConfirmRemove | null>(null);

  useEffect(() => {
    const endDrag = () => {
      requestAnimationFrame(() => setIsDragging(false));
    };
    window.addEventListener("dragend", endDrag);
    return () => {
      window.removeEventListener("dragend", endDrag);
    };
  }, []);

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
      sourceViewableByExaminee: false,
      answerRevealTiming: "always",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { values: ExamFormValues; sections: QuestionSection[] }) => {
      const { values, sections: secs } = payload;

      const partsFromSections = secs
        .filter((s): s is QuestionSection & { type: "part" } => s.type === "part")
        .map((s) => s.part);
      let finalTimeLimit = values.timeLimit;
      if (values.timeType === "per_part" && partsFromSections.length > 0) {
        finalTimeLimit = partsFromSections.reduce((sum, part) => sum + (part.timeLimit || 0), 0);
      }
      let finalPassingCondition = values.passingCondition;
      const finalParts =
        partsFromSections.length > 0
          ? partsFromSections.map((p) => toExamPartPayload(p, values.timeType, passingConditionType === "per_part"))
          : null;
      if (passingConditionType === "per_part") {
        finalPassingCondition = { type: "percentage" as const, value: 0 };
      }

      const examRes = await api.createExam({
        ...values,
        instruction: values.instruction || null,
        parts: finalParts,
        passingCondition: finalPassingCondition,
        timeLimit: finalTimeLimit,
        sourceViewableByExaminee: !!(values.reviewableByExaminee && values.sourceViewableByExaminee),
        origin: examOriginFor(sectionQuestions(secs)),
        questions: [], // We add questions (and phrases) below
      });
      const examId = (examRes?.data as { id?: string })?.id;
      if (!examId) throw new Error("Exam created but no ID returned");

      try {
        await saveSectionsToExam(examId, secs, questionTypes);
      } catch (err) {
        // Don't leave a half-filled exam behind; retrying would otherwise create duplicates
        const removed = await api.deleteExam(examId).then(() => true, () => false);
        const reason = err instanceof Error ? err.message : "unknown error";
        throw new Error(
          removed
            ? `Couldn't save the questions (${reason}). The exam was not created; your questions are still here.`
            : `Couldn't save the questions (${reason}). A partial draft "${values.title}" was created; delete it from Exams before retrying.`
        );
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
  const allQuestions = sections.flatMap((s) => {
    if (s.type === "standalone") return [s.question];
    if (s.type === "phrase") return s.questions;
    if (s.type === "part") {
      const direct = s.questions;
      const fromPhrases = s.phrases.flatMap((p) => p.questions);
      return [...direct, ...fromPhrases];
    }
    return [];
  });

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

  const addPhraseImages = (sectionId: string, files: File[], phraseId?: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (phraseId) {
          if (s.type !== "part" || s.id !== sectionId) return s;
          const phrase = s.phrases.find((p) => p.id === phraseId);
          if (!phrase) return s;
          const total = [...phrase.imageFiles, ...files].reduce((sum, f) => sum + f.size, 0);
          if (total > MAX_PHRASE_IMAGES_BYTES) {
            toast.error("Total images for this passage must be 10 MB or less.");
            return s;
          }
          return {
            ...s,
            phrases: s.phrases.map((p) =>
              p.id === phraseId ? { ...p, imageFiles: [...p.imageFiles, ...files] } : p
            ),
          };
        }
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

  const removePhraseImage = (sectionId: string, index: number, phraseId?: string) => {
    setPhrasePreviewUrl(null);
    setSections((prev) =>
      prev.map((s) => {
        if (phraseId) {
          if (s.type !== "part" || s.id !== sectionId) return s;
          return {
            ...s,
            phrases: s.phrases.map((p) =>
              p.id === phraseId ? { ...p, imageFiles: p.imageFiles.filter((_, i) => i !== index) } : p
            ),
          };
        }
        return s.type === "phrase" && s.id === sectionId
          ? { ...s, imageFiles: s.imageFiles.filter((_, i) => i !== index) }
          : s;
      })
    );
  };

  const openPhraseImagePicker = (sectionId: string, phraseId?: string) => {
    phraseImageTargetRef.current = { sectionId, phraseId };
    phraseImageInputRef.current?.click();
  };

  const onPhraseImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = phraseImageTargetRef.current;
    if (!target) return;
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addPhraseImages(target.sectionId, files, target.phraseId);
    phraseImageTargetRef.current = null;
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

  const addQuestionUnderPart = (sectionId: string) => {
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
        s.type === "part" && s.id === sectionId
          ? { ...s, questions: [...s.questions, newQ] }
          : s
      )
    );
  };

  const addPhraseUnderPart = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.type === "part" && s.id === sectionId
          ? {
              ...s,
              phrases: [
                ...s.phrases,
                {
                  id: genPartPhraseId(),
                  phrase: { title: "", body: "", usageType: "passage" },
                  imageFiles: [],
                  questions: [],
                },
              ],
            }
          : s
      )
    );
  };

  const updatePartPhrase = (sectionId: string, phraseId: string, phrase: { title: string; body: string; usageType?: string }) => {
    setSections((prev) =>
      prev.map((s) =>
        s.type === "part" && s.id === sectionId
          ? {
              ...s,
              phrases: s.phrases.map((p) => (p.id === phraseId ? { ...p, phrase } : p)),
            }
          : s
      )
    );
  };

  const removePhraseUnderPart = (sectionId: string, phraseId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.type === "part" && s.id === sectionId
          ? { ...s, phrases: s.phrases.filter((p) => p.id !== phraseId) }
          : s
      )
    );
  };

  const addQuestionUnderPartPhrase = (sectionId: string, phraseId: string) => {
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
      prev.map((s) => {
        if (s.type !== "part" || s.id !== sectionId) return s;
        return {
          ...s,
          phrases: s.phrases.map((p) =>
            p.id === phraseId ? { ...p, questions: [...p.questions, newQ] } : p
          ),
        };
      })
    );
  };

  const removeQuestionUnderPart = (sectionId: string, qIndex: number) => {
    setSections((prev) =>
      prev.map((s) =>
        s.type === "part" && s.id === sectionId
          ? { ...s, questions: s.questions.filter((_, i) => i !== qIndex) }
          : s
      )
    );
  };

  const removeQuestionUnderPartPhrase = (sectionId: string, phraseId: string, qIndex: number) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.type !== "part" || s.id !== sectionId) return s;
        return {
          ...s,
          phrases: s.phrases.map((p) =>
            p.id === phraseId ? { ...p, questions: p.questions.filter((_, i) => i !== qIndex) } : p
          ),
        };
      })
    );
  };

  const setQuestionUnderPart = (sectionId: string, qIndex: number, q: CreateExamQuestionPayload) => {
    setSections((prev) =>
      prev.map((s) =>
        s.type === "part" && s.id === sectionId
          ? { ...s, questions: s.questions.map((prevQ, i) => (i === qIndex ? q : prevQ)) }
          : s
      )
    );
  };

  const setQuestionUnderPartPhrase = (sectionId: string, phraseId: string, qIndex: number, q: CreateExamQuestionPayload) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.type !== "part" || s.id !== sectionId) return s;
        return {
          ...s,
          phrases: s.phrases.map((p) =>
            p.id === phraseId
              ? { ...p, questions: p.questions.map((prevQ, i) => (i === qIndex ? q : prevQ)) }
              : p
          ),
        };
      })
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
      ];
      const validExtensions = [".pdf", ".docx"];
      const hasValidExtension = validExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );

      if (!validTypes.includes(file.type) && !hasValidExtension) {
        toast.error(
          file.name.toLowerCase().endsWith(".doc")
            ? "Legacy Word (.doc) files aren't supported. Save the file as .docx and try again."
            : "Please upload a PDF or Word document (.pdf, .docx). For photos or slides, use \"Generate from material\"."
        );
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

        const defaultTypeId = questionTypes[0]?.id || "";
        const payloads = parsedToPayload(
          result.questions,
          defaultTypeId,
          questionTypes,
          result.sections
        );
        const normalizedQuestions = payloads.map((q, i) => {
          const sectionIndex = result.questions[i].sectionIndex;
          const partId =
            sectionIndex !== undefined &&
            sectionIndex >= 0 &&
            result.sections?.[sectionIndex]
              ? null // will be assigned via part section
              : null;
          let out = { ...q, examId: "", partId: partId ?? undefined };
          // Ensure options match the selected question type (e.g. True/False from section hint but parser had no options)
          const typeName = getTypeName(out.questionTypeId);
          const layout = getLayoutConfig(typeName);
          const needsDefaultOptions =
            layout.defaultOptions.length > 0 &&
            (out.options.length === 0 ||
              (layout.layout === "true_false" &&
                (out.options.length !== 2 ||
                  out.options.join(" ").toLowerCase() !== "true false")));
          if (needsDefaultOptions) {
            out = { ...out, options: [...layout.defaultOptions], numberOfChoices: layout.defaultOptions.length };
          }
          if (typeof out.correctAnswer === "string" && out.correctAnswer) {
            const ans = (out.correctAnswer as string).trim();
            const idx = out.options.findIndex((o) => o.trim().toLowerCase() === ans.toLowerCase());
            out = { ...out, correctAnswer: idx >= 0 ? [String(idx)] : [] };
          } else if (Array.isArray(out.correctAnswer)) {
            out = {
              ...out,
              correctAnswer: (out.correctAnswer as string[])
                .map((ans) => {
                  const i = out.options.findIndex((o) => o.trim().toLowerCase() === String(ans).trim().toLowerCase());
                  return i >= 0 ? String(i) : "-1";
                })
                .filter((idx) => idx !== "-1"),
            };
          } else {
            out = { ...out, correctAnswer: [] };
          }
          return {
            ...out,
            _sectionIndex: sectionIndex,
            _questionNumber: result.questions[i].questionNumber,
          } as typeof out & { _sectionIndex?: number; _questionNumber?: number };
        });

        const stripMeta = (q: CreateExamQuestionPayload & { _sectionIndex?: number; _questionNumber?: number }) => {
          const { _sectionIndex: _s, _questionNumber: _n, ...rest } = q;
          return rest;
        };

        const passageQuestionNumbers = new Set<number>();
        if (result.passages?.length) {
          for (const p of result.passages) {
            p.questionNumbers.forEach((n) => passageQuestionNumbers.add(n));
          }
        }

        const inPassage = (q: { _questionNumber?: number }) =>
          q._questionNumber != null && passageQuestionNumbers.has(q._questionNumber);
        const remainingQuestions = normalizedQuestions.filter((q) => !inPassage(q));

        const phraseSectionsFromPassages: QuestionSection[] = (result.passages ?? []).map((passage) => ({
          id: genSectionId(),
          type: "phrase" as const,
          phrase: {
            title: passage.title ?? "",
            body: passage.body,
            usageType: "passage",
          },
          imageFiles: [],
          questions: normalizedQuestions
            .filter((q) => q._questionNumber != null && passage.questionNumbers.includes(q._questionNumber))
            .map((q) => stripMeta(q as CreateExamQuestionPayload & { _sectionIndex?: number; _questionNumber?: number })),
        }));

        if (result.sections?.length > 0) {
          const newPartSections: QuestionSection[] = result.sections.map((sec, secIdx) => {
            const part: ExamPart = {
              id: generatePartId(),
              name: sec.name,
              description: "",
              numberOfItems: null,
              timeLimit: null,
              passingCondition: null,
            };
            const questionsUnderPart = remainingQuestions
              .filter((q) => (q as { _sectionIndex?: number })._sectionIndex === secIdx)
              .map((q) => stripMeta(q as CreateExamQuestionPayload & { _sectionIndex?: number; _questionNumber?: number }));
            return {
              id: genSectionId(),
              type: "part" as const,
              part,
              questions: questionsUnderPart,
              phrases: [],
            };
          });
          const standaloneFromUpload = remainingQuestions
            .filter((q) => (q as { _sectionIndex?: number })._sectionIndex === undefined || (q as { _sectionIndex?: number })._sectionIndex! < 0)
            .map((q) => stripMeta(q as CreateExamQuestionPayload & { _sectionIndex?: number; _questionNumber?: number }));
          setSections((prev) => [
            ...prev,
            ...phraseSectionsFromPassages,
            ...newPartSections,
            ...standaloneFromUpload.map((q) => ({
              id: genSectionId(),
              type: "standalone" as const,
              question: q,
            })),
          ]);
        } else {
          const standaloneFromRemaining = remainingQuestions.map((q) =>
            stripMeta(q as CreateExamQuestionPayload & { _sectionIndex?: number; _questionNumber?: number })
          );
          setSections((prev) => [
            ...prev,
            ...phraseSectionsFromPassages,
            ...standaloneFromRemaining.map((q) => ({
              id: genSectionId(),
              type: "standalone" as const,
              question: q,
            })),
          ]);
        }

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

  /** Adds AI-generated sections; exam settings are only filled in when the exam has no questions yet. */
  const handleGeneratedExam = ({ applied, blueprint, analysis }: GeneratedExamApplication) => {
    const questionCount = applied.sections.reduce((sum, s) => {
      if (s.type === "standalone") return sum + 1;
      if (s.type === "phrase") return sum + s.questions.length;
      return sum + s.questions.length + s.phrases.reduce((n, p) => n + p.questions.length, 0);
    }, 0);
    const hadQuestions = sections.length > 0;
    setSections((prev) => [...prev, ...applied.sections]);

    if (!form.getValues("title")?.trim()) form.setValue("title", blueprint.title.slice(0, 200));
    if (!form.getValues("description")?.trim()) form.setValue("description", analysis.summary.slice(0, 1000));
    if (!hadQuestions) {
      if (!form.getValues("instruction")?.trim()) {
        form.setValue("instruction", buildExamInstruction(blueprint, applied.timeLimit));
      }
      form.setValue("questionOrder", blueprint.questionOrder);
      form.setValue("timeType", applied.timeType);
      form.setValue("timeLimit", applied.timeLimit);
      form.setValue("numberOfItems", applied.numberOfItems ?? undefined);
      form.setValue("passingCondition", { type: "percentage", value: blueprint.passingPercentage });
      form.setValue("reviewableByExaminee", blueprint.reviewableByExaminee);
      setPassingConditionType("whole_exam");
    }
    toast.success(
      hadQuestions
        ? `Added ${questionCount} generated question(s). Existing exam settings were kept.`
        : `Added ${questionCount} generated question(s) and filled in the exam settings. Review them before saving.`
    );
  };

  const clearScanResult = () => {
    setScanResult(null);
    setScanError(null);
    setUploadedFileName(null);
    setScanProgress(0);
  };

  const generatePartId = () => {
    return `part_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const toggleCollapsed = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleQuestionCollapsed = (key: string) => {
    setQuestionCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setCollapsedIds(new Set());
    setQuestionCollapsedIds(new Set());
  };

  const collapseAll = () => {
    const sectionIds = new Set<string>();
    const questionKeys = new Set<string>();
    sections.forEach((s) => {
      sectionIds.add(s.id);
      if (s.type === "part") s.phrases.forEach((p) => sectionIds.add(p.id));
      if (s.type === "standalone") questionKeys.add(`standalone-${s.id}`);
      if (s.type === "phrase") s.questions.forEach((_, qIdx) => questionKeys.add(`ph-q-${s.id}-${qIdx}`));
      if (s.type === "part") {
        s.questions.forEach((_, qIdx) => questionKeys.add(`part-q-${s.id}-${qIdx}`));
        s.phrases.forEach((p) => p.questions.forEach((_, qIdx) => questionKeys.add(`part-ph-q-${s.id}-${p.id}-${qIdx}`)));
      }
    });
    setCollapsedIds(sectionIds);
    setQuestionCollapsedIds(questionKeys);
  };

  const expandPhraseQuestions = (phraseSectionId: string) => {
    const sec = sections.find((s) => s.id === phraseSectionId);
    if (sec?.type !== "phrase") return;
    setQuestionCollapsedIds((prev) => {
      const next = new Set(prev);
      sec.questions.forEach((_, qIdx) => next.delete(`ph-q-${phraseSectionId}-${qIdx}`));
      return next;
    });
  };

  const collapsePhraseQuestions = (phraseSectionId: string) => {
    const sec = sections.find((s) => s.id === phraseSectionId);
    if (sec?.type !== "phrase") return;
    setQuestionCollapsedIds((prev) => {
      const next = new Set(prev);
      sec.questions.forEach((_, qIdx) => next.add(`ph-q-${phraseSectionId}-${qIdx}`));
      return next;
    });
  };

  const expandPartContent = (partSectionId: string) => {
    const sec = sections.find((s) => s.id === partSectionId);
    if (sec?.type !== "part") return;
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      sec.phrases.forEach((p) => next.delete(p.id));
      return next;
    });
    setQuestionCollapsedIds((prev) => {
      const next = new Set(prev);
      sec.questions.forEach((_, qIdx) => next.delete(`part-q-${partSectionId}-${qIdx}`));
      sec.phrases.forEach((p) => p.questions.forEach((_, qIdx) => next.delete(`part-ph-q-${partSectionId}-${p.id}-${qIdx}`)));
      return next;
    });
  };

  const collapsePartContent = (partSectionId: string) => {
    const sec = sections.find((s) => s.id === partSectionId);
    if (sec?.type !== "part") return;
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      sec.phrases.forEach((p) => next.add(p.id));
      return next;
    });
    setQuestionCollapsedIds((prev) => {
      const next = new Set(prev);
      sec.questions.forEach((_, qIdx) => next.add(`part-q-${partSectionId}-${qIdx}`));
      sec.phrases.forEach((p) => p.questions.forEach((_, qIdx) => next.add(`part-ph-q-${partSectionId}-${p.id}-${qIdx}`)));
      return next;
    });
  };

  const expandPartPhraseQuestions = (partSectionId: string, phraseId: string) => {
    setQuestionCollapsedIds((prev) => {
      const next = new Set(prev);
      const sec = sections.find((s) => s.id === partSectionId);
      if (sec?.type === "part") {
        const ph = sec.phrases.find((p) => p.id === phraseId);
        ph?.questions.forEach((_, qIdx) => next.delete(`part-ph-q-${partSectionId}-${phraseId}-${qIdx}`));
      }
      return next;
    });
  };

  const collapsePartPhraseQuestions = (partSectionId: string, phraseId: string) => {
    setQuestionCollapsedIds((prev) => {
      const next = new Set(prev);
      const sec = sections.find((s) => s.id === partSectionId);
      if (sec?.type === "part") {
        const ph = sec.phrases.find((p) => p.id === phraseId);
        ph?.questions.forEach((_, qIdx) => next.add(`part-ph-q-${partSectionId}-${phraseId}-${qIdx}`));
      }
      return next;
    });
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
    setSections((prev) => [
      ...prev,
      {
        id: genSectionId(),
        type: "part",
        part: newPart,
        questions: [],
        phrases: [],
      },
    ]);
  };

  const updatePartInSection = (sectionId: string, updatedPart: ExamPart) => {
    setSections((prev) =>
      prev.map((s) =>
        s.type === "part" && s.id === sectionId ? { ...s, part: updatedPart } : s
      )
    );
  };

  const removePartSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const confirmRemoveAndClose = () => {
    if (!confirmRemove) return;
    switch (confirmRemove.type) {
      case "section":
        removeSection(confirmRemove.sectionId);
        break;
      case "part":
        removePartSection(confirmRemove.sectionId);
        break;
      case "phrase-under-part":
        removePhraseUnderPart(confirmRemove.sectionId, confirmRemove.phraseId);
        break;
      case "question-phrase":
        removeQuestionUnderPhrase(confirmRemove.sectionId, confirmRemove.qIndex);
        break;
      case "question-part":
        removeQuestionUnderPart(confirmRemove.sectionId, confirmRemove.qIndex);
        break;
      case "question-part-phrase":
        removeQuestionUnderPartPhrase(confirmRemove.sectionId, confirmRemove.phraseId, confirmRemove.qIndex);
        break;
    }
    setConfirmRemove(null);
  };

  const getConfirmRemoveMessage = () => {
    if (!confirmRemove) return { title: "", description: "" };
    switch (confirmRemove.type) {
      case "section": {
        const sec = sections.find((s) => s.id === confirmRemove.sectionId);
        if (sec?.type === "standalone") return { title: "Remove question?", description: "This question will be removed. This cannot be undone." };
        return { title: "Remove passage?", description: "This passage and all its questions will be removed. This cannot be undone." };
      }
      case "part":
        return { title: "Remove part?", description: "This part and all its questions and passages will be removed. This cannot be undone." };
      case "phrase-under-part":
        return { title: "Remove passage?", description: "This passage and all its questions will be removed from the part. This cannot be undone." };
      case "question-phrase":
      case "question-part":
      case "question-part-phrase":
        return { title: "Remove question?", description: "This question will be removed. This cannot be undone." };
      default:
        return { title: "", description: "" };
    }
  };

  const DRAG_TYPE = "application/xevra-exam-dnd";

  type DragPayload =
    | { t: "section"; sectionId: string }
    | { t: "question-standalone"; sectionId: string }
    | { t: "question-phrase"; sectionId: string; questionIndex: number }
    | { t: "question-part"; sectionId: string; questionIndex: number }
    | { t: "question-part-phrase"; sectionId: string; phraseId: string; questionIndex: number }
    | { t: "phrase"; sectionId: string }
    | { t: "phrase-under-part"; sectionId: string; phraseIndex: number };

  type DropTarget =
    | { t: "section"; sectionIndex: number }
    | { t: "part-questions"; sectionId: string; partSectionId: string; questionIndex?: number }
    | { t: "part-phrase-questions"; partSectionId: string; phraseId: string; questionIndex?: number }
    | { t: "phrase-questions"; sectionId: string; questionIndex?: number }
    | { t: "part-phrases"; partSectionId: string; phraseIndex?: number };

  const getSectionIndex = (sectionId: string) => sections.findIndex((s) => s.id === sectionId);

  const reorderSections = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setSections((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
      next.splice(insertAt, 0, removed);
      return next;
    });
  };

  const moveSectionToIndex = (sectionId: string, toIndex: number) => {
    const fromIndex = getSectionIndex(sectionId);
    if (fromIndex === -1) return;
    reorderSections(fromIndex, toIndex);
  };

  const getQuestionFromPayload = (p: DragPayload): CreateExamQuestionPayload | null => {
    if (p.t === "question-standalone") {
      const s = sections.find((x) => x.id === p.sectionId);
      return s?.type === "standalone" ? s.question : null;
    }
    if (p.t === "question-phrase") {
      const s = sections.find((x) => x.id === p.sectionId);
      if (s?.type !== "phrase") return null;
      return s.questions[p.questionIndex] ?? null;
    }
    if (p.t === "question-part") {
      const s = sections.find((x) => x.id === p.sectionId);
      if (s?.type !== "part") return null;
      return s.questions[p.questionIndex] ?? null;
    }
    if (p.t === "question-part-phrase") {
      const s = sections.find((x) => x.id === p.sectionId);
      if (s?.type !== "part") return null;
      const ph = s.phrases.find((x) => x.id === p.phraseId);
      return ph?.questions[p.questionIndex] ?? null;
    }
    return null;
  };

  const removeQuestionFromPayload = (p: DragPayload): boolean => {
    if (p.t === "question-standalone") {
      setSections((prev) => prev.filter((s) => s.id !== p.sectionId));
      return true;
    }
    if (p.t === "question-phrase") {
      setSections((prev) =>
        prev.map((s) =>
          s.type === "phrase" && s.id === p.sectionId
            ? { ...s, questions: s.questions.filter((_, i) => i !== p.questionIndex) }
            : s
        )
      );
      return true;
    }
    if (p.t === "question-part") {
      setSections((prev) =>
        prev.map((s) =>
          s.type === "part" && s.id === p.sectionId
            ? { ...s, questions: s.questions.filter((_, i) => i !== p.questionIndex) }
            : s
        )
      );
      return true;
    }
    if (p.t === "question-part-phrase") {
      setSections((prev) =>
        prev.map((s) => {
          if (s.type !== "part" || s.id !== p.sectionId) return s;
          return {
            ...s,
            phrases: s.phrases.map((ph) =>
              ph.id === p.phraseId
                ? { ...ph, questions: ph.questions.filter((_, i) => i !== p.questionIndex) }
                : ph
            ),
          };
        })
      );
      return true;
    }
    return false;
  };

  const handleDrop = (dragPayload: DragPayload, dropTarget: DropTarget) => {
    if (dropTarget.t === "section") {
      if (dragPayload.t === "section") {
        const fromIdx = getSectionIndex(dragPayload.sectionId);
        if (fromIdx !== -1) reorderSections(fromIdx, dropTarget.sectionIndex);
        return;
      }
      if (dragPayload.t === "phrase") {
        const sec = sections.find((s) => s.id === dragPayload.sectionId);
        if (sec?.type !== "phrase") return;
        setSections((prev) => {
          const next = prev.filter((s) => s.id !== dragPayload.sectionId);
          next.splice(dropTarget.sectionIndex, 0, sec);
          return next;
        });
        return;
      }
      // Dropping a question onto a section slot: move it out of phrase/part into a new standalone section
      const question = getQuestionFromPayload(dragPayload);
      if (question) {
        setSections((prev) => {
          const afterRemoval = prev.map((s) => {
            if (dragPayload.t === "question-standalone" && s.id === dragPayload.sectionId) return null;
            if (dragPayload.t === "question-phrase" && s.type === "phrase" && s.id === dragPayload.sectionId)
              return { ...s, questions: s.questions.filter((_, i) => i !== dragPayload.questionIndex) };
            if (dragPayload.t === "question-part" && s.type === "part" && s.id === dragPayload.sectionId)
              return { ...s, questions: s.questions.filter((_, i) => i !== dragPayload.questionIndex) };
            if (dragPayload.t === "question-part-phrase" && s.type === "part" && s.id === dragPayload.sectionId)
              return {
                ...s,
                phrases: s.phrases.map((ph) =>
                  ph.id === dragPayload.phraseId
                    ? { ...ph, questions: ph.questions.filter((_, i) => i !== dragPayload.questionIndex) }
                    : ph
                ),
              };
            return s;
          });
          const next = afterRemoval.filter((s): s is QuestionSection => s !== null);
          const newSection: QuestionSection = {
            id: genSectionId(),
            type: "standalone",
            question,
          };
          next.splice(dropTarget.sectionIndex, 0, newSection);
          return next;
        });
      }
      return;
    }
    const question = getQuestionFromPayload(dragPayload);
    if (question && (dropTarget.t === "part-questions" || dropTarget.t === "phrase-questions" || dropTarget.t === "part-phrase-questions")) {
      removeQuestionFromPayload(dragPayload);
      if (dropTarget.t === "part-questions") {
        setSections((prev) =>
          prev.map((s) => {
            if (s.type !== "part" || s.id !== dropTarget.partSectionId) return s;
            const list = s.questions;
            let insertIdx = dropTarget.questionIndex ?? list.length;
            if (dragPayload.t === "question-part" && dragPayload.sectionId === dropTarget.partSectionId && dragPayload.questionIndex !== undefined && (dropTarget.questionIndex ?? list.length) > dragPayload.questionIndex) insertIdx = Math.max(0, insertIdx - 1);
            const next = [...list];
            next.splice(insertIdx, 0, question);
            return { ...s, questions: next };
          })
        );
      } else if (dropTarget.t === "phrase-questions") {
        setSections((prev) =>
          prev.map((s) => {
            if (s.type !== "phrase" || s.id !== dropTarget.sectionId) return s;
            const list = s.questions;
            let insertIdx = dropTarget.questionIndex ?? list.length;
            if (dragPayload.t === "question-phrase" && dragPayload.sectionId === dropTarget.sectionId && dragPayload.questionIndex !== undefined && (dropTarget.questionIndex ?? list.length) > dragPayload.questionIndex) insertIdx = Math.max(0, insertIdx - 1);
            const next = [...list];
            next.splice(insertIdx, 0, question);
            return { ...s, questions: next };
          })
        );
      } else if (dropTarget.t === "part-phrase-questions") {
        setSections((prev) =>
          prev.map((s) => {
            if (s.type !== "part" || s.id !== dropTarget.partSectionId) return s;
            return {
              ...s,
              phrases: s.phrases.map((ph) => {
                if (ph.id !== dropTarget.phraseId) return ph;
                const list = ph.questions;
                let insertIdx = dropTarget.questionIndex ?? list.length;
                if (dragPayload.t === "question-part-phrase" && dragPayload.sectionId === dropTarget.partSectionId && dragPayload.phraseId === dropTarget.phraseId && dragPayload.questionIndex !== undefined && (dropTarget.questionIndex ?? list.length) > dragPayload.questionIndex) insertIdx = Math.max(0, insertIdx - 1);
                const next = [...list];
                next.splice(insertIdx, 0, question);
                return { ...ph, questions: next };
              }),
            };
          })
        );
      }
      return;
    }
    if (dragPayload.t === "phrase-under-part" && dropTarget.t === "part-phrases") {
      const partSec = sections.find((s) => s.type === "part" && s.id === dragPayload.sectionId);
      if (partSec?.type !== "part") return;
      const phrase = partSec.phrases[dragPayload.phraseIndex];
      if (!phrase) return;
      setSections((prev) =>
        prev.map((s) => {
          if (s.type !== "part" || s.id !== dragPayload.sectionId) return s;
          const newPhrases = s.phrases.filter((_, i) => i !== dragPayload.phraseIndex);
          return { ...s, phrases: newPhrases };
        })
      );
      setSections((prev) =>
        prev.map((s) => {
          if (s.type !== "part" || s.id !== dropTarget.partSectionId) return s;
          const toIdx = dropTarget.phraseIndex ?? s.phrases.length;
          const next = [...s.phrases];
          next.splice(toIdx, 0, phrase);
          return { ...s, phrases: next };
        })
      );
      return;
    }
  };

  const handleDragStart = (e: React.DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
    requestAnimationFrame(() => setIsDragging(true));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnSectionList = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      handleDrop(payload, { t: "section", sectionIndex: dropIndex });
      setRecentDropId(`section-${dropIndex}`);
      setTimeout(() => setRecentDropId(null), 500);
    } catch {
      // ignore
    }
  };

  const handleQuestionDrop = (e: React.DragEvent, dropTarget: DropTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      if (payload.t !== "section" && payload.t !== "phrase" && payload.t !== "phrase-under-part") {
        handleDrop(payload, dropTarget);
        setRecentDropId(JSON.stringify(dropTarget));
        setTimeout(() => setRecentDropId(null), 500);
      }
    } catch {
      // ignore
    }
  };

  const DROP_ZONE_LABEL = "Drop questions here";

  const getQuestionDropZoneId = (t: DropTarget) => JSON.stringify(t);

  const QuestionDropZone = ({ dropTarget, label, className = "" }: { dropTarget: DropTarget; label?: string; className?: string }) => {
    const dropId = getQuestionDropZoneId(dropTarget);
    const isVisible = isDragging || recentDropId === dropId;
    const justLanded = recentDropId === dropId;
    return (
      <div
        className={`rounded-md border-2 border-dashed transition-all duration-200 ease-in-out w-full min-w-0 max-w-full ${
          isVisible
            ? "min-h-10 py-2 border-primary/40 bg-primary/5 opacity-100 overflow-hidden"
            : "min-h-0 h-0 py-0 border-transparent bg-transparent opacity-0 overflow-hidden"
        } ${justLanded ? "animate-drop-landed bg-primary/10 border-primary" : ""} ${className}`}
        onDragOver={handleDragOver}
        onDragEnter={(e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = "hsl(var(--primary))";
          e.currentTarget.style.backgroundColor = "hsl(var(--primary) / 0.12)";
          e.currentTarget.style.transform = "scaleY(1.1)";
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          e.currentTarget.style.borderColor = "";
          e.currentTarget.style.backgroundColor = "";
          e.currentTarget.style.transform = "";
        }}
        onDrop={(e) => {
          e.currentTarget.style.borderColor = "";
          e.currentTarget.style.backgroundColor = "";
          e.currentTarget.style.transform = "";
          handleQuestionDrop(e, dropTarget);
        }}
      >
        {label !== undefined && (
          <span className={`text-xs px-3 block text-center transition-opacity duration-200 truncate ${isVisible ? "text-primary/60 opacity-100" : "opacity-0"}`}>
            {label}
          </span>
        )}
      </div>
    );
  };

  const getQuestionCountForPart = (partId: string) => {
    const partSec = sections.find((s) => s.type === "part" && s.part.id === partId);
    if (!partSec || partSec.type !== "part") return 0;
    const direct = partSec.questions.length;
    const fromPhrases = partSec.phrases.reduce((sum, p) => sum + p.questions.length, 0);
    return direct + fromPhrases;
  };

  const onSubmit = (values: ExamFormValues) => {
    const layoutMap = new Map(
      questionTypes.map((qt) => [qt.id, getLayoutConfig(qt.name)])
    );
    const allQuestions: { q: CreateExamQuestionPayload; label: string }[] = [];
    sections.forEach((sec, si) => {
      if (sec.type === "standalone") {
        allQuestions.push({ q: sec.question, label: `Question ${si + 1}` });
      } else if (sec.type === "phrase") {
        sec.questions.forEach((q, qi) => {
          allQuestions.push({
            q,
            label: `Section ${si + 1} (passage), question ${qi + 1}`,
          });
        });
      } else if (sec.type === "part") {
        sec.questions.forEach((q, qi) => {
          allQuestions.push({ q, label: `Part "${sec.part.name}", question ${qi + 1}` });
        });
        sec.phrases.forEach((p, pi) => {
          p.questions.forEach((q, qi) => {
            allQuestions.push({
              q,
              label: `Part "${sec.part.name}", passage ${pi + 1}, question ${qi + 1}`,
            });
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
                Add parts in the Questions section to set per-part passing conditions. Each part can have its own passing requirement.
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
                  When on, examinees can open &quot;View my answers&quot; after submitting to see questions, correct answers, and explanations.
                </p>
              </div>
            </div>
            <SourceViewableSwitch
              checked={form.watch("sourceViewableByExaminee") ?? false}
              onCheckedChange={(v) => form.setValue("sourceViewableByExaminee", v)}
              reviewable={form.watch("reviewableByExaminee") ?? false}
            />
            <AnswerRevealSelect
              value={form.watch("answerRevealTiming") ?? "always"}
              onValueChange={(v) => form.setValue("answerRevealTiming", v)}
              reviewable={form.watch("reviewableByExaminee") ?? false}
            />
          </CardContent>
        </Card>

        {/* Questions */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Questions</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setGenerateDialogOpen(true)}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate from material
                </Button>
                <Button type="button" variant="default" size="sm" onClick={addQuestion}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add question
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="More actions">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setGenerateDialogOpen(true)}>
                      <Sparkles className="mr-2 h-4 w-4" /> Generate from material (AI)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
                      <Upload className="mr-2 h-4 w-4" /> Upload exam file
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={addPhrase}>
                      <BookOpen className="mr-2 h-4 w-4" /> Add phrase (passage)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={addPart}>
                      <Layers className="mr-2 h-4 w-4" /> Add part
                    </DropdownMenuItem>
                    {sections.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={expandAll}>
                          <ChevronDown className="mr-2 h-4 w-4" /> Expand all
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={collapseAll}>
                          <ChevronRight className="mr-2 h-4 w-4" /> Collapse all
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
            </div>
            <CardDescription className="block">
              Generate questions from lectures, book photos, or slides with AI, upload an existing exam file, or add questions manually.
            </CardDescription>
            <GenerateFromMaterialDialog
              open={generateDialogOpen}
              onOpenChange={setGenerateDialogOpen}
              questionTypes={questionTypes}
              onApply={handleGeneratedExam}
            />
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
              <>
                {sections.map((sec, sectionIndex) => {
                  const sectionDropId = `section-${sectionIndex}`;
                  const sectionZoneVisible = isDragging || recentDropId === sectionDropId;
                  const sectionZoneJustLanded = recentDropId === sectionDropId;
                  return (
                  <div key={sec.id} className="space-y-1">
                    <div
                      className={`rounded-md border-2 border-dashed transition-all duration-200 ease-in-out ${
                        sectionZoneVisible
                          ? "min-h-8 py-2 border-primary/30 bg-primary/5 opacity-100 my-1 flex items-center justify-center"
                          : "min-h-0 h-0 py-0 border-transparent opacity-0 overflow-hidden"
                      } ${sectionZoneJustLanded ? "animate-drop-landed bg-primary/10 border-primary" : ""}`}
                      onDragOver={handleDragOver}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = "hsl(var(--primary))";
                        e.currentTarget.style.backgroundColor = "hsl(var(--primary) / 0.12)";
                        e.currentTarget.style.minHeight = "1.5rem";
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        e.currentTarget.style.borderColor = "";
                        e.currentTarget.style.backgroundColor = "";
                        e.currentTarget.style.minHeight = "";
                      }}
                      onDrop={(e) => {
                        e.currentTarget.style.borderColor = "";
                        e.currentTarget.style.backgroundColor = "";
                        e.currentTarget.style.minHeight = "";
                        handleDropOnSectionList(e, sectionIndex);
                      }}
                    >
                      {sectionZoneVisible && isDragging && (
                        <span className="text-xs text-primary/70 whitespace-nowrap">Drop here for standalone question</span>
                      )}
                    </div>
                    <div className={`rounded-lg border p-4 space-y-4 ${sec.type === "standalone" ? "border-l-4 border-l-primary/50 bg-muted/20" : ""}`}>
                      {sec.type === "standalone" ? (
                        (() => {
                          const q = sec.question;
                          const layoutConfig = getLayoutConfig(getTypeName(q.questionTypeId));
                          const needsAnswer = layoutConfig.showCorrectAnswer && (
                            Array.isArray(q.correctAnswer)
                              ? q.correctAnswer.length === 0 || q.correctAnswer.every((a) => !a)
                              : !q.correctAnswer
                          );
                          const qNum = allQuestions.indexOf(q) + 1;
                          const isCollapsed = collapsedIds.has(sec.id);
                          return (
                            <>
                              <div className="flex items-center gap-2">
                                <span
                                  className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
                                  title="Drag to move or reorder"
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, { t: "question-standalone", sectionId: sec.id })}
                                >
                                  <GripVertical className="h-4 w-4" />
                                </span>
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => toggleCollapsed(sec.id)} aria-label={isCollapsed ? "Expand" : "Collapse"}>
                                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                                <span className="font-medium text-sm">Question {qNum}</span>
                                <Badge variant="secondary" className="text-[10px] font-normal">Standalone</Badge>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRemove({ type: "section", sectionId: sec.id })} className="text-destructive ml-auto">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              {!isCollapsed && (
                                <div className="pl-10 mt-2">
                                  <QuestionCard
                                    sectionId={sec.id}
                                    question={q}
                                    questionLabel={`Question ${qNum}`}
                                    layoutConfig={layoutConfig}
                                    needsAnswer={!!needsAnswer}
                                    questionTypes={questionTypes}
                                    parts={parts}
                                    getQuestionCountForPart={getQuestionCountForPart}
onRemove={() => setConfirmRemove({ type: "section", sectionId: sec.id })}
                                          hideRemoveButton
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
                                </div>
                              )}
                            </>
                          );
                        })()
                      ) : sec.type === "part" ? (
                        (() => {
                          const partSec = sec;
                          const isCollapsed = collapsedIds.has(partSec.id);
                          const totalInPart = partSec.questions.length + partSec.phrases.reduce((s, p) => s + p.questions.length, 0);
                          return (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
                                  title="Drag to reorder part"
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, { t: "section", sectionId: partSec.id })}
                                >
                                  <GripVertical className="h-4 w-4" />
                                </span>
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => toggleCollapsed(partSec.id)} aria-label={isCollapsed ? "Expand" : "Collapse"}>
                                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Layers className="h-4 w-4 text-primary shrink-0" />
                                  <h4 className="font-medium text-sm">Part{partSec.part.name ? `: ${partSec.part.name}` : ""}</h4>
                                  <Badge variant="secondary" className="text-xs">{totalInPart} question(s) · {partSec.phrases.length} passage(s)</Badge>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Part actions">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-52">
                                    {(totalInPart > 0 || partSec.phrases.length > 0) && (
                                      <>
                                        <DropdownMenuItem onClick={() => expandPartContent(partSec.id)}>
                                          <ChevronDown className="mr-2 h-4 w-4" /> Expand all
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => collapsePartContent(partSec.id)}>
                                          <ChevronRight className="mr-2 h-4 w-4" /> Collapse all
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                      </>
                                    )}
                                    <DropdownMenuItem onClick={() => setConfirmRemove({ type: "part", sectionId: partSec.id })} className="text-destructive focus:text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" /> Remove part
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              {!isCollapsed && (
                        <>
                          <div className="grid gap-4 sm:grid-cols-2 pl-10">
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Part name *</Label>
                              <Input
                                value={partSec.part.name}
                                onChange={(e) => updatePartInSection(partSec.id, { ...partSec.part, name: e.target.value })}
                                placeholder="e.g., Section A"
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Description</Label>
                              <Textarea
                                value={partSec.part.description}
                                onChange={(e) => updatePartInSection(partSec.id, { ...partSec.part, description: e.target.value })}
                                placeholder="Optional description"
                                rows={2}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Number of items</Label>
                              <Input
                                type="number"
                                min={1}
                                value={partSec.part.numberOfItems ?? ""}
                                onChange={(e) =>
                                  updatePartInSection(partSec.id, {
                                    ...partSec.part,
                                    numberOfItems: e.target.value ? parseInt(e.target.value) : null,
                                  })
                                }
                                placeholder="All"
                              />
                            </div>
                            {form.watch("timeType") === "per_part" && (
                              <div className="space-y-2">
                                <Label>Time limit (minutes) *</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={partSec.part.timeLimit ?? ""}
                                  onChange={(e) =>
                                    updatePartInSection(partSec.id, {
                                      ...partSec.part,
                                      timeLimit: e.target.value ? parseInt(e.target.value) : null,
                                    })
                                  }
                                />
                              </div>
                            )}
                            {passingConditionType === "per_part" && (
                              <div className="space-y-2 sm:col-span-2">
                                <Label>Passing condition</Label>
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <Select
                                    value={partSec.part.passingCondition?.type || "none"}
                                    onValueChange={(v) =>
                                      updatePartInSection(partSec.id, {
                                        ...partSec.part,
                                        passingCondition: v && v !== "none"
                                          ? { type: v as "percentage" | "points" | "items", value: partSec.part.passingCondition?.value || 0 }
                                          : null,
                                      })
                                    }
                                  >
                                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">None</SelectItem>
                                      <SelectItem value="percentage">Percentage</SelectItem>
                                      <SelectItem value="points">Points</SelectItem>
                                      <SelectItem value="items">Items</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {partSec.part.passingCondition && (
                                    <Input
                                      type="number"
                                      min={0}
                                      max={partSec.part.passingCondition.type === "percentage" ? 100 : undefined}
                                      value={partSec.part.passingCondition.value}
                                      onChange={(e) =>
                                        updatePartInSection(partSec.id, {
                                          ...partSec.part,
                                          passingCondition: {
                                            ...partSec.part.passingCondition!,
                                            value: parseFloat(e.target.value) || 0,
                                          },
                                        })
                                      }
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="pl-10 space-y-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button type="button" variant="outline" size="sm" onClick={() => addQuestionUnderPart(partSec.id)}>
                                <Plus className="mr-1 h-3 w-3" /> Add question
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => addPhraseUnderPart(partSec.id)}>
                                <BookOpen className="mr-1 h-3 w-3" /> Add passage (phrase)
                              </Button>
                            </div>
                            <QuestionDropZone dropTarget={{ t: "part-questions", sectionId: partSec.id, partSectionId: partSec.id }} label={DROP_ZONE_LABEL} />
                            {partSec.questions.map((q, qIdx) => {
                              const layoutConfig = getLayoutConfig(getTypeName(q.questionTypeId));
                              const needsAnswer = layoutConfig.showCorrectAnswer && (
                                Array.isArray(q.correctAnswer)
                                  ? q.correctAnswer.length === 0 || q.correctAnswer.every((a) => !a)
                                  : !q.correctAnswer
                              );
                              const qNum = allQuestions.indexOf(q) + 1;
                              const qCollapseKey = `part-q-${partSec.id}-${qIdx}`;
                              const isQCollapsed = questionCollapsedIds.has(qCollapseKey);
                              return (
                                <div key={`q-${qIdx}`} className="space-y-1">
                                  <QuestionDropZone dropTarget={{ t: "part-questions", sectionId: partSec.id, partSectionId: partSec.id, questionIndex: qIdx }} />
                                  <div className="pl-4 border-l-2 border-primary/20">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground shrink-0"
                                      title="Drag to move this question"
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, { t: "question-part", sectionId: partSec.id, questionIndex: qIdx })}
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </span>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => toggleQuestionCollapsed(qCollapseKey)} aria-label={isQCollapsed ? "Expand question" : "Collapse question"}>
                                      {isQCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                    <span className="font-medium text-sm">Question {qNum} (under part)</span>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRemove({ type: "question-part", sectionId: partSec.id, qIndex: qIdx })} className="text-destructive ml-auto">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  {!isQCollapsed && (
                                    <div className="pl-10 mt-2">
                                      <QuestionCard
                                    sectionId={partSec.id}
                                    question={q}
                                    questionLabel={`Question ${qNum} (under part)`}
                                    layoutConfig={layoutConfig}
                                    needsAnswer={!!needsAnswer}
                                    questionTypes={questionTypes}
                                    parts={[]}
                                    getQuestionCountForPart={getQuestionCountForPart}
                                    onRemove={() => setConfirmRemove({ type: "question-part", sectionId: partSec.id, qIndex: qIdx })}
                                    hideRemoveButton
                                    phraseQuestionIndex={undefined}
                                    updateQuestion={(field, value) => {
                                      const prev = partSec.questions[qIdx];
                                      if (!prev) return;
                                      setQuestionUnderPart(partSec.id, qIdx, { ...prev, [field]: value });
                                    }}
                                    handleQuestionTypeChange={(newTypeId) => {
                                      const prev = partSec.questions[qIdx];
                                      if (!prev) return;
                                      const oldLayout = getLayoutConfig(getTypeName(prev.questionTypeId));
                                      const newLayout = getLayoutConfig(getTypeName(newTypeId));
                                      const next = { ...prev, questionTypeId: newTypeId };
                                      if (oldLayout.layout !== newLayout.layout) {
                                        next.options = [...newLayout.defaultOptions];
                                        next.correctAnswer = newLayout.correctAnswerIsText ? "" : [];
                                      }
                                      setQuestionUnderPart(partSec.id, qIdx, next);
                                    }}
                                    updateOption={(oIndex, value) => {
                                      const prev = partSec.questions[qIdx];
                                      if (!prev) return;
                                      const next = [...prev.options];
                                      next[oIndex] = value;
                                      setQuestionUnderPart(partSec.id, qIdx, { ...prev, options: next });
                                    }}
                                    addOption={() => {
                                      const prev = partSec.questions[qIdx];
                                      if (!prev) return;
                                      setQuestionUnderPart(partSec.id, qIdx, {
                                        ...prev,
                                        options: [...prev.options, ""],
                                        numberOfChoices: prev.options.length + 1,
                                      });
                                    }}
                                    removeOption={(oIndex) => {
                                      const prev = partSec.questions[qIdx];
                                      if (!prev) return;
                                      const nextOpts = prev.options.filter((_, i) => i !== oIndex);
                                      let nextAnswer = prev.correctAnswer;
                                      if (Array.isArray(nextAnswer)) {
                                        nextAnswer = (nextAnswer as string[])
                                          .map((idx) => Number(idx))
                                          .filter((idx) => idx !== oIndex)
                                          .map((idx) => String(idx > oIndex ? idx - 1 : idx));
                                      }
                                      setQuestionUnderPart(partSec.id, qIdx, {
                                        ...prev,
                                        options: nextOpts,
                                        numberOfChoices: nextOpts.length,
                                        correctAnswer: nextAnswer,
                                      });
                                    }}
                                    toggleCorrectAnswer={(optionIndex, checked) => {
                                      const prev = partSec.questions[qIdx];
                                      if (!prev) return;
                                      const existing = prev.correctAnswer;
                                      const current = Array.isArray(existing) ? (existing as string[]) : [];
                                      const idx = String(optionIndex);
                                      setQuestionUnderPart(partSec.id, qIdx, {
                                        ...prev,
                                        correctAnswer: checked ? [...current, idx] : current.filter((a) => a !== idx),
                                      });
                                    }}
                                    setQuestion={(next) => setQuestionUnderPart(partSec.id, qIdx, next)}
                                    sections={sections}
                                    setSections={setSections}
                                  />
                                    </div>
                                  )}
                                  </div>
                                </div>
                              );
                            })}
                            {partSec.phrases.map((partPhrase) => {
                              const phraseCollapsed = collapsedIds.has(partPhrase.id);
                              return (
                                <div key={partPhrase.id} className="rounded-lg border border-primary/20 bg-muted/10 p-3 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 shrink-0"
                                      onClick={() => toggleCollapsed(partPhrase.id)}
                                      aria-label={phraseCollapsed ? "Expand" : "Collapse"}
                                    >
                                      {phraseCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    </Button>
                                    <BookOpen className="h-3 w-3 text-primary" />
                                    <span className="font-medium text-xs">Passage: {partPhrase.phrase.title || "(no title)"}</span>
                                    <Badge variant="secondary" className="text-xs">{partPhrase.questions.length} question(s)</Badge>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 ml-auto shrink-0" aria-label="Passage actions">
                                          <MoreVertical className="h-3.5 w-3.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-52">
                                        {partPhrase.questions.length > 0 && (
                                          <>
                                            <DropdownMenuItem onClick={() => expandPartPhraseQuestions(partSec.id, partPhrase.id)}>
                                              <ChevronDown className="mr-2 h-4 w-4" /> Expand all
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => collapsePartPhraseQuestions(partSec.id, partPhrase.id)}>
                                              <ChevronRight className="mr-2 h-4 w-4" /> Collapse all
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                          </>
                                        )}
                                        <DropdownMenuItem onClick={() => setConfirmRemove({ type: "phrase-under-part", sectionId: partSec.id, phraseId: partPhrase.id })} className="text-destructive focus:text-destructive">
                                          <Trash2 className="mr-2 h-4 w-4" /> Remove passage
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  {!phraseCollapsed && (
                                    <>
                                      <div className="grid gap-2 sm:grid-cols-2 pl-9">
                                        <div className="space-y-1 sm:col-span-2">
                                          <Label className="text-xs">Title (optional)</Label>
                                          <Input
                                            value={partPhrase.phrase.title}
                                            onChange={(e) => updatePartPhrase(partSec.id, partPhrase.id, { ...partPhrase.phrase, title: e.target.value })}
                                            placeholder="e.g. Reading passage"
                                          />
                                        </div>
                                        <div className="space-y-1 sm:col-span-2">
                                          <Label className="text-xs">Body *</Label>
                                          <Textarea
                                            value={partPhrase.phrase.body}
                                            onChange={(e) => updatePartPhrase(partSec.id, partPhrase.id, { ...partPhrase.phrase, body: e.target.value })}
                                            placeholder="Passage text..."
                                            rows={3}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Usage type</Label>
                                          <Select
                                            value={partPhrase.phrase.usageType || "passage"}
                                            onValueChange={(v) => updatePartPhrase(partSec.id, partPhrase.id, { ...partPhrase.phrase, usageType: v })}
                                          >
                                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="passage">Passage</SelectItem>
                                              <SelectItem value="instruction">Instruction</SelectItem>
                                              <SelectItem value="scenario">Scenario</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-1 sm:col-span-2">
                                          <Button type="button" variant="outline" size="sm" onClick={() => openPhraseImagePicker(partSec.id, partPhrase.id)}>
                                            <ImageIcon className="mr-1 h-3 w-3" /> Images
                                          </Button>
                                          {partPhrase.imageFiles.length > 0 && (
                                            <ul className="space-y-1 mt-1">
                                              {partPhrase.imageFiles.map((f, i) => (
                                                <PhraseImageThumbnail
                                                  key={`${partPhrase.id}-${i}`}
                                                  file={f}
                                                  onPreview={setPhrasePreviewUrl}
                                                  onRemove={() => removePhraseImage(partSec.id, i, partPhrase.id)}
                                                />
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      </div>
                                      <div className="pl-9 space-y-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => addQuestionUnderPartPhrase(partSec.id, partPhrase.id)}>
                                          <Plus className="mr-1 h-3 w-3" /> Add question under this passage
                                        </Button>
                                        <QuestionDropZone dropTarget={{ t: "part-phrase-questions", partSectionId: partSec.id, phraseId: partPhrase.id }} label={DROP_ZONE_LABEL} />
                                      </div>
                                      {partPhrase.questions.map((q, qIdx) => {
                                        const layoutConfig = getLayoutConfig(getTypeName(q.questionTypeId));
                                        const needsAnswer = layoutConfig.showCorrectAnswer && (
                                          Array.isArray(q.correctAnswer)
                                            ? q.correctAnswer.length === 0 || q.correctAnswer.every((a) => !a)
                                            : !q.correctAnswer
                                        );
                                        const qNum = allQuestions.indexOf(q) + 1;
                                        const qCollapseKey = `part-ph-q-${partSec.id}-${partPhrase.id}-${qIdx}`;
                                        const isQCollapsed = questionCollapsedIds.has(qCollapseKey);
                                        return (
                                          <div key={qIdx} className="mt-2 space-y-1">
                                            <QuestionDropZone dropTarget={{ t: "part-phrase-questions", partSectionId: partSec.id, phraseId: partPhrase.id, questionIndex: qIdx }} />
                                            <div className="mt-2 pl-4 border-l-2 border-primary/20">
                                            <div className="flex items-center gap-2">
                                              <span
                                                className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground shrink-0"
                                                title="Drag to move this question"
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, { t: "question-part-phrase", sectionId: partSec.id, phraseId: partPhrase.id, questionIndex: qIdx })}
                                              >
                                                <GripVertical className="h-4 w-4" />
                                              </span>
                                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => toggleQuestionCollapsed(qCollapseKey)} aria-label={isQCollapsed ? "Expand question" : "Collapse question"}>
                                                {isQCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                              </Button>
                                              <span className="font-medium text-sm">Question {qNum} (under passage)</span>
                                              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRemove({ type: "question-part-phrase", sectionId: partSec.id, phraseId: partPhrase.id, qIndex: qIdx })} className="text-destructive ml-auto">
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                            {!isQCollapsed && (
                                              <div className="pl-10 mt-2">
                                                <QuestionCard
                                                  sectionId={partSec.id}
                                              question={q}
                                              questionLabel={`Question ${qNum} (under passage)`}
                                              layoutConfig={layoutConfig}
                                              needsAnswer={!!needsAnswer}
                                              questionTypes={questionTypes}
                                              parts={[]}
                                              getQuestionCountForPart={getQuestionCountForPart}
                                              onRemove={() => setConfirmRemove({ type: "question-part-phrase", sectionId: partSec.id, phraseId: partPhrase.id, qIndex: qIdx })}
                                              hideRemoveButton
                                              phraseQuestionIndex={qIdx}
                                              updateQuestion={(field, value) => {
                                                const prev = partPhrase.questions[qIdx];
                                                if (!prev) return;
                                                setQuestionUnderPartPhrase(partSec.id, partPhrase.id, qIdx, { ...prev, [field]: value });
                                              }}
                                              handleQuestionTypeChange={(newTypeId) => {
                                                const prev = partPhrase.questions[qIdx];
                                                if (!prev) return;
                                                const oldLayout = getLayoutConfig(getTypeName(prev.questionTypeId));
                                                const newLayout = getLayoutConfig(getTypeName(newTypeId));
                                                const next = { ...prev, questionTypeId: newTypeId };
                                                if (oldLayout.layout !== newLayout.layout) {
                                                  next.options = [...newLayout.defaultOptions];
                                                  next.correctAnswer = newLayout.correctAnswerIsText ? "" : [];
                                                }
                                                setQuestionUnderPartPhrase(partSec.id, partPhrase.id, qIdx, next);
                                              }}
                                              updateOption={(oIndex, value) => {
                                                const prev = partPhrase.questions[qIdx];
                                                if (!prev) return;
                                                const next = [...prev.options];
                                                next[oIndex] = value;
                                                setQuestionUnderPartPhrase(partSec.id, partPhrase.id, qIdx, { ...prev, options: next });
                                              }}
                                              addOption={() => {
                                                const prev = partPhrase.questions[qIdx];
                                                if (!prev) return;
                                                setQuestionUnderPartPhrase(partSec.id, partPhrase.id, qIdx, {
                                                  ...prev,
                                                  options: [...prev.options, ""],
                                                  numberOfChoices: prev.options.length + 1,
                                                });
                                              }}
                                              removeOption={(oIndex) => {
                                                const prev = partPhrase.questions[qIdx];
                                                if (!prev) return;
                                                const nextOpts = prev.options.filter((_, i) => i !== oIndex);
                                                let nextAnswer = prev.correctAnswer;
                                                if (Array.isArray(nextAnswer)) {
                                                  nextAnswer = (nextAnswer as string[])
                                                    .map((idx) => Number(idx))
                                                    .filter((idx) => idx !== oIndex)
                                                    .map((idx) => String(idx > oIndex ? idx - 1 : idx));
                                                }
                                                setQuestionUnderPartPhrase(partSec.id, partPhrase.id, qIdx, {
                                                  ...prev,
                                                  options: nextOpts,
                                                  numberOfChoices: nextOpts.length,
                                                  correctAnswer: nextAnswer,
                                                });
                                              }}
                                              toggleCorrectAnswer={(optionIndex, checked) => {
                                                const prev = partPhrase.questions[qIdx];
                                                if (!prev) return;
                                                const existing = prev.correctAnswer;
                                                const current = Array.isArray(existing) ? (existing as string[]) : [];
                                                const idx = String(optionIndex);
                                                setQuestionUnderPartPhrase(partSec.id, partPhrase.id, qIdx, {
                                                  ...prev,
                                                  correctAnswer: checked ? [...current, idx] : current.filter((a) => a !== idx),
                                                });
                                              }}
                                              setQuestion={(next) => setQuestionUnderPartPhrase(partSec.id, partPhrase.id, qIdx, next)}
                                              sections={sections}
                                              setSections={setSections}
                                            />
                                              </div>
                                            )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                            </>
                          );
                        })()
                      ) : (
                        (() => {
                          const phraseSec = sec;
                          const isPhraseCollapsed = collapsedIds.has(phraseSec.id);
                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
                                    title="Drag to reorder passage"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, { t: "phrase", sectionId: phraseSec.id })}
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => toggleCollapsed(phraseSec.id)}
                                    aria-label={isPhraseCollapsed ? "Expand" : "Collapse"}
                                  >
                                    {isPhraseCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                  <BookOpen className="h-4 w-4 text-primary" />
                                  <h4 className="font-medium text-sm">Passage (phrase)</h4>
                                  <Badge variant="secondary" className="text-xs">
                                    {phraseSec.questions.length} question(s) under this passage
                                  </Badge>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Passage actions">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-52">
                                    {phraseSec.questions.length > 0 && (
                                      <>
                                        <DropdownMenuItem onClick={() => expandPhraseQuestions(phraseSec.id)}>
                                          <ChevronDown className="mr-2 h-4 w-4" /> Expand all
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => collapsePhraseQuestions(phraseSec.id)}>
                                          <ChevronRight className="mr-2 h-4 w-4" /> Collapse all
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                      </>
                                    )}
                                    <DropdownMenuItem onClick={() => setConfirmRemove({ type: "section", sectionId: phraseSec.id })} className="text-destructive focus:text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" /> Remove passage
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              {!isPhraseCollapsed && (
                                <>
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
                                  <div className="pt-2 space-y-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => addQuestionUnderPhrase(phraseSec.id)}>
                                      <Plus className="mr-1 h-3 w-3" /> Add question under this passage
                                    </Button>
                                    <QuestionDropZone dropTarget={{ t: "phrase-questions", sectionId: phraseSec.id }} label={DROP_ZONE_LABEL} />
                                  </div>
                                  {phraseSec.questions.map((q, qIdx) => {
                                    const layoutConfig = getLayoutConfig(getTypeName(q.questionTypeId));
                                    const needsAnswer = layoutConfig.showCorrectAnswer && (
                                      Array.isArray(q.correctAnswer)
                                        ? q.correctAnswer.length === 0 || q.correctAnswer.every((a) => !a)
                                        : !q.correctAnswer
                                    );
                                    const qNum = allQuestions.indexOf(q) + 1;
                                    const qCollapseKey = `ph-q-${phraseSec.id}-${qIdx}`;
                                    const isQCollapsed = questionCollapsedIds.has(qCollapseKey);
                                    return (
                                      <div key={qIdx} className="mt-2">
                                        <QuestionDropZone dropTarget={{ t: "phrase-questions", sectionId: phraseSec.id, questionIndex: qIdx }} />
                                        <div className="mt-2 pl-4 border-l-2 border-primary/30">
                                        <div className="flex items-center gap-2">
                                          <span
                                            className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground shrink-0"
                                            title="Drag to move this question"
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, { t: "question-phrase", sectionId: phraseSec.id, questionIndex: qIdx })}
                                          >
                                            <GripVertical className="h-4 w-4" />
                                          </span>
                                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => toggleQuestionCollapsed(qCollapseKey)} aria-label={isQCollapsed ? "Expand question" : "Collapse question"}>
                                            {isQCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                          </Button>
                                          <span className="font-medium text-sm">Question {qNum} (under passage)</span>
                                          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRemove({ type: "question-phrase", sectionId: phraseSec.id, qIndex: qIdx })} className="text-destructive ml-auto">
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        {!isQCollapsed && (
                                          <div className="pl-10 mt-2">
                                            <QuestionCard
                                              sectionId={phraseSec.id}
                                              question={q}
                                              questionLabel={`Question ${qNum} (under passage)`}
                                              layoutConfig={layoutConfig}
                                              needsAnswer={!!needsAnswer}
                                              questionTypes={questionTypes}
                                              parts={parts}
                                              getQuestionCountForPart={getQuestionCountForPart}
                                              onRemove={() => setConfirmRemove({ type: "question-phrase", sectionId: phraseSec.id, qIndex: qIdx })}
                                              hideRemoveButton
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
                                        )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                            </>
                          );
                        })() )}
                    </div>
                  </div>
                  );
                })}
                <div
                  className={`rounded-md border-2 border-dashed transition-all duration-200 ease-in-out ${
                    isDragging || recentDropId === `section-${sections.length}`
                      ? "min-h-8 py-2 border-primary/30 bg-primary/5 opacity-100 my-1 flex items-center justify-center"
                      : "min-h-0 h-0 py-0 border-transparent opacity-0 overflow-hidden"
                  } ${recentDropId === `section-${sections.length}` ? "animate-drop-landed bg-primary/10 border-primary" : ""}`}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = "hsl(var(--primary))";
                    e.currentTarget.style.backgroundColor = "hsl(var(--primary) / 0.12)";
                    e.currentTarget.style.minHeight = "1.5rem";
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    e.currentTarget.style.borderColor = "";
                    e.currentTarget.style.backgroundColor = "";
                    e.currentTarget.style.minHeight = "";
                  }}
                  onDrop={(e) => {
                    e.currentTarget.style.borderColor = "";
                    e.currentTarget.style.backgroundColor = "";
                    e.currentTarget.style.minHeight = "";
                    handleDropOnSectionList(e, sections.length);
                  }}
                >
                  {isDragging && (
                    <span className="text-xs text-primary/70 whitespace-nowrap">Drop here for standalone question</span>
                  )}
                </div>
              </>
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

      {/* Confirmation before remove */}
      <AlertDialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getConfirmRemoveMessage().title}</AlertDialogTitle>
            <AlertDialogDescription>{getConfirmRemoveMessage().description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveAndClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
