"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Plus, Shuffle, X } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import { ANY, DIFFICULTIES } from "@/lib/question-bank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BankAssembleResult, BankDrawRule, ExamPart, QuestionDifficulty } from "@/types";

interface RuleRow {
  key: number;
  count: string;
  topic: string;
  difficulty: string;
  tag: string;
}

let nextKey = 1;
const newRule = (): RuleRow => ({ key: nextKey++, count: "5", topic: ANY, difficulty: ANY, tag: ANY });

function toRules(rows: RuleRow[]): BankDrawRule[] | null {
  const rules: BankDrawRule[] = [];
  for (const row of rows) {
    const count = Number(row.count);
    if (!Number.isInteger(count) || count < 1) return null;
    rules.push({
      count,
      topic: row.topic === ANY ? null : row.topic,
      difficulty: row.difficulty === ANY ? null : (row.difficulty as QuestionDifficulty),
      tags: row.tag === ANY ? [] : [row.tag],
    });
  }
  return rules;
}

/** Draws questions from the bank into an exam using rules like "10 easy + 5 hard from Fractions". */
export function AssembleFromBankDialog({
  open,
  onOpenChange,
  examId,
  parts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  parts?: ExamPart[];
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<RuleRow[]>(() => [newRule()]);
  const [partId, setPartId] = useState<string>(ANY);
  const [preview, setPreview] = useState<BankAssembleResult | null>(null);

  useEffect(() => {
    if (open) {
      setRows([newRule()]);
      setPartId(parts?.[0]?.id ?? ANY);
      setPreview(null);
    }
  }, [open, parts]);

  const { data: bankData, isLoading: bankLoading } = useQuery({
    queryKey: ["question-bank", "facets"],
    queryFn: () => api.getBankQuestions({ size: 1 }),
    enabled: open,
  });
  const facets = bankData?.facets;

  const rules = toRules(rows);
  const payload = rules ? { examId, partId: partId === ANY ? null : partId, rules } : null;

  const previewMutation = useMutation({
    mutationFn: () => api.assembleFromBank({ ...payload!, dryRun: true }),
    onSuccess: (res) => setPreview(res.data ?? null),
    onError: (err) => toast.error(apiErrorMessage(err, "Could not check the bank")),
  });

  const assembleMutation = useMutation({
    mutationFn: () => api.assembleFromBank({ ...payload!, dryRun: false }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["exam", examId] });
      queryClient.invalidateQueries({ queryKey: ["question-bank"] });
      const short = res.data?.rules.reduce((sum, r) => sum + r.shortBy, 0) ?? 0;
      toast.success(`Added ${res.data?.totalDrawn ?? 0} question(s) from the bank`, {
        description: short ? `${short} fewer than requested: not enough matching questions.` : undefined,
      });
      onOpenChange(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not add questions")),
  });

  const updateRow = (key: number, patch: Partial<RuleRow>) => {
    setPreview(null);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const busy = previewMutation.isPending || assembleMutation.isPending;
  const total = rules?.reduce((s, r) => s + r.count, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shuffle className="h-5 w-5" /> Add questions from the bank</DialogTitle>
          <DialogDescription>
            Each rule draws random questions matching its filters. A question is never drawn twice, and questions
            already in this exam are skipped.
          </DialogDescription>
        </DialogHeader>

        {bankLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !facets?.total ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Your question bank is empty. Save questions from an existing exam or add them on the Question Bank page first.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{facets.total} question(s) in your bank.</p>
            {parts && parts.length > 0 && (
              <div className="space-y-2">
                <Label>Add to part</Label>
                <Select value={partId} onValueChange={(v) => { setPartId(v); setPreview(null); }}>
                  <SelectTrigger className="sm:w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {parts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3">
              {rows.map((row, i) => {
                const result = preview?.rules[i];
                return (
                  <div key={row.key} className="rounded-lg border p-3">
                    <div className="grid gap-2 sm:grid-cols-[80px_1fr_130px_1fr_auto] sm:items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Count</Label>
                        <Input type="number" min={1} value={row.count} onChange={(e) => updateRow(row.key, { count: e.target.value })} aria-label={`Rule ${i + 1} count`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Topic</Label>
                        <Select value={row.topic} onValueChange={(v) => updateRow(row.key, { topic: v })}>
                          <SelectTrigger aria-label={`Rule ${i + 1} topic`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ANY}>Any topic</SelectItem>
                            {facets.topics.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.value} ({t.count})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Difficulty</Label>
                        <Select value={row.difficulty} onValueChange={(v) => updateRow(row.key, { difficulty: v })}>
                          <SelectTrigger aria-label={`Rule ${i + 1} difficulty`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ANY}>Any</SelectItem>
                            {DIFFICULTIES.map((d) => (
                              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tag</Label>
                        <Select value={row.tag} onValueChange={(v) => updateRow(row.key, { tag: v })}>
                          <SelectTrigger aria-label={`Rule ${i + 1} tag`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ANY}>Any tag</SelectItem>
                            {facets.tags.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.value} ({t.count})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        disabled={rows.length === 1}
                        onClick={() => { setPreview(null); setRows((rs) => rs.filter((r) => r.key !== row.key)); }}
                        aria-label={`Remove rule ${i + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {result && (
                      <p className={`mt-2 flex items-center gap-1.5 text-xs ${result.shortBy ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                        {result.shortBy > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
                        {result.shortBy > 0
                          ? `Only ${result.drawn} of ${result.count} available (${result.available} match).`
                          : `${result.drawn} will be drawn from ${result.available} matching.`}
                      </p>
                    )}
                  </div>
                );
              })}
              {rows.length < 20 && (
                <Button variant="outline" size="sm" onClick={() => { setPreview(null); setRows((rs) => [...rs, newRule()]); }}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add rule
                </Button>
              )}
            </div>
            {!rules && <p className="text-xs text-destructive">Each rule needs a whole-number count of at least 1.</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="outline" onClick={() => previewMutation.mutate()} disabled={!payload || !facets?.total || busy}>
            {previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Check availability
          </Button>
          <Button onClick={() => assembleMutation.mutate()} disabled={!payload || !facets?.total || busy || preview?.totalDrawn === 0}>
            {assembleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {preview ? preview.totalDrawn : total} question(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
