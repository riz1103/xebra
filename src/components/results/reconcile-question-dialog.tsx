"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MathText } from "@/components/math/math-text";
import type { ExamReconciliation, ReconcileQuestionPayload } from "@/types";

type ExistingReconciliation = Pick<ExamReconciliation, "type" | "newCorrectAnswer" | "noAnswerCountsCorrect">;

interface ReconcileQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  question: { id: string; questionText: string; options: string[] } | null;
  existing: ExistingReconciliation | null;
}

/** Override a question's answer key or make it a bonus; every submitted result of the exam is re-scored. */
export function ReconcileQuestionDialog({ open, onOpenChange, examId, question, existing }: ReconcileQuestionDialogProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<"new_answer" | "bonus">("new_answer");
  const [newAnswer, setNewAnswer] = useState("");
  const [noAnswerCountsCorrect, setNoAnswerCountsCorrect] = useState(true);
  const hasOptions = (question?.options.length ?? 0) > 0;

  useEffect(() => {
    if (!open) return;
    setType(existing?.type ?? "new_answer");
    setNewAnswer(
      Array.isArray(existing?.newCorrectAnswer) ? existing.newCorrectAnswer[0] ?? "" : existing?.newCorrectAnswer ?? ""
    );
    setNoAnswerCountsCorrect(existing?.noAnswerCountsCorrect ?? true);
  }, [open, question?.id, existing]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["exam-reconciliations", examId] });
    queryClient.invalidateQueries({ queryKey: ["item-analysis", examId] });
    queryClient.invalidateQueries({ queryKey: ["exam-result"] });
    queryClient.invalidateQueries({ queryKey: ["results"] });
    queryClient.invalidateQueries({ queryKey: ["my-results"] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: ReconcileQuestionPayload) => api.reconcileQuestion(examId, payload),
    onSuccess: (data) => {
      invalidate();
      const updated = data?.data?.resultsUpdated;
      toast.success(updated != null ? `Reconciliation saved. ${updated} result(s) re-scored.` : "Reconciliation saved.");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save reconciliation"),
  });

  const removeMutation = useMutation({
    mutationFn: (questionId: string) => api.removeReconciliation(examId, questionId),
    onSuccess: (data) => {
      invalidate();
      const updated = data?.data?.resultsUpdated;
      toast.success(updated != null ? `Reconciliation removed. ${updated} result(s) re-scored.` : "Reconciliation removed.");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to remove reconciliation"),
  });

  const save = () => {
    if (!question) return;
    const payload: ReconcileQuestionPayload =
      type === "new_answer"
        ? { questionId: question.id, type: "new_answer", newCorrectAnswer: newAnswer.trim() }
        : { questionId: question.id, type: "bonus", noAnswerCountsCorrect };
    saveMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" /> Reconcile question
          </DialogTitle>
          <DialogDescription>
            Override the correct answer or mark this question as bonus (everyone correct). All submitted results for this exam will be re-scored.
          </DialogDescription>
        </DialogHeader>
        {question && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground line-clamp-2"><MathText text={question.questionText} /></p>
            {existing ? (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                <p className="font-medium text-muted-foreground mb-1">Current reconciliation</p>
                <p>
                  {existing.type === "new_answer"
                    ? `Correct answer set to: ${Array.isArray(existing.newCorrectAnswer) ? existing.newCorrectAnswer.join(", ") : existing.newCorrectAnswer}`
                    : `Bonus (no answer counts correct: ${existing.noAnswerCountsCorrect ? "yes" : "no"})`}
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="mt-2 gap-1"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(question.id)}
                >
                  {removeMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  <Trash2 className="h-3 w-3" /> Remove reconciliation
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as "new_answer" | "bonus")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_answer">New correct answer</SelectItem>
                      <SelectItem value="bonus">Bonus (everyone correct)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {type === "new_answer" && (
                  <div className="space-y-2">
                    <Label htmlFor="reconcile-answer">Correct answer</Label>
                    {hasOptions ? (
                      <Select value={newAnswer} onValueChange={setNewAnswer}>
                        <SelectTrigger id="reconcile-answer">
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          {question.options.map((opt, i) => (
                            <SelectItem key={i} value={opt}>
                              {String.fromCharCode(65 + i)}. <MathText text={opt} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="reconcile-answer"
                        value={newAnswer}
                        onChange={(e) => setNewAnswer(e.target.value)}
                        placeholder="Type the accepted answer"
                      />
                    )}
                  </div>
                )}
                {type === "bonus" && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="noAnswerCountsCorrect"
                      checked={noAnswerCountsCorrect}
                      onCheckedChange={(v) => setNoAnswerCountsCorrect(v === true)}
                    />
                    <Label htmlFor="noAnswerCountsCorrect" className="text-sm font-normal">
                      Count no answer as correct
                    </Label>
                  </div>
                )}
              </>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {!existing && (
                <Button
                  disabled={saveMutation.isPending || (type === "new_answer" && !newAnswer.trim())}
                  onClick={save}
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save reconciliation
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
