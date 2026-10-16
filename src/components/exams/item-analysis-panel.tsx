"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Scale } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MathText } from "@/components/math/math-text";
import { ReconcileQuestionDialog } from "@/components/results/reconcile-question-dialog";
import type { ItemAnalysisFlag, ItemAnalysisItem } from "@/types";

const FLAG_INFO: Record<ItemAnalysisFlag, { label: string; hint: string; tone: "warn" | "bad" | "muted" }> = {
  too_hard: { label: "Very hard", hint: "Fewer than 30% answered correctly. Check the key or wording.", tone: "warn" },
  too_easy: { label: "Very easy", hint: "More than 90% answered correctly.", tone: "muted" },
  negative_discrimination: {
    label: "Negative discrimination",
    hint: "Low scorers did better than high scorers on this item. The key may be wrong.",
    tone: "bad",
  },
  low_discrimination: {
    label: "Low discrimination",
    hint: "Barely separates strong and weak examinees.",
    tone: "warn",
  },
  distractor_beats_key: {
    label: "Distractor beats key",
    hint: "A wrong option was picked more often than the correct one.",
    tone: "bad",
  },
  key_not_in_options: {
    label: "Key not in options",
    hint: "The correct answer doesn't match any option, so nobody can get it right.",
    tone: "bad",
  },
  few_attempts: { label: "Few attempts", hint: "Too few results for reliable statistics.", tone: "muted" },
};

type SortMode = "order" | "flagged" | "hardest" | "discrimination";

const pct = (value: number | null) => (value == null ? "—" : `${Math.round(value * 100)}%`);

function difficultyTone(value: number | null) {
  if (value == null) return "text-muted-foreground";
  if (value < 0.3) return "text-red-600 dark:text-red-400";
  if (value > 0.9) return "text-muted-foreground";
  return "text-emerald-600 dark:text-emerald-400";
}

function discriminationTone(value: number | null) {
  if (value == null) return "text-muted-foreground";
  if (value < 0) return "text-red-600 dark:text-red-400";
  if (value < 0.2) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

const severity = (item: ItemAnalysisItem) =>
  item.flags.reduce((sum, f) => sum + (FLAG_INFO[f].tone === "bad" ? 3 : FLAG_INFO[f].tone === "warn" ? 2 : 0), 0);

interface ItemAnalysisPanelProps {
  examId: string;
  /** Question IDs in display order, so item numbers match the Questions tab */
  questionOrder: string[];
}

export function ItemAnalysisPanel({ examId, questionOrder }: ItemAnalysisPanelProps) {
  const [sort, setSort] = useState<SortMode>("order");
  const [reconcileItem, setReconcileItem] = useState<ItemAnalysisItem | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["item-analysis", examId],
    queryFn: () => api.getItemAnalysis(examId),
  });
  const analysis = data?.data;

  const numbered = useMemo(() => {
    const position = new Map(questionOrder.map((qid, i) => [qid, i]));
    return [...(analysis?.items ?? [])]
      .sort((a, b) => (position.get(a.questionId) ?? Infinity) - (position.get(b.questionId) ?? Infinity))
      .map((item, i) => ({ item, number: i + 1 }));
  }, [analysis, questionOrder]);

  const sorted = useMemo(() => {
    const list = [...numbered];
    if (sort === "flagged") list.sort((a, b) => severity(b.item) - severity(a.item) || a.number - b.number);
    if (sort === "hardest") list.sort((a, b) => (a.item.difficulty ?? 2) - (b.item.difficulty ?? 2));
    if (sort === "discrimination") list.sort((a, b) => (a.item.discrimination ?? 2) - (b.item.discrimination ?? 2));
    return list;
  }, [numbered, sort]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !analysis) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {(error as Error | null)?.message || "Item analysis is not available."}
        </CardContent>
      </Card>
    );
  }

  if (analysis.totalResults === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <BarChart3 className="h-8 w-8" />
          No submitted results yet. Statistics appear once examinees finish the exam.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Results" value={String(analysis.totalResults)} />
        <SummaryStat
          label="Average score"
          value={analysis.averagePercentage == null ? "—" : `${analysis.averagePercentage}%`}
        />
        <SummaryStat
          label="Std. deviation"
          value={analysis.standardDeviation == null ? "—" : String(analysis.standardDeviation)}
        />
        <SummaryStat
          label="Flagged items"
          value={String(analysis.flaggedCount)}
          highlight={analysis.flaggedCount > 0}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Per-question statistics</CardTitle>
            <CardDescription>
              Difficulty is the share answered correctly. Discrimination compares the top and bottom{" "}
              {analysis.groupSize > 0 ? `${analysis.groupSize} examinees` : "27% of examinees"}
              {analysis.groupSize === 0 && " (needs at least 5 results)"}; higher is better.
            </CardDescription>
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
            <SelectTrigger className="w-[11rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="order">Question order</SelectItem>
              <SelectItem value="flagged">Flagged first</SelectItem>
              <SelectItem value="hardest">Hardest first</SelectItem>
              <SelectItem value="discrimination">Lowest discrimination</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.map(({ item, number }) => (
            <ItemRow key={item.questionId} item={item} number={number} onReconcile={() => setReconcileItem(item)} />
          ))}
        </CardContent>
      </Card>

      <ReconcileQuestionDialog
        open={reconcileItem != null}
        onOpenChange={(open) => !open && setReconcileItem(null)}
        examId={examId}
        question={
          reconcileItem
            ? { id: reconcileItem.questionId, questionText: reconcileItem.questionText, options: reconcileItem.options }
            : null
        }
        existing={reconcileItem?.reconciliation ?? null}
      />
    </div>
  );
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold", highlight && "text-amber-600 dark:text-amber-400")}>{value}</p>
    </div>
  );
}

function ItemRow({ item, number, onReconcile }: { item: ItemAnalysisItem; number: number; onReconcile: () => void }) {
  const totalPicks = item.optionDistribution.reduce((s, o) => s + o.count, 0) + item.otherAnswers;
  const isBonus = item.reconciliation?.type === "bonus";

  return (
    <div className="rounded-lg border p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 text-sm font-medium break-words">
          Q{number}. <MathText text={item.questionText} />
          {item.partName && <span className="ml-2 text-xs font-normal text-muted-foreground">({item.partName})</span>}
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onReconcile}>
          <Scale className="h-3.5 w-3.5" /> {item.reconciliation ? "Edit reconciliation" : "Reconcile"}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {item.reconciliation && (
          <Badge variant="secondary" className="text-xs">
            Reconciled: {isBonus ? "bonus" : "new answer"}
          </Badge>
        )}
        {item.status !== "active" && (
          <Badge variant="outline" className="text-xs">
            {item.status}
          </Badge>
        )}
        {item.flags.map((flag) => {
          const info = FLAG_INFO[flag];
          return (
            <Badge
              key={flag}
              variant="outline"
              title={info.hint}
              className={cn(
                "gap-1 text-xs",
                info.tone === "bad" && "border-red-500/50 text-red-600 dark:text-red-400",
                info.tone === "warn" && "border-amber-500/50 text-amber-600 dark:text-amber-400",
                info.tone === "muted" && "text-muted-foreground"
              )}
            >
              {info.tone !== "muted" && <AlertTriangle className="h-3 w-3" />}
              {info.label}
            </Badge>
          );
        })}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Difficulty</dt>
          <dd className={cn("text-sm font-semibold", difficultyTone(item.difficulty))}>{pct(item.difficulty)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Discrimination</dt>
          <dd className={cn("text-sm font-semibold", discriminationTone(item.discrimination))}>
            {item.discrimination == null ? "—" : item.discrimination.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Correct</dt>
          <dd className="text-sm font-semibold">
            {item.correct}/{item.attempts - item.pendingReview}
            {item.pendingReview > 0 && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">+{item.pendingReview} pending</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Unanswered</dt>
          <dd className="text-sm font-semibold">{pct(item.unansweredRate)}</dd>
        </div>
      </dl>

      {item.optionDistribution.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {item.optionDistribution.map((o, i) => {
            const share = totalPicks > 0 ? o.count / totalPicks : 0;
            return (
              <div key={i} className="grid grid-cols-[1.25rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs">
                <span className="text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                <div className="relative overflow-hidden rounded bg-muted">
                  <div
                    className={cn("absolute inset-y-0 left-0", o.isCorrect ? "bg-emerald-500/30" : "bg-primary/15")}
                    style={{ width: `${Math.round(share * 100)}%` }}
                  />
                  <div className={cn("relative truncate px-2 py-1", o.isCorrect && "font-medium text-emerald-700 dark:text-emerald-400")}>
                    <MathText text={o.option} />
                  </div>
                </div>
                <span className="text-right tabular-nums text-muted-foreground">
                  {o.count} ({Math.round(share * 100)}%)
                </span>
              </div>
            );
          })}
          {item.otherAnswers > 0 && (
            <p className="text-xs text-muted-foreground">
              {item.otherAnswers} answer(s) didn&apos;t match any current option.
            </p>
          )}
        </div>
      )}

      {item.optionDistribution.length === 0 && item.topTextAnswers.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted-foreground">Most common answers</p>
          <div className="flex flex-wrap gap-1.5">
            {item.topTextAnswers.map((a) => (
              <Badge
                key={a.answer}
                variant="outline"
                className={cn("text-xs font-normal", a.correct && "border-emerald-500/50 text-emerald-700 dark:text-emerald-400")}
              >
                {a.answer} × {a.count}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
