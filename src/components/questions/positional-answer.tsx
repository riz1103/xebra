"use client";

import { ArrowDown, ArrowUp, CheckCircle, Plus, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MathText } from "@/components/math/math-text";
import type { PositionalLayout } from "@/lib/question-layout";
import type { PositionalDraft } from "@/lib/positional-questions";
import { cn } from "@/lib/utils";
import type { ExamQuestion } from "@/types";

const move = <T,>(list: T[], from: number, to: number): T[] => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

// ============ Authoring ============

export function PositionalQuestionEditor({
  layout,
  draft,
  onChange,
}: {
  layout: PositionalLayout;
  draft: PositionalDraft;
  onChange: (draft: PositionalDraft) => void;
}) {
  if (layout === "ordering") {
    const items = draft.items;
    const setItems = (next: string[]) => onChange({ ...draft, items: next });
    return (
      <div className="space-y-2">
        <Label className="text-xs">Items in the correct order</Label>
        <p className="text-xs text-muted-foreground">Examinees see these shuffled and put them back in this order.</p>
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
            <Input value={item} onChange={(e) => setItems(items.map((v, j) => (j === i ? e.target.value : v)))} placeholder={`Item ${i + 1}`} />
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={i === 0} onClick={() => setItems(move(items, i, i - 1))} aria-label={`Move item ${i + 1} up`}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={i === items.length - 1} onClick={() => setItems(move(items, i, i + 1))} aria-label={`Move item ${i + 1} down`}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={items.length <= 2} onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={`Remove item ${i + 1}`}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
        {items.length < 12 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setItems([...items, ""])}>
            <Plus className="mr-1 h-3 w-3" /> Add item
          </Button>
        )}
      </div>
    );
  }

  const { prompts, responses, distractors } = draft;
  const setPair = (i: number, field: "prompts" | "responses", value: string) =>
    onChange({ ...draft, [field]: draft[field].map((v, j) => (j === i ? value : v)) });
  return (
    <div className="space-y-2">
      <Label className="text-xs">Pairs</Label>
      <p className="text-xs text-muted-foreground">Examinees pick the right match for each prompt from a shuffled list.</p>
      {prompts.map((prompt, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <Input value={prompt} onChange={(e) => setPair(i, "prompts", e.target.value)} placeholder={`Prompt ${i + 1}`} aria-label={`Prompt ${i + 1}`} />
          <Input value={responses[i] ?? ""} onChange={(e) => setPair(i, "responses", e.target.value)} placeholder="Its match" aria-label={`Match for prompt ${i + 1}`} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={prompts.length <= 2}
            onClick={() => onChange({ ...draft, prompts: prompts.filter((_, j) => j !== i), responses: responses.filter((_, j) => j !== i) })}
            aria-label={`Remove pair ${i + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      {prompts.length < 12 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...draft, prompts: [...prompts, ""], responses: [...responses, ""] })}>
          <Plus className="mr-1 h-3 w-3" /> Add pair
        </Button>
      )}
      <Label className="block pt-2 text-xs">Extra wrong matches (optional)</Label>
      {distractors.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={d} onChange={(e) => onChange({ ...draft, distractors: distractors.map((v, j) => (j === i ? e.target.value : v)) })} placeholder="Distractor" />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onChange({ ...draft, distractors: distractors.filter((_, j) => j !== i) })} aria-label={`Remove distractor ${i + 1}`}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      {distractors.length < 6 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...draft, distractors: [...distractors, ""] })}>
          <Plus className="mr-1 h-3 w-3" /> Add distractor
        </Button>
      )}
    </div>
  );
}

// ============ Taking the exam ============

/** Reorder list. value is null until the examinee confirms or moves something. */
export function OrderingInput({
  items,
  value,
  onChange,
  disabled,
}: {
  items: string[];
  value: string[] | null;
  onChange: (order: string[]) => void;
  disabled?: boolean;
}) {
  const order = value && value.length === items.length ? value : items;
  return (
    <div className="space-y-2">
      <ol className="space-y-2" aria-label="Items to put in order">
        {order.map((item, i) => (
          <li key={item} className="flex items-center gap-2 rounded-lg border p-3">
            <span className="w-6 shrink-0 text-sm font-medium text-muted-foreground">{i + 1}.</span>
            <MathText text={item} className="min-w-0 flex-1 text-sm" />
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={disabled || i === 0} onClick={() => onChange(move(order, i, i - 1))} aria-label={`Move "${item}" up`}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={disabled || i === order.length - 1} onClick={() => onChange(move(order, i, i + 1))} aria-label={`Move "${item}" down`}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ol>
      {!value && !disabled && (
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange(order)}>
          Keep this order as my answer
        </Button>
      )}
    </div>
  );
}

const UNSET = "__unset__";

/** One dropdown per prompt; value[i] is the chosen response for prompts[i]. */
export function MatchingInput({
  prompts,
  options,
  value,
  onChange,
  disabled,
}: {
  prompts: string[];
  options: string[];
  value: string[] | null;
  onChange: (answer: string[]) => void;
  disabled?: boolean;
}) {
  const current = prompts.map((_, i) => value?.[i] ?? "");
  return (
    <div className="space-y-2">
      {prompts.map((prompt, i) => (
        <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_minmax(0,1fr)] sm:items-center">
          <MathText text={prompt} className="text-sm font-medium" />
          <Select
            value={current[i] || UNSET}
            disabled={disabled}
            onValueChange={(v) => onChange(current.map((c, j) => (j === i ? (v === UNSET ? "" : v) : c)))}
          >
            <SelectTrigger aria-label={`Match for: ${prompt}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>Choose a match…</SelectItem>
              {options.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

// ============ Review ============

/** Answer key for proctors: the correct sequence, or each prompt with its match plus unused distractors. */
export function PositionalAnswerKey({ question }: { question: ExamQuestion }) {
  const key = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];

  if (question.metadata?.answerFormat === "matching") {
    const prompts = question.metadata.matchPrompts ?? [];
    const distractors = question.options.filter((o) => !key.includes(o));
    return (
      <div className="space-y-1.5">
        {prompts.map((prompt, i) => (
          <div key={i} className="flex items-start gap-2 rounded px-2 py-1 text-sm">
            <MathText text={prompt} className="min-w-0 flex-1 break-words" />
            <span className="shrink-0 text-muted-foreground">→</span>
            <MathText text={key[i] ?? ""} className="min-w-0 flex-1 break-words font-medium text-emerald-700 dark:text-emerald-400" />
          </div>
        ))}
        {distractors.length > 0 && (
          <p className="px-2 text-xs text-muted-foreground">Distractors: {distractors.join(", ")}</p>
        )}
      </div>
    );
  }

  return (
    <ol className="space-y-1">
      {key.map((item, i) => (
        <li key={i} className="flex items-center gap-2 rounded px-2 py-1 text-sm">
          <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
          <MathText text={item} className="min-w-0 break-words" />
        </li>
      ))}
    </ol>
  );
}

export function PositionalAnswerReview({
  question,
  answer,
  label,
}: {
  question: ExamQuestion;
  answer: string[];
  label: string;
}) {
  const key = Array.isArray(question.correctAnswer) ? question.correctAnswer : null;
  const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

  if (question.metadata?.answerFormat === "matching") {
    const prompts = question.metadata.matchPrompts ?? [];
    return (
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2 font-medium">Prompt</th>
              <th className="p-2 font-medium">{label}</th>
              {key && <th className="p-2 font-medium">Correct match</th>}
            </tr>
          </thead>
          <tbody>
            {prompts.map((prompt, i) => {
              const ok = key ? same(answer[i], key[i]) : null;
              return (
                <tr key={i} className="border-t">
                  <td className="p-2"><MathText text={prompt} /></td>
                  <td className={cn("p-2", ok === true && "text-emerald-700 dark:text-emerald-400", ok === false && "text-red-700 dark:text-red-400")}>
                    <span className="inline-flex items-center gap-1.5">
                      {ok === true && <CheckCircle className="h-3.5 w-3.5 shrink-0" />}
                      {ok === false && <XCircle className="h-3.5 w-3.5 shrink-0" />}
                      {answer[i] ? <MathText text={answer[i]} /> : <span className="italic text-muted-foreground">No answer</span>}
                    </span>
                  </td>
                  {key && <td className="p-2 text-emerald-700 dark:text-emerald-400"><MathText text={key[i] ?? ""} /></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", key && "sm:grid-cols-2")}>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {answer.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No answer</p>
        ) : (
          <ol className="space-y-1.5">
            {answer.map((item, i) => {
              const ok = key ? same(item, key[i]) : null;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                    ok === true && "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
                    ok === false && "border-red-400 bg-red-50 dark:bg-red-950/30"
                  )}
                >
                  <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
                  <MathText text={item} className="flex-1" />
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {key && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Correct order</p>
          <ol className="space-y-1.5">
            {key.map((item, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md border border-emerald-300 px-3 py-2 text-sm dark:border-emerald-800">
                <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
                <MathText text={item} className="flex-1" />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
