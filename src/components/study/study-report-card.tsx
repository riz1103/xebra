"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Per-topic performance for one result, with a shortcut to practice the weak topics. */
export function StudyReportCard({ resultId }: { resultId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["study-report", resultId],
    queryFn: () => api.getStudyReport(resultId),
    retry: false,
  });
  const report = data?.data;

  if (isError) return null;
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!report || report.topics.length === 0) return null;
  // A single catch-all topic says nothing beyond the overall score
  if (report.topics.length === 1 && report.topics[0].topic === "General") return null;

  const practiceHref = `/dashboard/practice?topics=${encodeURIComponent(report.weakTopics.join("|"))}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4" /> Study report
        </CardTitle>
        <CardDescription>
          {report.weakTopics.length > 0
            ? `You scored below ${report.threshold}% in ${report.weakTopics.length === 1 ? "1 topic" : `${report.weakTopics.length} topics`}. Those are the best places to focus.`
            : "You did well across every topic in this exam."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-3">
          {report.topics.map((t) => (
            <li key={t.topic} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{t.topic}</span>
                  {t.weak && <Badge variant="outline" className="shrink-0 border-amber-500/50 text-[10px] text-amber-700 dark:text-amber-400">Needs work</Badge>}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {t.correct}/{t.graded} correct{t.percentage !== null && ` · ${Math.round(t.percentage)}%`}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-label={`${t.topic} score`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={t.percentage ?? 0}
              >
                <div
                  className={cn("h-full rounded-full", t.weak ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: `${t.percentage ?? 0}%` }}
                />
              </div>
              {t.pendingReview > 0 && (
                <p className="text-xs text-muted-foreground">{t.pendingReview} written answer(s) still being graded</p>
              )}
            </li>
          ))}
        </ul>
        {report.weakTopics.length > 0 && (
          <Button asChild className="w-full sm:w-auto">
            <Link href={practiceHref}>
              <Sparkles className="mr-2 h-4 w-4" /> Practice weak topics
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
