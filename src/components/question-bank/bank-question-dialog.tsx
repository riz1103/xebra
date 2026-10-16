"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import { getLayoutConfig, isPositionalLayout } from "@/lib/question-layout";
import { parseBlanks } from "@/lib/question-blanks";
import { ANY, DIFFICULTIES, parseTags } from "@/lib/question-bank";
import { draftFromQuestion, emptyDraft, payloadFromDraft, type PositionalDraft } from "@/lib/positional-questions";
import { PositionalQuestionEditor } from "@/components/questions/positional-answer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BankQuestion, BankQuestionPayload, QuestionDifficulty, QuestionMetadata } from "@/types";

interface FormState {
  questionTypeId: string;
  questionText: string;
  options: string[];
  /** Selected options for choice layouts */
  correctChoices: string[];
  /** One accepted answer (or blank answer) per line for typed layouts */
  correctText: string;
  points: string;
  explanation: string;
  rubric: string;
  topic: string;
  difficulty: string;
  cognitiveLevel: string;
  tags: string;
  /** Ordering/matching questions */
  draft: PositionalDraft | null;
}

function initialState(question: BankQuestion | null, defaultTypeId: string): FormState {
  const format = question?.metadata?.answerFormat;
  const answers = question ? [question.correctAnswer].flat().filter(Boolean) : [];
  const hasOptions = (question?.options?.length ?? 0) > 0;
  return {
    questionTypeId: question?.questionTypeId ?? defaultTypeId,
    questionText: question?.questionText ?? "",
    options: question ? [...question.options] : ["", "", "", ""],
    correctChoices: hasOptions ? answers : [],
    correctText: hasOptions ? "" : answers.join("\n"),
    points: String(question?.points ?? 1),
    explanation: question?.explanation ?? "",
    rubric: (question?.metadata?.rubric as string | undefined) ?? question?.metadata?.ai?.rubric ?? "",
    topic: question?.topic ?? "",
    difficulty: question?.difficulty ?? ANY,
    cognitiveLevel: question?.cognitiveLevel ?? "",
    tags: question?.tags?.join(", ") ?? "",
    draft: question && format ? draftFromQuestion(format, question) : null,
  };
}

export function BankQuestionDialog({
  open,
  onOpenChange,
  question,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this question; null creates a new one */
  question: BankQuestion | null;
}) {
  const queryClient = useQueryClient();
  const { data: typesData } = useQuery({
    queryKey: ["question-types", "all"],
    queryFn: () => api.getQuestionTypes({ size: 100 }),
    enabled: open,
  });
  const types = useMemo(() => typesData?.data ?? [], [typesData]);
  const [form, setForm] = useState<FormState>(() => initialState(question, ""));

  useEffect(() => {
    if (open) setForm(initialState(question, types[0]?.id ?? ""));
    // Reset only when the dialog opens or switches question
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, question]);

  useEffect(() => {
    if (open && !form.questionTypeId && types[0]) setForm((f) => ({ ...f, questionTypeId: types[0].id }));
  }, [open, types, form.questionTypeId]);

  const typeName = types.find((t) => t.id === form.questionTypeId)?.name ?? "";
  const layout = getLayoutConfig(typeName);
  const positional = isPositionalLayout(layout.layout) ? layout.layout : null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const changeType = (typeId: string) => {
    const next = getLayoutConfig(types.find((t) => t.id === typeId)?.name ?? "");
    setForm((f) => {
      if (next.layout === layout.layout) return { ...f, questionTypeId: typeId };
      return {
        ...f,
        questionTypeId: typeId,
        options: next.showOptions ? (next.defaultOptions.length ? [...next.defaultOptions] : ["", "", "", ""]) : [],
        correctChoices: [],
        correctText: "",
        draft: isPositionalLayout(next.layout) ? emptyDraft(next.layout) : null,
      };
    });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: BankQuestionPayload) =>
      question ? api.updateBankQuestion(question.id, payload) : api.createBankQuestion(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-bank"] });
      toast.success(question ? "Question updated" : "Question added to the bank");
      onOpenChange(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not save the question")),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.questionTypeId) return toast.error("Choose a question type.");
    if (!form.questionText.trim()) return toast.error("Write the question.");

    let options = layout.showOptions ? form.options.map((o) => o.trim()).filter(Boolean) : [];
    let correctAnswer: string | string[] = "";
    let positionalMetadata: QuestionMetadata | null = null;
    if (positional) {
      const fields = payloadFromDraft(positional, form.draft ?? emptyDraft(positional), question?.metadata ?? {});
      if ("error" in fields) return toast.error(fields.error);
      options = fields.options;
      correctAnswer = fields.correctAnswer;
      positionalMetadata = fields.metadata;
    } else if (layout.showOptions) {
      const chosen = form.correctChoices.filter((c) => options.includes(c));
      if (options.length < 2) return toast.error("Add at least two options.");
      if (chosen.length === 0) return toast.error("Mark at least one correct option.");
      correctAnswer = chosen.length === 1 ? chosen[0] : chosen;
    } else if (layout.showCorrectAnswer) {
      const answers = form.correctText.split("\n").map((a) => a.trim()).filter(Boolean);
      if (answers.length === 0) return toast.error("Enter the correct answer.");
      correctAnswer = answers.length === 1 ? answers[0] : answers;
    }

    const points = Number(form.points);
    if (!Number.isFinite(points) || points <= 0) return toast.error("Points must be a positive number.");

    const metadata: QuestionMetadata = { ...(positionalMetadata ?? question?.metadata ?? {}) };
    if (layout.layout === "essay" && form.rubric.trim()) metadata.rubric = form.rubric.trim();
    else delete metadata.rubric;
    if (layout.correctAnswerIsText && parseBlanks(form.questionText).blankCount > 1) metadata.orderedBlanks = true;
    else delete metadata.orderedBlanks;
    if (!positional) {
      delete metadata.answerFormat;
      delete metadata.matchPrompts;
    }

    saveMutation.mutate({
      questionTypeId: form.questionTypeId,
      questionText: form.questionText.trim(),
      options,
      correctAnswer,
      points,
      explanation: form.explanation.trim(),
      metadata,
      topic: form.topic.trim() || null,
      difficulty: form.difficulty === ANY ? null : (form.difficulty as QuestionDifficulty),
      cognitiveLevel: form.cognitiveLevel.trim() || null,
      tags: parseTags(form.tags),
    });
  };

  const toggleChoice = (option: string, checked: boolean) => {
    if (!option.trim()) return;
    setForm((f) => {
      const single = layout.layout === "true_false";
      const without = f.correctChoices.filter((c) => c !== option);
      return { ...f, correctChoices: checked ? (single ? [option] : [...without, option]) : without };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? "Edit bank question" : "New bank question"}</DialogTitle>
          <DialogDescription>
            Bank questions can be drawn into any of your exams. Editing here doesn&apos;t change exams that already use it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div className="space-y-2">
              <Label>Question type</Label>
              <Select value={form.questionTypeId} onValueChange={changeType}>
                <SelectTrigger><SelectValue placeholder="Choose a type" /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bq-points">Points</Label>
              <Input id="bq-points" type="number" min={0.5} step={0.5} value={form.points} onChange={(e) => set("points", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bq-text">Question</Label>
            <Textarea id="bq-text" rows={3} value={form.questionText} onChange={(e) => set("questionText", e.target.value)} />
          </div>

          {layout.showOptions && (
            <div className="space-y-2">
              <Label>Options (tick the correct {layout.layout === "true_false" ? "one" : "ones"})</Label>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Checkbox
                      checked={!!opt.trim() && form.correctChoices.includes(opt.trim())}
                      onCheckedChange={(c) => toggleChoice(opt.trim(), c === true)}
                      aria-label={`Option ${i + 1} is correct`}
                    />
                    <Input
                      value={opt}
                      disabled={!layout.editableOptions}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      onChange={(e) => {
                        const before = opt.trim();
                        const after = e.target.value;
                        setForm((f) => ({
                          ...f,
                          options: f.options.map((o, oi) => (oi === i ? after : o)),
                          correctChoices: f.correctChoices.map((c) => (c === before ? after.trim() : c)),
                        }));
                      }}
                    />
                    {layout.editableOptions && form.options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label={`Remove option ${i + 1}`}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            options: f.options.filter((_, oi) => oi !== i),
                            correctChoices: f.correctChoices.filter((c) => c !== opt.trim()),
                          }))
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {layout.editableOptions && form.options.length < 10 && (
                <Button type="button" variant="outline" size="sm" onClick={() => set("options", [...form.options, ""])}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add option
                </Button>
              )}
            </div>
          )}

          {!layout.showOptions && layout.showCorrectAnswer && (
            <div className="space-y-2">
              <Label htmlFor="bq-answer">Correct answer</Label>
              <Textarea
                id="bq-answer"
                rows={2}
                value={form.correctText}
                onChange={(e) => set("correctText", e.target.value)}
                placeholder="One per line: accepted answers, or the answer for each blank in order"
              />
            </div>
          )}

          {positional && (
            <PositionalQuestionEditor
              layout={positional}
              draft={form.draft ?? emptyDraft(positional)}
              onChange={(draft) => set("draft", draft)}
            />
          )}

          {layout.layout === "essay" && (
            <div className="space-y-2">
              <Label htmlFor="bq-rubric">Grading rubric</Label>
              <Textarea id="bq-rubric" rows={3} value={form.rubric} onChange={(e) => set("rubric", e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bq-explanation">Explanation</Label>
            <Textarea id="bq-explanation" rows={2} value={form.explanation} onChange={(e) => set("explanation", e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bq-topic">Topic</Label>
              <Input id="bq-topic" value={form.topic} onChange={(e) => set("topic", e.target.value)} placeholder="e.g. Fractions" />
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Not set</SelectItem>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bq-level">Cognitive level</Label>
              <Input id="bq-level" value={form.cognitiveLevel} onChange={(e) => set("cognitiveLevel", e.target.value)} placeholder="e.g. apply" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bq-tags">Tags</Label>
            <Input id="bq-tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="Comma-separated, e.g. grade-5, midterm" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {question ? "Save" : "Add to bank"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
