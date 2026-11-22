"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { LIVE_FALLBACK_POLL_MS, LIVE_HOLD_MS } from "@/lib/live-monitor";
import type { LiveExamMonitor, LiveMonitorResponse, LiveOverview } from "@/types";

type LiveFetcher<T> = (opts: { etag?: string; holdMs?: number }) => Promise<LiveMonitorResponse<T>>;

function useLiveLongPoll<T>(fetcher: LiveFetcher<T>, enabled: boolean, resetKey: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [dataUpdatedAt, setDataUpdatedAt] = useState(0);
  const etagRef = useRef<string>("");
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetcherRef.current({ holdMs: 0 });
      if (res.etag) etagRef.current = res.etag;
      if (res.data) {
        setData(res.data);
        setDataUpdatedAt(Date.now());
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load live data"));
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    etagRef.current = "";
    setIsLoading(true);

    const loop = async () => {
      while (!cancelled) {
        setIsFetching(true);
        try {
          const res = await fetcherRef.current({
            etag: etagRef.current || undefined,
            holdMs: etagRef.current ? LIVE_HOLD_MS : 0,
          });
          if (cancelled) return;
          if (res.etag) etagRef.current = res.etag;
          if (!res.unchanged && res.data) {
            setData(res.data);
            setDataUpdatedAt(Date.now());
            setError(null);
          }
          setIsLoading(false);
          setIsFetching(false);
          const wait = res.pollAfterMs ?? (res.unchanged ? 0 : LIVE_FALLBACK_POLL_MS);
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err : new Error("Failed to load live data"));
          setIsLoading(false);
          setIsFetching(false);
          await new Promise((r) => setTimeout(r, LIVE_FALLBACK_POLL_MS));
        }
      }
    };

    void loop();
    return () => {
      cancelled = true;
    };
  }, [enabled, resetKey]);

  return { data, error, isLoading, isFetching, dataUpdatedAt, refetch };
}

export function useExamLiveMonitor(examId: string) {
  const fetcher = useCallback(
    (opts: { etag?: string; holdMs?: number }) => api.getLiveSessions(examId, opts),
    [examId]
  );
  return useLiveLongPoll<LiveExamMonitor>(fetcher, !!examId, examId);
}

export function useLiveOverviewMonitor(enabled = true) {
  const fetcher = useCallback(
    (opts: { etag?: string; holdMs?: number }) => api.getLiveOverview(opts),
    []
  );
  return useLiveLongPoll<LiveOverview>(fetcher, enabled, "overview");
}
