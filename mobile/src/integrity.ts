import { useCallback, useEffect, useRef, type RefObject } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { api } from "./api";
import type { FocusLossMode, IntegrityEventInput, IntegrityEventType, IntegrityEventsResult } from "./types";

const FLUSH_AT = 20;
const MAX_BUFFER = 200;
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 15_000;

export type FocusLossHandlers = {
  mode?: FocusLossMode;
  onFocusLost?: () => void;
  onFocusReturned?: (result: IntegrityEventsResult | null) => void;
};

export function useIntegrityLogger(
  sessionId: string,
  active: boolean,
  questionIdRef: RefObject<string | undefined>,
  handlers: FocusLossHandlers = {}
) {
  const bufferRef = useRef<IntegrityEventInput[]>([]);
  const flushingRef = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const awayRef = useRef(false);
  const strictLeaveSentRef = useRef(false);

  const push = useCallback(
    (type: IntegrityEventType, extra: Partial<IntegrityEventInput> = {}) => {
      const event: IntegrityEventInput = { type, at: new Date().toISOString(), ...extra };
      const questionId = questionIdRef.current;
      if (questionId) event.questionId = questionId;
      bufferRef.current.push(event);
      if (bufferRef.current.length > MAX_BUFFER) bufferRef.current.splice(0, bufferRef.current.length - MAX_BUFFER);
    },
    [questionIdRef]
  );

  const flush = useCallback(async (): Promise<IntegrityEventsResult | null> => {
    if (flushingRef.current || bufferRef.current.length === 0) return null;
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
  }, [sessionId]);

  useEffect(() => {
    if (!active) return;
    let hiddenAt: number | null = null;
    let blurAt: number | null = null;
    const initial = AppState.currentState;
    let state: AppStateStatus = initial === "background" || initial === "inactive" ? initial : "active";

    const markLost = () => {
      if (awayRef.current) return;
      awayRef.current = true;
      handlersRef.current.onFocusLost?.();
      if (handlersRef.current.mode === "strict" && !strictLeaveSentRef.current) {
        strictLeaveSentRef.current = true;
        push("tab_hidden", { at: new Date().toISOString() });
        void flush().then((result) => {
          if (result?.ended) handlersRef.current.onFocusReturned?.(result);
        });
      }
    };

    const onChange = (next: AppStateStatus) => {
      if (next === "background") {
        hiddenAt = Date.now();
        blurAt = null;
        markLost();
      } else if (next === "inactive" && state === "active") {
        blurAt = Date.now();
        markLost();
      } else if (next === "active") {
        awayRef.current = false;
        if (hiddenAt != null) {
          const started = hiddenAt;
          hiddenAt = null;
          if (!strictLeaveSentRef.current) {
            push("tab_hidden", { at: new Date(started).toISOString(), durationMs: Date.now() - started });
          }
          void flush().then((result) => handlersRef.current.onFocusReturned?.(result));
        } else if (blurAt != null) {
          const started = blurAt;
          blurAt = null;
          if (!strictLeaveSentRef.current) {
            push("window_blur", { at: new Date(started).toISOString(), durationMs: Date.now() - started });
          }
          void flush().then((result) => handlersRef.current.onFocusReturned?.(result));
        }
      }
      state = next;
    };

    const sub = AppState.addEventListener("change", onChange);
    const interval = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    return () => {
      sub.remove();
      clearInterval(interval);
      void flush();
    };
  }, [active, flush, push]);

  const recordPaste = useCallback(
    (length: number) => {
      if (!active || length <= 1) return;
      push("paste", { length });
      if (bufferRef.current.length >= FLUSH_AT) void flush();
    },
    [active, flush, push]
  );

  return { flush, recordPaste };
}
