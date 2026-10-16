"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DuplicateExamButtonProps {
  examId: string;
  /** Icon-only button for compact card actions. */
  iconOnly?: boolean;
  className?: string;
}

export function DuplicateExamButton({ examId, iconOnly = false, className }: DuplicateExamButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.duplicateExam(examId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      const copy = res.data;
      toast.success(res.message || "Exam duplicated", {
        description: "The copy is a draft. Rename it and adjust settings before publishing.",
      });
      if (copy?.id) router.push(`/dashboard/exams/${copy.id}/edit`);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to duplicate exam"),
  });

  const icon = mutation.isPending ? (
    <Loader2 className={cn("animate-spin", iconOnly ? "h-3 w-3" : "h-4 w-4")} />
  ) : (
    <Copy className={iconOnly ? "h-3 w-3" : "h-4 w-4"} />
  );

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className={className}
      aria-label="Duplicate exam"
      title="Duplicate as a new draft"
    >
      {icon}
      {!iconOnly && <span className="ml-2">{mutation.isPending ? "Duplicating…" : "Duplicate"}</span>}
    </Button>
  );
}
