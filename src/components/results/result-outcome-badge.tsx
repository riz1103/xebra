import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ExamResult } from "@/types";

export function isAwaitingGrading(result: Pick<ExamResult, "gradingStatus">): boolean {
  return result.gradingStatus === "pending_review";
}

/** Passed / Failed, or "Awaiting grading" while essays still need a proctor grade. */
export function ResultOutcomeBadge({
  result,
  uppercase = false,
  className,
}: {
  result: Pick<ExamResult, "passed" | "gradingStatus">;
  uppercase?: boolean;
  className?: string;
}) {
  if (isAwaitingGrading(result)) {
    return (
      <Badge
        variant="outline"
        className={cn("gap-1 border-amber-500 text-amber-700 dark:text-amber-400", className)}
      >
        <Clock className="h-3 w-3" />
        {uppercase ? "AWAITING GRADING" : "Awaiting grading"}
      </Badge>
    );
  }
  const label = result.passed ? "Passed" : "Failed";
  return (
    <Badge variant={result.passed ? "success" : "destructive"} className={className}>
      {uppercase ? label.toUpperCase() : label}
    </Badge>
  );
}
