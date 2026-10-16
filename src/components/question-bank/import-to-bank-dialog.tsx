"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import { parseTags } from "@/lib/question-bank";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Copies an exam's questions into the question bank. Without examId the user picks one of their exams. */
export function ImportToBankDialog({
  open,
  onOpenChange,
  examId: fixedExamId,
  examTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId?: string;
  examTitle?: string;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [examId, setExamId] = useState("");
  const [tags, setTags] = useState("");
  const targetExamId = fixedExamId ?? examId;

  const { data: examsData, isLoading: examsLoading } = useQuery({
    queryKey: ["exams", "mine-for-bank", user?.uid],
    queryFn: () => api.getExams({ createdBy: user?.role === "admin" ? undefined : user?.uid, size: 100 }),
    enabled: open && !fixedExamId,
  });
  const exams = examsData?.data ?? [];

  const importMutation = useMutation({
    mutationFn: () => api.importExamToBank({ examId: targetExamId, tags: parseTags(tags) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["question-bank"] });
      const r = res.data;
      const skipped = [
        r?.skippedExisting ? `${r.skippedExisting} already in the bank` : null,
        r?.skippedPhraseBound ? `${r.skippedPhraseBound} tied to a passage` : null,
      ].filter(Boolean);
      toast.success(`Added ${r?.imported ?? 0} question(s) to the bank`, {
        description: skipped.length ? `Skipped ${skipped.join(" and ")}.` : undefined,
      });
      setTags("");
      onOpenChange(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Import failed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save questions to the bank</DialogTitle>
          <DialogDescription>
            {fixedExamId
              ? `Copies the questions of "${examTitle ?? "this exam"}" into your question bank so other exams can reuse them.`
              : "Copies an exam's questions into your question bank so other exams can reuse them."}{" "}
            AI-generated questions keep their topic, difficulty and cognitive level. Questions tied to a reading passage are skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!fixedExamId && (
            <div className="space-y-2">
              <Label>Exam</Label>
              <Select value={examId} onValueChange={setExamId} disabled={examsLoading}>
                <SelectTrigger><SelectValue placeholder={examsLoading ? "Loading exams…" : "Choose an exam"} /></SelectTrigger>
                <SelectContent>
                  {exams.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="import-tags">Tags to add (optional)</Label>
            <Input id="import-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. midterm-2026, grade-5" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => importMutation.mutate()} disabled={!targetExamId || importMutation.isPending}>
            {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save to bank
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
