"use client";

import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CheckCircle, FileUp, Loader2, MinusCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import { parseInviteList, runWithConcurrency } from "@/lib/bulk-invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TimeMultiplierSelect } from "@/components/invitations/time-multiplier-select";

const MAX_ROWS = 500;
const CONCURRENCY = 4;

type RowStatus = "sent" | "skipped" | "failed";
interface RowResult {
  email: string;
  status: RowStatus;
  message?: string;
}

interface BulkInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exams: { id: string; title: string }[];
  bundles: { id: string; name: string }[];
}

const defaultExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined);
const isDuplicateError = (err: unknown) =>
  axios.isAxiosError(err) && err.response?.status === 400 && /already exists/i.test(apiErrorMessage(err, ""));

/** Invite a list of emails (pasted or from a CSV file) to one exam or bundle with shared settings. */
export function BulkInviteDialog({ open, onOpenChange, exams, bundles }: BulkInviteDialogProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<"exam" | "bundle">("exam");
  const [targetId, setTargetId] = useState("");
  const [text, setText] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [scheduledEndTime, setScheduledEndTime] = useState("");
  const [timeMultiplier, setTimeMultiplier] = useState(1);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RowResult[]>([]);
  const [abortMessage, setAbortMessage] = useState<string | null>(null);

  const parsed = useMemo(() => parseInviteList(text), [text]);
  const tooMany = parsed.emails.length > MAX_ROWS;
  const done = !running && results.length > 0;
  const counts = useMemo(
    () => ({
      sent: results.filter((r) => r.status === "sent").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
    }),
    [results]
  );

  const reset = () => {
    setText("");
    setResults([]);
    setAbortMessage(null);
    setTargetId("");
    setExpiresAt(defaultExpiry());
    setMaxAttempts(1);
    setScheduledStartTime("");
    setScheduledEndTime("");
    setTimeMultiplier(1);
  };

  const handleOpenChange = (next: boolean) => {
    if (running) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error("That file is larger than 1 MB. Export only the email column and try again.");
      return;
    }
    setText(await file.text());
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = async () => {
    if (!targetId || parsed.emails.length === 0 || tooMany) return;
    if (scheduledStartTime && scheduledEndTime && new Date(scheduledEndTime) <= new Date(scheduledStartTime)) {
      toast.error("The end time must be after the start time.");
      return;
    }

    setRunning(true);
    setResults([]);
    setAbortMessage(null);
    let aborted: string | null = null;
    const shared = {
      expiresAt: scheduledEndTime ? toIso(scheduledEndTime)! : toIso(expiresAt)!,
      maxAttempts: Math.max(1, Number(maxAttempts) || 1),
      scheduledStartTime: toIso(scheduledStartTime),
      scheduledEndTime: toIso(scheduledEndTime),
      accommodations: timeMultiplier > 1 ? { timeMultiplier } : null,
    };

    await runWithConcurrency(
      parsed.emails,
      CONCURRENCY,
      async (email) => {
        let row: RowResult;
        try {
          if (target === "exam") {
            await api.createExamInvitation({ examId: targetId, examineeEmail: email, ...shared });
            row = { email, status: "sent" };
          } else {
            const res = await api.createBundleInvitation({ bundleId: targetId, examineeEmail: email, ...shared });
            const created = (res.data as { createdCount?: number } | undefined)?.createdCount;
            row = created === 0 ? { email, status: "skipped", message: "Already invited" } : { email, status: "sent" };
          }
        } catch (err) {
          if (isDuplicateError(err)) {
            row = { email, status: "skipped", message: "Already invited" };
          } else {
            const message = apiErrorMessage(err, "Failed");
            row = { email, status: "failed", message };
            // Other 400s (dates, missing exam) would fail for every row
            if (axios.isAxiosError(err) && err.response && err.response.status < 500 && err.response.status !== 429) {
              aborted = message;
            }
          }
        }
        setResults((prev) => [...prev, row]);
      },
      () => aborted != null
    );

    setRunning(false);
    setAbortMessage(aborted);
    queryClient.invalidateQueries({ queryKey: ["invitations"] });
  };

  const targetOptions = target === "exam" ? exams.map((e) => ({ id: e.id, label: e.title })) : bundles.map((b) => ({ id: b.id, label: b.name }));
  const progress = parsed.emails.length > 0 ? (results.length / parsed.emails.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk invite from a list</DialogTitle>
          <DialogDescription>
            Upload a CSV or paste emails. People without an account can sign up with the invited email.
          </DialogDescription>
        </DialogHeader>

        {!running && !done && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label>Invite to</Label>
                <Select
                  value={target}
                  onValueChange={(v) => {
                    setTarget(v as "exam" | "bundle");
                    setTargetId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="bundle">Bundle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{target === "exam" ? "Exam" : "Bundle"} *</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${target}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {targetOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="bulk-emails">Emails *</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileRef.current?.click()}>
                  <FileUp className="mr-1.5 h-3.5 w-3.5" /> Upload CSV
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
              <Textarea
                id="bulk-emails"
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"name,email\nAna Cruz,ana@example.com\nben@example.com"}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {parsed.emails.length} unique email{parsed.emails.length === 1 ? "" : "s"}
                {parsed.duplicates > 0 && ` · ${parsed.duplicates} duplicate(s) ignored`}
                {parsed.invalid.length > 0 && ` · ${parsed.invalid.length} row(s) without a valid email`}
              </p>
              {tooMany && (
                <p className="text-xs text-destructive">Send at most {MAX_ROWS} emails at a time. Split the list and try again.</p>
              )}
              {parsed.invalid.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Show skipped rows</summary>
                  <ul className="mt-1 max-h-24 overflow-auto">
                    {parsed.invalid.slice(0, 50).map((r) => (
                      <li key={r.line}>
                        Line {r.line}: {r.text}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Expires</Label>
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={!!scheduledEndTime} />
              </div>
              <div className="space-y-2">
                <Label>Max attempts</Label>
                <Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Start time (optional)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledStartTime}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End time (optional)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledEndTime}
                  min={scheduledStartTime || new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setScheduledEndTime(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Extra time for everyone on this list</Label>
                <TimeMultiplierSelect value={timeMultiplier} onChange={setTimeMultiplier} />
              </div>
            </div>
          </div>
        )}

        {(running || done) && (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{running ? "Sending invitations…" : abortMessage ? "Stopped" : "Finished"}</span>
                <span className="tabular-nums text-muted-foreground">
                  {results.length}/{parsed.emails.length}
                </span>
              </div>
              <Progress value={progress} />
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-4 w-4" /> {counts.sent} sent
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <MinusCircle className="h-4 w-4" /> {counts.skipped} already invited
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="h-4 w-4" /> {counts.failed} failed
              </span>
            </div>
            {abortMessage && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
                Stopped early: {abortMessage}
              </p>
            )}
            {results.some((r) => r.status !== "sent") && (
              <ScrollArea className="max-h-40 rounded-md border">
                <ul className="divide-y text-xs">
                  {results
                    .filter((r) => r.status !== "sent")
                    .map((r) => (
                      <li key={r.email} className="flex justify-between gap-2 px-2 py-1.5">
                        <span className="truncate">{r.email}</span>
                        <span className={r.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{r.message}</span>
                      </li>
                    ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter>
          {done ? (
            <>
              <Button variant="outline" onClick={() => { setResults([]); setAbortMessage(null); }}>
                Back
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={running} onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={running || !targetId || parsed.emails.length === 0 || tooMany} onClick={send}>
                {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send {parsed.emails.length || ""} invitation{parsed.emails.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
