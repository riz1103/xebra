import { useCallback, useEffect, useRef, type RefObject } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { api } from "./api";
import type { IntegrityEventInput, IntegrityEventType } from "./types";
const FLUSH_AT = 20;
const MAX_BUFFER = 200;
const BATCH_SIZE = 50;

const FLUSH_INTERVAL_MS = 15_000;
export function useIntegrityLogger(sessionId: string, active: boolean, questionIdRef: RefObject<string | undefined>) {
  const bufferRef = useRef<IntegrityEventInput[]>([]);
  const flushingRef = useRef(false);

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

  const flush = useCallback(async () => {
    if (flushingRef.current || bufferRef.current.length === 0) return;
    flushingRef.current = true;
    const batch = bufferRef.current.splice(0, BATCH_SIZE);
    try {
      await api.recordIntegrityEvents(sessionId, batch);
    } catch {
      bufferRef.current.unshift(...batch);
      if (bufferRef.current.length > MAX_BUFFER) bufferRef.current.length = MAX_BUFFER;
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

    const onChange = (next: AppStateStatus) => {
      if (next === "background") {
        hiddenAt = Date.now();
        blurAt = null;
      } else if (next === "inactive" && state === "active") {
        blurAt = Date.now();
      } else if (next === "active") {
        if (hiddenAt != null) {
          push("tab_hidden", { at: new Date(hiddenAt).toISOString(), durationMs: Date.now() - hiddenAt });
          hiddenAt = null;
          void flush();
        } else if (blurAt != null) {
          push("window_blur", { at: new Date(blurAt).toISOString(), durationMs: Date.now() - blurAt });
          blurAt = null;
          void flush();
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
