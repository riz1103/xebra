"use client";

import { INTEGRITY_TYPE_LABELS, summaryBreakdown } from "@/lib/live-monitor";
import type { LiveSession } from "@/types";

export function LiveFlagBreakdown({ session }: { session: LiveSession }) {
  const parts = summaryBreakdown(session);
  if (parts.length === 0 && !(session.focusLossCount || session.integrityEventCount)) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {(session.focusLossCount ?? 0) > 0 && (
        <span className="rounded border border-amber-400/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
          Left window ×{session.focusLossCount}
        </span>
      )}
      {parts.map((p) => (
        <span
          key={p.type}
          className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
        >
          {INTEGRITY_TYPE_LABELS[p.type]} ×{p.count}
        </span>
      ))}
      {parts.length === 0 && (session.integrityEventCount ?? 0) > 0 && (
        <span className="rounded border border-amber-400/60 px-1.5 py-0.5 text-[10px] text-amber-800 dark:text-amber-300">
          {session.integrityEventCount} flag{session.integrityEventCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
