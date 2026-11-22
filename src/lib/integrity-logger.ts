"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { api } from "@/lib/api";
import type { FocusLossMode, IntegrityEventInput, IntegrityEventType, IntegrityEventsResult } from "@/types";

const FLUSH_INTERVAL_MS = 15_000;
const FLUSH_AT = 20;
const MAX_BUFFER = 200;
const BATCH_SIZE = 50;
// A blur that turns into a hidden tab within this window is logged once, as tab_hidden
const BLUR_SETTLE_MS = 400;

const FOCUS_LOSS_TYPES = new Set<IntegrityEventType>(["tab_hidden", "window_blur"]);

export type FocusLossHandlers = {
  mode?: FocusLossMode;
  onFocusLost?: () => void;
  onFocusReturned?: (result: IntegrityEventsResult | null) => void;
};

/**
 * Records tab switches, window blur, full-screen exits, paste and copy while an exam is running, and sends
 * them to the session in batches. Pasted or copied text is never sent, only its length.
 * Focus-loss handlers pause the UI and apply warn/strict exam settings.
 */
export function useIntegrityLogger(
  sessionId: string,
  active: boolean,
  currentQuestionIdRef: RefObject<string | undefined>,
  handlers: FocusLossHandlers = {}
) {
  const bufferRef = useRef<IntegrityEventInput[]>([]);
  const flushingRef = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const awayRef = useRef(false);
  const strictLeaveSentRef = useRef(false);

  useEffect(() => {
    if (!active) return;

    const push = (type: IntegrityEventType, extra: Partial<IntegrityEventInput> = {}) => {
      const event: IntegrityEventInput = { type, at: new Date().toISOString(), ...extra };
      const questionId = currentQuestionIdRef.current;
      if (questionId) event.questionId = questionId;
      bufferRef.current.push(event);
      if (bufferRef.current.length > MAX_BUFFER) bufferRef.current.splice(0, bufferRef.current.length - MAX_BUFFER);
      if (bufferRef.current.length >= FLUSH_AT) void flush();
    };

    const flush = async (): Promise<IntegrityEventsResult | null> => {
      if (flushingRef.current || bufferRef.current.length === 0 || !navigator.onLine) return null;
      flushingRef.current = true;
      const batch = bufferRef.current.splice(0, BATCH_SIZE);
      try {
        const res = await api.recordIntegrityEvents(sessionId, batch);
        return res.data ?? null;
      } catch {
        bufferRef.current.unshift(...batch);
        if (bufferRef.current.length > MAX_BUFFER) bufferRef.current.length = MAX_BUFFER;
        return null;
      } finally {
        flushingRef.current = false;
      }
    };

    let hiddenAt: number | null = null;
    let blurAt: number | null = null;
    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    let wasFullscreen = !!document.fullscreenElement;

    const markLost = () => {
      if (awayRef.current) return;
      awayRef.current = true;
      handlersRef.current.onFocusLost?.();
      // Strict: report immediately so the server can end the attempt while the examinee is away
      if (handlersRef.current.mode === "strict" && !strictLeaveSentRef.current) {
        strictLeaveSentRef.current = true;
        push("tab_hidden", { at: new Date().toISOString() });
        void flush().then((result) => {
          if (result?.ended) handlersRef.current.onFocusReturned?.(result);
        });
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        blurAt = null;
        if (blurTimer) clearTimeout(blurTimer);
        markLost();
      } else if (hiddenAt != null) {
        const started = hiddenAt;
        hiddenAt = null;
        awayRef.current = false;
        if (!strictLeaveSentRef.current) {
          push("tab_hidden", { at: new Date(started).toISOString(), durationMs: Date.now() - started });
        }
        void flush().then((result) => handlersRef.current.onFocusReturned?.(result));
      }
    };
    const onBlur = () => {
      if (document.visibilityState === "hidden") return;
      const at = Date.now();
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (document.visibilityState === "visible") {
          blurAt = at;
          markLost();
        }
      }, BLUR_SETTLE_MS);
    };
    const onFocus = () => {
      if (blurTimer) clearTimeout(blurTimer);
      if (blurAt != null) {
        const started = blurAt;
        blurAt = null;
        awayRef.current = false;
        if (!strictLeaveSentRef.current) {
          push("window_blur", { at: new Date(started).toISOString(), durationMs: Date.now() - started });
        }
        void flush().then((result) => handlersRef.current.onFocusReturned?.(result));
      }
    };
    const onFullscreen = () => {
      const isFullscreen = !!document.fullscreenElement;
      if (wasFullscreen && !isFullscreen) push("fullscreen_exit");
      wasFullscreen = isFullscreen;
    };
    const onPaste = (e: ClipboardEvent) => push("paste", { length: e.clipboardData?.getData("text")?.length ?? 0 });
    const onCopy = () => push("copy", { length: document.getSelection()?.toString().length ?? 0 });

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("copy", onCopy, true);
    const interval = setInterval(() => void flush(), FLUSH_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("copy", onCopy, true);
      if (blurTimer) clearTimeout(blurTimer);
      clearInterval(interval);
      void flush();
    };
  }, [sessionId, active, currentQuestionIdRef]);

  /** Sends anything still buffered, e.g. right before submitting */
  return useCallback(async () => {
    if (bufferRef.current.length === 0) return;
    try {
      await api.recordIntegrityEvents(sessionId, bufferRef.current.splice(0, BATCH_SIZE));
    } catch {
      // Best effort; submission must not wait on this
    }
  }, [sessionId]);
}

export function isFocusLossEvent(type: IntegrityEventType) {
  return FOCUS_LOSS_TYPES.has(type);
}
