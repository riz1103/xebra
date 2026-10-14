import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Exam setting: let examinees open AI questions' source material while reviewing their answers. */
export function SourceViewableSwitch({
  checked,
  onCheckedChange,
  reviewable,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Sources are only reachable from the answer review, so the setting needs review enabled */
  reviewable: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${reviewable ? "" : "opacity-60"}`}>
      <Switch id="sourceViewableByExaminee" checked={checked && reviewable} onCheckedChange={onCheckedChange} disabled={!reviewable} />
      <div>
        <Label htmlFor="sourceViewableByExaminee">Let examinees view question sources</Label>
        <p className="text-xs text-muted-foreground">
          {reviewable
            ? "When on, examinees reviewing their answers can open the material each AI-generated question was based on."
            : "Turn on answer review first; sources are shown in the examinee's answer review."}
        </p>
      </div>
    </div>
  );
}
