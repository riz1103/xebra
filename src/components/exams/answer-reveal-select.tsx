import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnswerRevealTiming } from "@/types";

/** Exam setting: when examinees reviewing their answers see correct answers, explanations, and sources. */
export function AnswerRevealSelect({
  value,
  onValueChange,
  reviewable,
}: {
  value: AnswerRevealTiming;
  onValueChange: (value: AnswerRevealTiming) => void;
  /** Answers are only shown in the examinee's answer review, so the setting needs review enabled */
  reviewable: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${reviewable ? "" : "opacity-60"}`}>
      <Label htmlFor="answerRevealTiming">Show correct answers and explanations</Label>
      <Select value={value} onValueChange={(v) => onValueChange(v as AnswerRevealTiming)} disabled={!reviewable}>
        <SelectTrigger id="answerRevealTiming" className="w-full sm:w-80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="always">Always (after each submitted attempt)</SelectItem>
          <SelectItem value="after_last_attempt">After the last attempt</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {!reviewable
          ? "Turn on answer review first; answers are shown in the examinee's answer review."
          : value === "after_last_attempt"
            ? "Examinees see only correct/incorrect until they pass or use up their attempts, so answers can't help with a retake."
            : "Examinees see the correct answers and explanations every time they review a submitted attempt."}
      </p>
    </div>
  );
}
