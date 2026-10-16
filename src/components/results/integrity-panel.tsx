"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ClipboardPaste, Copy, EyeOff, Maximize, MousePointerClick, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { IntegrityEventType } from "@/types";

const TYPE_INFO: Record<IntegrityEventType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  tab_hidden: { label: "Left the tab", icon: EyeOff },
  window_blur: { label: "Switched window", icon: MousePointerClick },
  fullscreen_exit: { label: "Left full screen", icon: Maximize },
  paste: { label: "Pasted", icon: ClipboardPaste },
  copy: { label: "Copied", icon: Copy },
};
const TYPES = Object.keys(TYPE_INFO) as IntegrityEventType[];

function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

const formatOffset = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Integrity signals from the session behind a result. Informational only; nothing here changes the score. */
export function IntegrityPanel({ resultId, questionNumber }: { resultId: string; questionNumber?: (questionId: string) => number | null }) {
  const [showTimeline, setShowTimeline] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["result-integrity", resultId],
    queryFn: () => api.getResultIntegrity(resultId),
    retry: false,
  });
  const integrity = data?.data;

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (isError || !integrity) return null;

  if (!integrity.tracked) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          Integrity signals weren&apos;t recorded for this attempt (it started before tracking was available).
        </CardContent>
      </Card>
    );
  }

  const clean = integrity.total === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className={cn("h-4 w-4", clean ? "text-emerald-500" : "text-amber-500")} />
          Integrity signals
        </CardTitle>
        <CardDescription>
          {clean
            ? "No tab switches, full-screen exits, or paste/copy events were recorded."
            : "Recorded during the attempt for your judgment. They don't affect the score, and pasted text is not stored."}
        </CardDescription>
      </CardHeader>
      {!clean && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {TYPES.filter((t) => integrity.summary[t] > 0).map((t) => {
              const Icon = TYPE_INFO[t].icon;
              return (
                <span key={t} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {TYPE_INFO[t].label} <span className="font-semibold tabular-nums">×{integrity.summary[t]}</span>
                </span>
              );
            })}
            {integrity.awayMs > 0 && (
              <span className="flex items-center rounded-md border px-2 py-1 text-sm">
                Time away from the tab: <span className="ml-1 font-semibold">{formatDuration(integrity.awayMs)}</span>
              </span>
            )}
          </div>

          {integrity.events.length > 0 && (
            <div>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setShowTimeline((v) => !v)} aria-expanded={showTimeline}>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showTimeline && "rotate-180")} />
                {showTimeline ? "Hide" : "Show"} timeline ({integrity.events.length}
                {integrity.truncated ? ` of ${integrity.total}` : ""})
              </Button>
              {showTimeline && (
                <ol className="mt-2 max-h-64 space-y-1 overflow-auto rounded-md border p-2 text-xs">
                  {integrity.events.map((e, i) => {
                    const n = e.questionId && questionNumber ? questionNumber(e.questionId) : null;
                    return (
                      <li key={i} className="flex flex-wrap gap-x-2">
                        <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                          {e.offsetSeconds != null ? formatOffset(e.offsetSeconds) : "—"}
                        </span>
                        <span className="font-medium">{TYPE_INFO[e.type]?.label ?? e.type}</span>
                        {e.durationMs != null && <span className="text-muted-foreground">for {formatDuration(e.durationMs)}</span>}
                        {e.length != null && <span className="text-muted-foreground">{e.length} characters</span>}
                        {n != null && <span className="text-muted-foreground">on Q{n}</span>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
