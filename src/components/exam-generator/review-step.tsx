"use client";

import { AlertTriangle, BookOpen, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LAYOUT_LABELS, QUESTION_LAYOUTS } from "@/lib/exam-blueprint";
import type { GeneratedQuestion, GenerationResult } from "@/lib/exam-generator";
import { QuestionSource } from "./question-source";

function QuestionPreview({
  question: q,
  number,
  selected,
  onToggle,
}: {
  question: GeneratedQuestion;
  number: number;
  selected: boolean;
  onToggle: (selected: boolean) => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        q.issues.length > 0 ? "border-amber-300 dark:border-amber-700" : ""
      } ${selected ? "" : "opacity-50"}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} onCheckedChange={(v) => onToggle(!!v)} className="mt-0.5" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">#{number}</span>
            <Badge variant="outline" className="text-[10px] capitalize">{q.difficulty}</Badge>
            <Badge variant="outline" className="text-[10px] capitalize">{q.cognitiveLevel}</Badge>
            {q.topic && <Badge variant="secondary" className="text-[10px]">{q.topic}</Badge>}
          </div>
          <p className="text-sm whitespace-pre-wrap">{q.questionText}</p>

          {q.options.length > 0 && (
            <ul className="space-y-1">
              {q.options.map((opt, i) => {
                const correct = q.correctIndexes.includes(i);
                return (
                  <li
                    key={i}
                    className={`flex items-start gap-2 text-sm ${correct ? "font-medium text-emerald-700 dark:text-emerald-400" : ""}`}
                  >
                    <span className="w-5 shrink-0 text-xs text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                    <span className="flex-1">{opt}</span>
                    {correct && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                  </li>
                );
              })}
            </ul>
          )}

          {q.acceptedAnswers.length > 0 && (
            <p className="text-sm">
              <span className="text-xs text-muted-foreground">Answer: </span>
              <span className="font-medium text-emerald-700 dark:text-emerald-400">{q.acceptedAnswers.join(" / ")}</span>
            </p>
          )}

          {q.rubric && (
            <div className="rounded bg-muted/50 p-2 text-xs">
              <span className="font-medium">Rubric: </span>
              <span className="whitespace-pre-wrap">{q.rubric}</span>
            </div>
          )}

          {q.explanation && <p className="text-xs text-muted-foreground">{q.explanation}</p>}
          <QuestionSource source={q} />

          {q.issues.map((issue) => (
            <p key={issue} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {issue}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReviewStep({
  result,
  selectedIds,
  onSelectedIdsChange,
}: {
  result: GenerationResult;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
}) {
  const toggle = (id: string, selected: boolean) => {
    const next = new Set(selectedIds);
    if (selected) next.add(id);
    else next.delete(id);
    onSelectedIdsChange(next);
  };
  const allSelected = selectedIds.size === result.questions.length;
  let number = 0;

  return (
    <div className="space-y-5">
      {result.warnings.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50/50 p-3 dark:border-amber-700 dark:bg-amber-950/20">
          {result.warnings.map((w) => (
            <p key={w} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedIds.size} of {result.questions.length} questions selected. You can still edit everything after adding.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSelectedIdsChange(allSelected ? new Set() : new Set(result.questions.map((q) => q.id)))}
        >
          {allSelected ? "Deselect all" : "Select all"}
        </Button>
      </div>

      {result.passages.map((passage) => {
        const questions = result.questions.filter((q) => q.passageId === passage.id);
        if (questions.length === 0) return null;
        return (
          <div key={passage.id} className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="h-4 w-4" /> Reading passage{passage.title ? `: ${passage.title}` : ""}
            </h4>
            <div className="max-h-48 overflow-y-auto rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap">
              {passage.body}
            </div>
            {questions.map((q) => (
              <QuestionPreview
                key={q.id}
                question={q}
                number={++number}
                selected={selectedIds.has(q.id)}
                onToggle={(v) => toggle(q.id, v)}
              />
            ))}
          </div>
        );
      })}

      {QUESTION_LAYOUTS.map((layout) => {
        const questions = result.questions.filter((q) => !q.passageId && q.layout === layout);
        if (questions.length === 0) return null;
        return (
          <div key={layout} className="space-y-2">
            <h4 className="text-sm font-semibold">
              {LAYOUT_LABELS[layout]} <span className="font-normal text-muted-foreground">({questions.length})</span>
            </h4>
            {questions.map((q) => (
              <QuestionPreview
                key={q.id}
                question={q}
                number={++number}
                selected={selectedIds.has(q.id)}
                onToggle={(v) => toggle(q.id, v)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
