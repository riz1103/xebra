import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FocusLossMode } from "@/types";

/** Exam setting: how leaving the tab/app during an attempt is handled. */
export function FocusLossSelect({
  value,
  onValueChange,
}: {
  value: FocusLossMode;
  onValueChange: (value: FocusLossMode) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="focusLossMode">Leaving the exam window</Label>
      <Select value={value} onValueChange={(v) => onValueChange(v as FocusLossMode)}>
        <SelectTrigger id="focusLossMode" className="w-full sm:w-80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="count">Record only (default)</SelectItem>
          <SelectItem value="warn">Warn examinee</SelectItem>
          <SelectItem value="strict">End exam automatically</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {value === "strict"
          ? "Switching tabs, minimizing, or clicking outside the exam ends the attempt automatically. Examinees are told this before they start."
          : value === "warn"
            ? "Leaving the exam pauses it and shows a warning that searching elsewhere is not allowed. Each leave is still recorded for the proctor."
            : "Leaving the exam pauses it and is counted for the proctor (tab switches, minimize, click outside). The attempt continues when they return."}
      </p>
    </div>
  );
}
