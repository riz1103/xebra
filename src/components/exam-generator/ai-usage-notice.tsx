"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AlertTriangle, Gauge } from "lucide-react";
import {
  AI_MODELS,
  clearAiFallbackUsage,
  getAiUsageSnapshot,
  refreshAiUsage,
  subscribeAiUsage,
} from "@/lib/ai";

const usd = (value: number) => `$${value.toFixed(2)}`;

/** Which Gemini model the generator is using, how much of the budget is spent, and a quality warning on the fallback. */
export function AiUsageNotice({ active }: { active: boolean }) {
  const { status, quotaFallback, usedFallback } = useSyncExternalStore(
    subscribeAiUsage,
    getAiUsageSnapshot,
    getAiUsageSnapshot
  );

  useEffect(() => {
    if (!active) return;
    clearAiFallbackUsage();
    void refreshAiUsage(true);
  }, [active]);

  const onFallbackNow = quotaFallback || status?.tier === "fallback";

  if (onFallbackNow || usedFallback) {
    let why: string;
    if (quotaFallback) {
      why = "the main model is over its rate limit right now (usually clears within a few minutes)";
    } else if (status?.reason === "monthly_budget") {
      why = `this month's ${usd(status.month.primaryBudgetUsd)} budget for the main model is used up (resets next month)`;
    } else if (status?.reason === "daily_user_limit") {
      why = `you've used today's ${status.user.primaryDailyLimit} requests on the main model (resets tomorrow, Pacific time)`;
    } else {
      why = "a usage limit was reached during this run";
    }

    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">Question quality may be lower</p>
          <p className="text-xs">
            {onFallbackNow ? "The AI is using" : "Part of this run used"} the lighter model (
            <span className="font-mono">{AI_MODELS.fallback}</span>) because {why}. Review the questions and answer
            keys carefully; questions may be simpler, less varied, or occasionally inaccurate.
          </p>
        </div>
      </div>
    );
  }

  // Older backends without the usage endpoint: nothing to show, generation still works on the primary model
  if (!status) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border p-2.5 text-xs text-muted-foreground">
      <Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>
        AI model: <span className="font-mono">{AI_MODELS.primary}</span>. About {usd(status.month.primaryCostUsd)} of
        the {usd(status.month.primaryBudgetUsd)} monthly budget used · {status.user.primaryRequestsToday} of your{" "}
        {status.user.primaryDailyLimit} requests today.
      </p>
    </div>
  );
}
