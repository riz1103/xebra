import type { IntegrityEventType, LiveAlertLevel, LiveIntegritySummary, LiveSession } from "@/types";

export const LIVE_HOLD_MS = 4000;
export const LIVE_FALLBACK_POLL_MS = 3000;
export const IDLE_WARNING_MS = 3 * 60_000;

export const INTEGRITY_TYPE_LABELS: Record<IntegrityEventType, string> = {
  tab_hidden: "Left tab",
  window_blur: "Switched window",
  fullscreen_exit: "Left full screen",
  paste: "Pasted",
  copy: "Copied",
};

export const INTEGRITY_TYPES = Object.keys(INTEGRITY_TYPE_LABELS) as IntegrityEventType[];

export function emptyIntegritySummary(): LiveIntegritySummary {
  return { tab_hidden: 0, window_blur: 0, fullscreen_exit: 0, paste: 0, copy: 0 };
}

export function sessionIdleMs(session: LiveSession, nowMs: number, skewMs = 0): number | null {
  if (!session.lastActivityAt) return null;
  return Math.max(0, nowMs + skewMs - new Date(session.lastActivityAt).getTime());
}

export function isIdleSession(session: LiveSession, nowMs: number, skewMs = 0): boolean {
  const idle = sessionIdleMs(session, nowMs, skewMs);
  return idle != null && idle > IDLE_WARNING_MS;
}

export function alertLevelOf(session: LiveSession, nowMs: number, skewMs = 0): LiveAlertLevel {
  if (session.alertLevel) return session.alertLevel;
  const focus = session.focusLossCount ?? 0;
  const flags = session.integrityEventCount ?? 0;
  if (focus >= 3 || flags >= 10) return "critical";
  if (focus > 0 || flags > 0 || isIdleSession(session, nowMs, skewMs)) return "warning";
  return "ok";
}

export function flaggedSessions(sessions: LiveSession[], nowMs: number, skewMs = 0): LiveSession[] {
  return sessions
    .filter((s) => alertLevelOf(s, nowMs, skewMs) !== "ok")
    .sort((a, b) => (b.alertScore ?? 0) - (a.alertScore ?? 0));
}

export function summaryBreakdown(session: LiveSession): { type: IntegrityEventType; count: number }[] {
  const summary = { ...emptyIntegritySummary(), ...(session.integritySummary || {}) };
  return INTEGRITY_TYPES.map((type) => ({ type, count: summary[type] || 0 })).filter((row) => row.count > 0);
}
