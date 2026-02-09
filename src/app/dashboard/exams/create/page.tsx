"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { examSchema, type ExamFormValues } from "@/lib/validations";
import { parseExamFile, parsedToPayload } from "@/lib/exam-parser";
import type { ParseResult } from "@/lib/exam-parser";
import { getLayoutConfig } from "@/lib/question-layout";
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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import Link from "next/link";
import type { CreateExamQuestionPayload } from "@/types";

export default function CreateExamPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<CreateExamQuestionPayload[]>([]);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      questionOrder: "fixed",
      timeType: "per_exam",
      timeLimit: 60,
      passingCondition: { type: "percentage", value: 70 },
      isPublic: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: ExamFormValues & { questions: CreateExamQuestionPayload[] }) =>
      api.createExam({
        ...payload,
        questions: payload.questions.length > 0 ? payload.questions : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam created successfully!");
      router.push("/dashboard/exams");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create exam"),
  });

  const getTypeName = (typeId: string) =>
    questionTypes.find((qt) => qt.id === typeId)?.name || "";

  const addQuestion = () => {
    const defaultTypeId = questionTypes[0]?.id || "";
    const layout = getLayoutConfig(getTypeName(defaultTypeId));
    setQuestions([
      ...questions,
      {
        questionTypeId: defaultTypeId,
        questionText: "",
        options: layout.defaultOptions.length > 0 ? [...layout.defaultOptions] : ["", "", "", ""],
        correctAnswer: layout.correctAnswerIsText ? "" : [],
        points: 1,
        examId: "", // Will be set server-side
      },
    ]);
  };

  const handleQuestionTypeChange = (qIndex: number, newTypeId: string) => {
    const updated = [...questions];
    const oldLayout = getLayoutConfig(getTypeName(updated[qIndex].questionTypeId));
    const newLayout = getLayoutConfig(getTypeName(newTypeId));

    updated[qIndex].questionTypeId = newTypeId;

    // Reset form fields when switching between incompatible layouts
    if (oldLayout.layout !== newLayout.layout) {
      updated[qIndex].options = [...newLayout.defaultOptions];
      updated[qIndex].numberOfChoices = newLayout.defaultOptions.length || undefined;
      updated[qIndex].correctAnswer = newLayout.correctAnswerIsText ? "" : [];
    }

    setQuestions(updated);
  };

  const toggleCorrectAnswer = (qIndex: number, optionIndex: number, checked: boolean) => {
    const updated = [...questions];
    const existing = updated[qIndex].correctAnswer;
    const current = Array.isArray(existing) ? (existing as string[]) : [];
    const idx = String(optionIndex);
    updated[qIndex].correctAnswer = checked
      ? [...current, idx]
      : current.filter((a) => a !== idx);
    setQuestions(updated);
  };

  const updateQuestion = (index: number, field: string, value: unknown) => {
    const updated = [...questions];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[index] as any)[field] = value;
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const addOption = (qIndex: number) => {
    const updated = [...questions];
    updated[qIndex].options.push("");
    updated[qIndex].numberOfChoices = updated[qIndex].options.length;
    setQuestions(updated);
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const updated = [...questions];
    updated[qIndex].options = updated[qIndex].options.filter((_, i) => i !== oIndex);
    updated[qIndex].numberOfChoices = updated[qIndex].options.length;
    // Adjust correctAnswer indices after removal
    if (Array.isArray(updated[qIndex].correctAnswer)) {
      updated[qIndex].correctAnswer = (updated[qIndex].correctAnswer as string[])
        .map((idx) => Number(idx))
        .filter((idx) => idx !== oIndex)
        .map((idx) => String(idx > oIndex ? idx - 1 : idx));
    }
    setQuestions(updated);
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

        // Convert parsed questions to payload format and add to questions list
        const defaultTypeId = questionTypes[0]?.id || "";
        const newQuestions = parsedToPayload(result.questions, defaultTypeId, questionTypes).map((q) => {
          // Convert text-based correctAnswer to index-based for form state
          if (typeof q.correctAnswer === "string" && q.correctAnswer) {
            const idx = q.options.indexOf(q.correctAnswer);
            return { ...q, correctAnswer: idx >= 0 ? [String(idx)] : [] };
          }
          if (Array.isArray(q.correctAnswer)) {
            return {
              ...q,
              correctAnswer: (q.correctAnswer as string[])
                .map((ans) => String(q.options.indexOf(ans)))
                .filter((idx) => idx !== "-1"),
            };
          }
          return { ...q, correctAnswer: [] };
        });
        setQuestions((prev) => [...prev, ...newQuestions]);

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

  const onSubmit = (values: ExamFormValues) => {
    const layoutMap = new Map(
      questionTypes.map((qt) => [qt.id, getLayoutConfig(qt.name)])
    );

    // Convert correctAnswer for the API
    const payload = questions.map((q) => {
      const config = layoutMap.get(q.questionTypeId);
      if (Array.isArray(q.correctAnswer)) {
        if (config?.correctAnswerIsText) {
          // Text-based answers: filter empties, keep as array
          const filtered = (q.correctAnswer as string[]).filter(Boolean);
          return {
            ...q,
            correctAnswer: filtered.length === 1 ? filtered[0] : filtered,
          };
        }
        // Index-based: convert indices to option text values
        return {
          ...q,
          correctAnswer: (q.correctAnswer as string[])
            .map((idx) => q.options[Number(idx)])
            .filter(Boolean),
        };
      }
      return q;
    });
    createMutation.mutate({ ...values, questions: payload });
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

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                <Select value={form.watch("timeType")} onValueChange={(v) => form.setValue("timeType", v as "per_exam" | "per_question")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_exam">Per Exam (Total)</SelectItem>
                    <SelectItem value="per_question">Per Question</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timeLimit">Time Limit (minutes) *</Label>
                <Input id="timeLimit" type="number" min={1} {...form.register("timeLimit")} />
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
            <div className="flex items-center gap-3">
              <Switch
                checked={form.watch("isPublic")}
                onCheckedChange={(v) => form.setValue("isPublic", v)}
              />
              <Label>Make this exam public (accessible without invitation)</Label>
            </div>
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileUpload}
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

            {/* Drop zone when no questions */}
            {questions.length === 0 && !isScanning && !scanResult && !scanError ? (
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
                <p className="text-xs text-muted-foreground">
                  Or add questions manually using the &quot;Add Question&quot; button above.
                </p>
              </div>
            ) : questions.length === 0 && !isScanning ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                No questions added yet. You can add them now or after creating the exam.
              </p>
            ) : (
              questions.map((q, qi) => {
                const layoutConfig = getLayoutConfig(getTypeName(q.questionTypeId));
                const needsAnswer = layoutConfig.showCorrectAnswer && (
                  Array.isArray(q.correctAnswer)
                    ? q.correctAnswer.length === 0 || q.correctAnswer.every((a) => !a)
                    : !q.correctAnswer
                );

                return (
                  <div
                    key={qi}
                    className={`rounded-lg border p-4 space-y-4 ${
                      needsAnswer
                        ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">Question {qi + 1}</h4>
                        {needsAnswer && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-400 text-amber-600 dark:text-amber-400"
                          >
                            <AlertTriangle className="mr-1 h-2.5 w-2.5" />
                            Needs answer
                          </Badge>
                        )}
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeQuestion(qi)} className="text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Question text, type, and points - always shown */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Question Text *</Label>
                        <Textarea
                          value={q.questionText}
                          onChange={(e) => updateQuestion(qi, "questionText", e.target.value)}
                          placeholder="Enter your question..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Question Type</Label>
                        <Select
                          value={q.questionTypeId}
                          onValueChange={(v) => handleQuestionTypeChange(qi, v)}
                        >
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
                          onChange={(e) => updateQuestion(qi, "points", parseInt(e.target.value) || 1)}
                        />
                      </div>
                    </div>

                    {/* Options section - shown for MC, T/F, Multiple Answer */}
                    {layoutConfig.showOptions && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Options</Label>
                            {layoutConfig.editableOptions && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => addOption(qi)}>
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
                                  onChange={(e) => updateOption(qi, oi, e.target.value)}
                                  placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                  className="flex-1"
                                />
                              ) : (
                                <span className="text-sm flex-1">{opt}</span>
                              )}
                              {layoutConfig.editableOptions && q.options.length > 2 && (
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(qi, oi)} className="shrink-0">
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Correct Answer - varies by layout */}
                    {layoutConfig.showCorrectAnswer && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <Label>{layoutConfig.correctAnswerLabel}</Label>

                          {/* Text inputs for identification/fill-in-the-blank */}
                          {layoutConfig.correctAnswerIsText && (() => {
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
                                        const updated = [...questions];
                                        const arr = Array.isArray(updated[qi].correctAnswer)
                                          ? [...(updated[qi].correctAnswer as string[])]
                                          : [String(updated[qi].correctAnswer || "")];
                                        arr[ai] = e.target.value;
                                        updated[qi].correctAnswer = arr;
                                        setQuestions(updated);
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
                                          const updated = [...questions];
                                          const arr = Array.isArray(updated[qi].correctAnswer)
                                            ? [...(updated[qi].correctAnswer as string[])]
                                            : [String(updated[qi].correctAnswer || "")];
                                          arr.splice(ai, 1);
                                          updated[qi].correctAnswer = arr;
                                          setQuestions(updated);
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
                                    const updated = [...questions];
                                    const arr = Array.isArray(updated[qi].correctAnswer)
                                      ? [...(updated[qi].correctAnswer as string[])]
                                      : [String(updated[qi].correctAnswer || "")];
                                    arr.push("");
                                    updated[qi].correctAnswer = arr;
                                    setQuestions(updated);
                                  }}
                                >
                                  <Plus className="mr-1 h-3 w-3" /> Add Accepted Answer
                                </Button>
                              </div>
                            );
                          })()}

                          {/* Checkboxes for selecting correct answer(s) */}
                          {!layoutConfig.correctAnswerIsText && (
                            <div className="space-y-2">
                              {q.options.filter(Boolean).map((opt, oi) => {
                                const selectedIndices = Array.isArray(q.correctAnswer)
                                  ? (q.correctAnswer as string[])
                                  : [];
                                return (
                                  <label
                                    key={oi}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={selectedIndices.includes(String(oi))}
                                      onCheckedChange={(checked) =>
                                        toggleCorrectAnswer(qi, oi, !!checked)
                                      }
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

                    {/* Info for essay type */}
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
    </div>
  );
}
