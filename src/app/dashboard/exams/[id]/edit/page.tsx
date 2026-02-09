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
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Save } from "lucide-react";
import Link from "next/link";
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

  const addNewQuestion = () => {
    setNewQuestions([
      ...newQuestions,
      {
        questionTypeId: questionTypes[0]?.id || "",
        questionText: "",
        options: ["", "", "", ""],
        correctAnswer: "",
        points: 1,
        examId: id,
      },
    ]);
  };

  const saveNewQuestion = (index: number) => {
    const q = newQuestions[index];
    if (!q.questionText || !q.options.some(Boolean)) {
      toast.error("Please fill in the question text and options");
      return;
    }
    addQuestionMutation.mutate(q, {
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
          {newQuestions.map((q, qi) => (
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
                <Select value={q.questionTypeId} onValueChange={(v) => {
                  const updated = [...newQuestions];
                  updated[qi].questionTypeId = v;
                  setNewQuestions(updated);
                }}>
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
              <div className="space-y-2">
                <Label className="text-xs">Options</Label>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <span className="text-xs w-5">{String.fromCharCode(65 + oi)}.</span>
                    <Input value={opt} onChange={(e) => {
                      const updated = [...newQuestions];
                      updated[qi].options[oi] = e.target.value;
                      setNewQuestions(updated);
                    }} placeholder={`Option ${String.fromCharCode(65 + oi)}`} className="flex-1" />
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => {
                  const updated = [...newQuestions];
                  updated[qi].options.push("");
                  setNewQuestions(updated);
                }}>
                  <Plus className="mr-1 h-3 w-3" /> Add Option
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Correct Answer</Label>
                <Select value={typeof q.correctAnswer === "string" ? q.correctAnswer : ""} onValueChange={(v) => {
                  const updated = [...newQuestions];
                  updated[qi].correctAnswer = v;
                  setNewQuestions(updated);
                }}>
                  <SelectTrigger><SelectValue placeholder="Select correct answer" /></SelectTrigger>
                  <SelectContent>
                    {q.options.filter(Boolean).map((opt, oi) => (
                      <SelectItem key={oi} value={opt}>{String.fromCharCode(65 + oi)}. {opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
