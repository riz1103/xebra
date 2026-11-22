"use client";

import Link from "next/link";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { alertLevelOf, flaggedSessions, summaryBreakdown } from "@/lib/live-monitor";
import { INTEGRITY_TYPE_LABELS } from "@/lib/live-monitor";
import type { LiveSession } from "@/types";

export function LiveAlertsStrip({
  sessions,
  nowMs,
  skewMs = 0,
  showExamLink = false,
}: {
  sessions: LiveSession[];
  nowMs: number;
  skewMs?: number;
  showExamLink?: boolean;
}) {
  const flagged = flaggedSessions(sessions, nowMs, skewMs);
  if (flagged.length === 0) return null;

  const critical = flagged.filter((s) => alertLevelOf(s, nowMs, skewMs) === "critical").length;

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        critical > 0
          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <ShieldAlert className={cn("h-4 w-4", critical > 0 ? "text-red-600" : "text-amber-600")} />
        {flagged.length} red flag{flagged.length === 1 ? "" : "s"}
        {critical > 0 && (
          <span className="text-red-700 dark:text-red-400">
            · {critical} critical
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {flagged.slice(0, 8).map((session) => {
          const level = alertLevelOf(session, nowMs, skewMs);
          const parts = summaryBreakdown(session);
          return (
            <li key={session.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <AlertTriangle
                className={cn("h-3.5 w-3.5 shrink-0", level === "critical" ? "text-red-600" : "text-amber-600")}
              />
              <span className="font-medium">
                {session.examineeName || session.examineeEmail || "Examinee"}
              </span>
              {showExamLink && session.examId && (
                <Link
                  href={`/dashboard/exams/${session.examId}/live`}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  {session.examTitle || "Exam"}
                </Link>
              )}
              {(session.focusLossCount ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground">Left window ×{session.focusLossCount}</span>
              )}
              {parts.map((p) => (
                <span key={p.type} className="rounded bg-background/60 px-1.5 py-0.5 text-[11px] tabular-nums">
                  {INTEGRITY_TYPE_LABELS[p.type]} ×{p.count}
                </span>
              ))}
              {parts.length === 0 && (session.integrityEventCount ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground">
                  {session.integrityEventCount} integrity flag{session.integrityEventCount === 1 ? "" : "s"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {flagged.length > 8 && (
        <p className="mt-2 text-xs text-muted-foreground">+{flagged.length - 8} more flagged examinees below</p>
      )}
    </div>
  );
}
