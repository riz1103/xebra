"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { totalQuestions, type ExamBlueprint } from "@/lib/exam-blueprint";
import {
  addedMinutes,
  scopeSummary,
  targetPart,
  type AppendPlacement,
  type AppendTarget,
  type ExistingExamContext,
} from "@/lib/exam-append";

const NEW_PARTS = "__new_parts__";
const NO_PART = "__no_part__";

function targetValue(target: AppendTarget): string {
  if (target.kind === "new_parts") return NEW_PARTS;
  if (target.kind === "no_part") return NO_PART;
  return target.partId;
}

function parseTarget(value: string): AppendTarget {
  if (value === NEW_PARTS) return { kind: "new_parts" };
  if (value === NO_PART) return { kind: "no_part" };
  return { kind: "part", partId: value };
}

export function AppendSettings({
  exam,
  blueprint,
  placement,
  onChange,
}: {
  exam: ExistingExamContext;
  /** Blueprint with the placement already applied */
  blueprint: ExamBlueprint;
  placement: AppendPlacement;
  onChange: (placement: AppendPlacement) => void;
}) {
  const added = totalQuestions(blueprint);
  const part = targetPart(exam, placement);
  const isNewParts = placement.target.kind === "new_parts";
  const summary = scopeSummary(exam, placement, added);
  const minutes = addedMinutes(blueprint, exam, placement);
  const scopeLabel = part ? `"${part.name}"` : "the exam";

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label>Where to add the questions</Label>
        <Select
          value={targetValue(placement.target)}
          onValueChange={(v) => onChange({ ...placement, target: parseTarget(v), sessionItems: undefined })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {exam.parts.length > 0 ? (
              <>
                <SelectItem value={NEW_PARTS}>New parts by question type</SelectItem>
                {exam.parts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>Add to {p.name || "Untitled part"}</SelectItem>
                ))}
              </>
            ) : (
              <>
                <SelectItem value={NO_PART}>Add to the exam&apos;s questions</SelectItem>
                <SelectItem value={NEW_PARTS}>Group them into new parts by question type</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
        {isNewParts && (
          <p className="text-xs text-muted-foreground">
            {exam.parts.length > 0
              ? `New parts continue after the exam's ${exam.parts.length} existing part(s).`
              : `Existing questions stay outside the parts and are all shown after them${
                  exam.numberOfItems ? `; the exam's "${exam.numberOfItems} items per session" setting stops applying once it has parts` : ""
                }.`}{" "}
            Turn on the question pool above to have each new part draw a random subset.
          </p>
        )}
      </div>

      {!isNewParts && (
        <div className="space-y-2">
          <Label>Items per session</Label>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Each session shows</span>
            <Input
              type="number"
              className="w-20"
              min={1}
              max={summary.total}
              value={summary.perSession}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                onChange({ ...placement, sessionItems: Number.isNaN(n) ? undefined : Math.min(summary.total, Math.max(1, n)) });
              }}
            />
            <span className="text-muted-foreground">of the {summary.total} questions in {scopeLabel}.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.perSession !== summary.total && (
              <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...placement, sessionItems: null })}>
                Use all {summary.total}
              </Button>
            )}
            {summary.perSession !== summary.suggested && (
              <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...placement, sessionItems: undefined })}>
                Use {summary.suggested} (current {summary.perSessionBefore} + new)
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Currently each session shows {summary.perSessionBefore}. When fewer than all questions are used, each examinee
            gets a random set.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Time limit</Label>
        {exam.timeType === "per_question" ? (
          <p className="text-xs text-muted-foreground">This exam is timed per question, so its time limit is left as is.</p>
        ) : exam.timeType === "per_part" && isNewParts ? (
          <p className="text-xs text-muted-foreground">
            Each new part gets its own estimated time limit; the exam total updates automatically.
          </p>
        ) : minutes > 0 ? (
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox
              className="mt-0.5"
              checked={placement.extendTime}
              onCheckedChange={(v) => onChange({ ...placement, extendTime: v === true })}
            />
            <span>
              {exam.timeType === "per_part" && part
                ? `Add ${minutes} minutes to this part's time limit (${part.timeLimit ?? 0} → ${(part.timeLimit ?? 0) + minutes} min)`
                : `Add ${minutes} minutes to the exam time limit (${exam.timeLimit} → ${exam.timeLimit + minutes} min)`}
            </span>
          </label>
        ) : (
          <p className="text-xs text-muted-foreground">Sessions don&apos;t get longer, so the time limit stays the same.</p>
        )}
      </div>
    </div>
  );
}
