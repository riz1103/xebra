"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { examSchema, type ExamFormValues } from "@/lib/validations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/ui/loading";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Save } from "lucide-react";
import Link from "next/link";
import { getLayoutConfig } from "@/lib/question-layout";
import type { CreateExamQuestionPayload } from "@/types";

export default function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newQuestions, setNewQuestions] = useState<CreateExamQuestionPayload[]>([]);

  const { data: examData, isLoading: examLoading } = useQuery({
    queryKey: ["exam", id],
    queryFn: () => api.getExam(id, { includeQuestions: true }),
  });

  const { data: questionTypesData } = useQuery({
    queryKey: ["question-types"],
    queryFn: () => api.getQuestionTypes(),
  });

  const exam = examData?.data;
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

  useEffect(() => {
    if (exam) {
      form.reset({
        title: exam.title,
        description: exam.description || "",
        questionOrder: exam.questionOrder,
        timeType: exam.timeType,
        timeLimit: exam.timeLimit,
        numberOfItems: exam.numberOfItems,
        passingCondition: exam.passingCondition || { type: "percentage", value: exam.passingScore || 70 },
        isPublic: exam.isPublic,
      });
    }
  }, [exam, form]);

  const updateMutation = useMutation({
    mutationFn: (values: ExamFormValues) => api.updateExam(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam", id] });
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam updated successfully!");
      router.push(`/dashboard/exams/${id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addQuestionMutation = useMutation({
    mutationFn: (q: CreateExamQuestionPayload) => api.createExamQuestion({ ...q, examId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam", id] });
      toast.success("Question added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (qId: string) => api.deleteExamQuestion(qId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam", id] });
      toast.success("Question removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getTypeName = (typeId: string) =>
    questionTypes.find((qt) => qt.id === typeId)?.name || "";

  const addNewQuestion = () => {
    const defaultTypeId = questionTypes[0]?.id || "";
    const layout = getLayoutConfig(getTypeName(defaultTypeId));
    setNewQuestions([
      ...newQuestions,
      {
        questionTypeId: defaultTypeId,
        questionText: "",
        options: layout.defaultOptions.length > 0 ? [...layout.defaultOptions] : ["", "", "", ""],
        correctAnswer: layout.correctAnswerIsText ? "" : [],
        points: 1,
        examId: id,
      },
    ]);
  };

  const handleNewQuestionTypeChange = (qIndex: number, newTypeId: string) => {
    const updated = [...newQuestions];
    const oldLayout = getLayoutConfig(getTypeName(updated[qIndex].questionTypeId));
    const newLayout = getLayoutConfig(getTypeName(newTypeId));
    updated[qIndex].questionTypeId = newTypeId;
    if (oldLayout.layout !== newLayout.layout) {
      updated[qIndex].options = [...newLayout.defaultOptions];
      updated[qIndex].numberOfChoices = newLayout.defaultOptions.length || undefined;
      updated[qIndex].correctAnswer = newLayout.correctAnswerIsText ? "" : [];
    }
    setNewQuestions(updated);
  };

  const toggleNewQuestionCorrectAnswer = (qIndex: number, optionIndex: number, checked: boolean) => {
    const updated = [...newQuestions];
    const existing = updated[qIndex].correctAnswer;
    const current = Array.isArray(existing) ? (existing as string[]) : [];
    const idx = String(optionIndex);
    updated[qIndex].correctAnswer = checked
      ? [...current, idx]
      : current.filter((a) => a !== idx);
    setNewQuestions(updated);
  };

  const saveNewQuestion = (index: number) => {
    const q = newQuestions[index];
    if (!q.questionText || !q.options.some(Boolean)) {
      toast.error("Please fill in the question text and options");
      return;
    }
    // Convert correctAnswer for the API
    const config = getLayoutConfig(getTypeName(q.questionTypeId));
    let finalAnswer: string | string[] = q.correctAnswer;
    if (Array.isArray(q.correctAnswer)) {
      if (config.correctAnswerIsText) {
        const filtered = (q.correctAnswer as string[]).filter(Boolean);
        finalAnswer = filtered.length === 1 ? filtered[0] : filtered;
      } else {
        finalAnswer = (q.correctAnswer as string[])
          .map((idx) => q.options[Number(idx)])
          .filter(Boolean);
      }
    }
    const payload = { ...q, correctAnswer: finalAnswer };
    addQuestionMutation.mutate(payload, {
      onSuccess: () => {
        setNewQuestions(newQuestions.filter((_, i) => i !== index));
      },
    });
  };

  if (examLoading) return <PageLoader />;
  if (!exam) {
    return (
      <div className="text-center py-16">
        <p>Exam not found</p>
        <Button asChild className="mt-4"><Link href="/dashboard/exams">Back</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/exams/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Exam</h1>
          <p className="text-muted-foreground">Update &quot;{exam.title}&quot;</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Exam Title *</Label>
              <Input {...form.register("title")} />
              {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Question Order</Label>
                <Select value={form.watch("questionOrder")} onValueChange={(v) => form.setValue("questionOrder", v as "random" | "fixed")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="random">Random</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time Type</Label>
                <Select value={form.watch("timeType")} onValueChange={(v) => form.setValue("timeType", v as "per_exam" | "per_question")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_exam">Per Exam</SelectItem>
                    <SelectItem value="per_question">Per Question</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time Limit (min)</Label>
                <Input type="number" min={1} {...form.register("timeLimit")} />
              </div>
              <div className="space-y-2">
                <Label>Number of Items</Label>
                <Input type="number" min={1} placeholder="All" {...form.register("numberOfItems")} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Passing Condition</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.watch("passingCondition.type")} onValueChange={(v) => form.setValue("passingCondition.type", v as "percentage" | "points" | "items")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="points">Points</SelectItem>
                    <SelectItem value="items">Items</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input type="number" min={0} {...form.register("passingCondition.value")} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.watch("isPublic")} onCheckedChange={(v) => form.setValue("isPublic", v)} />
              <Label>Public Exam</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href={`/dashboard/exams/${id}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </div>
      </form>

      {/* Existing Questions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Questions ({exam.questions?.length || 0})</CardTitle>
            <CardDescription>Manage exam questions</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addNewQuestion}>
            <Plus className="mr-1 h-3 w-3" /> Add Question
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {exam.questions?.map((q, i) => (
            <div key={q.id} className="flex items-start gap-3 rounded-lg border p-3">
              <span className="text-sm font-medium text-muted-foreground mt-0.5">Q{i + 1}.</span>
              <div className="flex-1 text-sm">
                <p>{q.questionText}</p>
                <p className="text-xs text-muted-foreground mt-1">{q.options.length} options &middot; {q.points} pts</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteQuestionMutation.mutate(q.id)} className="text-destructive shrink-0">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {/* New Question Forms */}
          {newQuestions.map((q, qi) => {
            const layoutConfig = getLayoutConfig(getTypeName(q.questionTypeId));
            return (
              <div key={qi} className="rounded-lg border-2 border-dashed border-primary/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-primary">New Question</h4>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => saveNewQuestion(qi)} disabled={addQuestionMutation.isPending}>
                      {addQuestionMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      Save
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setNewQuestions(newQuestions.filter((_, i) => i !== qi))} className="text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  placeholder="Question text..."
                  value={q.questionText}
                  onChange={(e) => {
                    const updated = [...newQuestions];
                    updated[qi].questionText = e.target.value;
                    setNewQuestions(updated);
                  }}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select value={q.questionTypeId} onValueChange={(v) => handleNewQuestionTypeChange(qi, v)}>
                    <SelectTrigger><SelectValue placeholder="Question type" /></SelectTrigger>
                    <SelectContent>
                      {questionTypes.map((qt) => (<SelectItem key={qt.id} value={qt.id}>{qt.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={1} value={q.points} onChange={(e) => {
                    const updated = [...newQuestions];
                    updated[qi].points = parseInt(e.target.value) || 1;
                    setNewQuestions(updated);
                  }} placeholder="Points" />
                </div>

                {/* Options - shown for MC, T/F, Multiple Answer */}
                {layoutConfig.showOptions && (
                  <div className="space-y-2">
                    <Label className="text-xs">Options</Label>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <span className="text-xs w-5">{String.fromCharCode(65 + oi)}.</span>
                        {layoutConfig.editableOptions ? (
                          <Input value={opt} onChange={(e) => {
                            const updated = [...newQuestions];
                            updated[qi].options[oi] = e.target.value;
                            setNewQuestions(updated);
                          }} placeholder={`Option ${String.fromCharCode(65 + oi)}`} className="flex-1" />
                        ) : (
                          <span className="text-sm flex-1">{opt}</span>
                        )}
                      </div>
                    ))}
                    {layoutConfig.editableOptions && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => {
                        const updated = [...newQuestions];
                        updated[qi].options.push("");
                        setNewQuestions(updated);
                      }}>
                        <Plus className="mr-1 h-3 w-3" /> Add Option
                      </Button>
                    )}
                  </div>
                )}

                {/* Correct Answer */}
                {layoutConfig.showCorrectAnswer && (
                  <div className="space-y-2">
                    <Label className="text-xs">{layoutConfig.correctAnswerLabel}</Label>

                    {layoutConfig.correctAnswerIsText ? (() => {
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
                                  const updated = [...newQuestions];
                                  const arr = Array.isArray(updated[qi].correctAnswer)
                                    ? [...(updated[qi].correctAnswer as string[])]
                                    : [String(updated[qi].correctAnswer || "")];
                                  arr[ai] = e.target.value;
                                  updated[qi].correctAnswer = arr;
                                  setNewQuestions(updated);
                                }}
                                placeholder={answers.length > 1 ? `Accepted answer ${ai + 1}` : layoutConfig.correctAnswerPlaceholder}
                                className="flex-1"
                              />
                              {answers.length > 1 && (
                                <Button type="button" variant="ghost" size="icon" onClick={() => {
                                  const updated = [...newQuestions];
                                  const arr = Array.isArray(updated[qi].correctAnswer)
                                    ? [...(updated[qi].correctAnswer as string[])]
                                    : [String(updated[qi].correctAnswer || "")];
                                  arr.splice(ai, 1);
                                  updated[qi].correctAnswer = arr;
                                  setNewQuestions(updated);
                                }} className="shrink-0">
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button type="button" variant="ghost" size="sm" onClick={() => {
                            const updated = [...newQuestions];
                            const arr = Array.isArray(updated[qi].correctAnswer)
                              ? [...(updated[qi].correctAnswer as string[])]
                              : [String(updated[qi].correctAnswer || "")];
                            arr.push("");
                            updated[qi].correctAnswer = arr;
                            setNewQuestions(updated);
                          }}>
                            <Plus className="mr-1 h-3 w-3" /> Add Accepted Answer
                          </Button>
                        </div>
                      );
                    })() : (
                      <div className="space-y-2">
                        {q.options.filter(Boolean).map((opt, oi) => {
                          const selectedIndices = Array.isArray(q.correctAnswer)
                            ? (q.correctAnswer as string[])
                            : [];
                          return (
                            <label key={oi} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={selectedIndices.includes(String(oi))}
                                onCheckedChange={(checked) => toggleNewQuestionCorrectAnswer(qi, oi, !!checked)}
                              />
                              <span className="text-xs text-muted-foreground">{String.fromCharCode(65 + oi)}.</span>
                              <span className="text-sm">{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Info for essay type */}
                {!layoutConfig.showCorrectAnswer && !layoutConfig.showOptions && (
                  <p className="text-xs text-muted-foreground italic">
                    This question type will be graded manually. No options or correct answer needed.
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
