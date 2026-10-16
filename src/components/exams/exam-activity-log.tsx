"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, FilePen, History, ListChecks, Scale, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

function iconFor(action: string) {
  if (action.startsWith("collaborator.")) return Users;
  if (action.startsWith("result.")) return ClipboardCheck;
  if (action.includes("reconcil")) return Scale;
  if (action.startsWith("question.")) return ListChecks;
  return FilePen;
}

/** Who changed what on an exam: settings, questions, grading, reconciliations and sharing. */
export function ExamActivityLog({ examId }: { examId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["exam-audit-log", examId],
    queryFn: () => api.getExamAuditLog(examId),
    retry: false,
  });
  const entries = data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Activity
        </CardTitle>
        <CardDescription>Changes to this exam, newest first. Recording started when this feature was added.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-muted-foreground">The activity log could not be loaded.</p>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No recorded activity yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-5">
            {entries.map((entry) => {
              const Icon = iconFor(entry.action);
              return (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[29px] flex h-6 w-6 items-center justify-center rounded-full border bg-background">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                  </span>
                  <p className="text-sm break-words">{entry.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actorEmail || "Unknown user"} · {entry.createdAt ? formatDate(entry.createdAt) : ""}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
