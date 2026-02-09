"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { examSchema, type ExamFormValues } from "@/lib/validations";
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
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import type { CreateExamQuestionPayload } from "@/types";

export default function CreateExamPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<CreateExamQuestionPayload[]>([]);

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

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        questionTypeId: questionTypes[0]?.id || "",
        questionText: "",
        options: ["", "", "", ""],
        correctAnswer: "",
        points: 1,
        examId: "", // Will be set server-side
      },
    ]);
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
    setQuestions(updated);
  };

  const onSubmit = (values: ExamFormValues) => {
    createMutation.mutate({ ...values, questions });
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
              <CardDescription>Add questions inline or add them later.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="mr-1 h-3 w-3" /> Add Question
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {questions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                No questions added yet. You can add them now or after creating the exam.
              </p>
            ) : (
              questions.map((q, qi) => (
                <div key={qi} className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Question {qi + 1}</h4>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeQuestion(qi)} className="text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
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
                        onValueChange={(v) => updateQuestion(qi, "questionTypeId", v)}
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
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Options</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => addOption(qi)}>
                        <Plus className="mr-1 h-3 w-3" /> Add
                      </Button>
                    </div>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-6">{String.fromCharCode(65 + oi)}.</span>
                        <Input
                          value={opt}
                          onChange={(e) => updateOption(qi, oi, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                          className="flex-1"
                        />
                        {q.options.length > 2 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(qi, oi)} className="shrink-0">
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label>Correct Answer</Label>
                    <Select
                      value={typeof q.correctAnswer === "string" ? q.correctAnswer : ""}
                      onValueChange={(v) => updateQuestion(qi, "correctAnswer", v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Select correct answer" /></SelectTrigger>
                      <SelectContent>
                        {q.options.filter(Boolean).map((opt, oi) => (
                          <SelectItem key={oi} value={opt}>{String.fromCharCode(65 + oi)}. {opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
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
