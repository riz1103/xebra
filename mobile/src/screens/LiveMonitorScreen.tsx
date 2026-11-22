import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, apiErrorMessage } from "../api";
import { formatClock } from "../format";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { Field, Ghost, StaffBody, useStaffStyles } from "../staff-ui";
import type { LiveExamMonitor, LiveIntegritySummary, LiveSession } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "LiveMonitor">;

const HOLD_MS = 4000;
const FALLBACK_MS = 3000;

const FLAG_LABELS: Record<keyof LiveIntegritySummary, string> = {
  tab_hidden: "Left tab",
  window_blur: "Switched window",
  fullscreen_exit: "Left full screen",
  paste: "Pasted",
  copy: "Copied",
};

function flagLines(session: LiveSession): string[] {
  const lines: string[] = [];
  if ((session.focusLossCount ?? 0) > 0) lines.push(`Left app ×${session.focusLossCount}`);
  const summary = session.integritySummary;
  if (summary) {
    (Object.keys(FLAG_LABELS) as (keyof LiveIntegritySummary)[]).forEach((key) => {
      const count = summary[key] || 0;
      if (count > 0) lines.push(`${FLAG_LABELS[key]} ×${count}`);
    });
  } else if (session.integrityEventCount) {
    lines.push(`${session.integrityEventCount} integrity flags`);
  }
  return lines;
}

export function LiveMonitorScreen({ route }: Props) {
  const t = useT();
  const { styles } = useStaffStyles();
  const [live, setLive] = useState<LiveExamMonitor | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const etagRef = useRef("");
  const stopRef = useRef(false);

  const applyResponse = useCallback((res: Awaited<ReturnType<typeof api.getLiveSessions>>) => {
    if (res.etag) etagRef.current = res.etag;
    if (!res.unchanged && res.data) setLive(res.data);
    setError("");
  }, []);

  useFocusEffect(
    useCallback(() => {
      stopRef.current = false;
      const loop = async () => {
        while (!stopRef.current) {
          try {
            const res = await api.getLiveSessions(route.params.examId, {
              etag: etagRef.current || undefined,
              holdMs: etagRef.current ? HOLD_MS : 0,
            });
            if (stopRef.current) return;
            applyResponse(res);
            const wait = res.pollAfterMs ?? (res.unchanged ? 0 : FALLBACK_MS);
            if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          } catch (err) {
            if (stopRef.current) return;
            setError(apiErrorMessage(err, t("live.loadError")));
            await new Promise((r) => setTimeout(r, FALLBACK_MS));
          }
        }
      };
      void loop();
      return () => {
        stopRef.current = true;
      };
    }, [applyResponse, route.params.examId, t])
  );

  useEffect(() => () => {
    stopRef.current = true;
  }, []);

  const flagged = (live?.sessions || []).filter((s) => (s.alertLevel && s.alertLevel !== "ok") || (s.focusLossCount ?? 0) > 0 || (s.integrityEventCount ?? 0) > 0);

  return (
    <StaffBody>
      <Text style={styles.title}>{live?.examTitle || t("live.title")}</Text>
      <Text style={styles.muted}>
        {live
          ? t("live.stats", {
              inProgress: live.inProgress,
              flagged: live.flaggedCount ?? flagged.length,
            })
          : ""}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.ok}>{notice}</Text> : null}

      {flagged.length > 0 ? (
        <View style={[styles.card, { borderColor: "#b45309", borderWidth: 1 }]}>
          <Text style={styles.title}>{t("live.alerts", { count: flagged.length })}</Text>
          {flagged.slice(0, 6).map((session) => (
            <View key={`alert-${session.id}`} style={{ marginTop: 8 }}>
              <Text style={styles.muted}>{session.examineeName || session.examineeEmail || session.id}</Text>
              {flagLines(session).map((line) => (
                <Text key={line} style={styles.error}>
                  {line}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {!live?.sessions?.length ? <Text style={styles.muted}>{t("live.none")}</Text> : null}
      {live?.sessions?.map((session) => {
        const lines = flagLines(session);
        const level = session.alertLevel || "ok";
        return (
          <View
            key={session.id}
            style={[
              styles.card,
              level === "critical" ? { borderColor: "#dc2626", borderWidth: 1 } : null,
              level === "warning" ? { borderColor: "#d97706", borderWidth: 1 } : null,
            ]}
          >
            <Text style={styles.title}>{session.examineeName || session.examineeEmail || session.id}</Text>
            {level !== "ok" ? (
              <Text style={styles.error}>{level === "critical" ? t("live.critical") : t("live.flagged")}</Text>
            ) : null}
            <Text style={styles.muted}>{t("live.remaining", { count: formatClock(session.timeRemainingSeconds || 0) })}</Text>
            <Text style={styles.muted}>
              {t("live.answered", { done: session.answeredCount, total: session.totalQuestions })}
            </Text>
            {lines.map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
            <View style={styles.row}>
              {[5, 10, 15, 30].map((minutes) => (
                <Ghost
                  key={minutes}
                  label={t("live.extend", { count: minutes })}
                  onPress={() => {
                    api
                      .extendSessionTime(session.id, minutes)
                      .then(() => {
                        setNotice(t("live.extended"));
                        return api.getLiveSessions(route.params.examId, { holdMs: 0 });
                      })
                      .then(applyResponse)
                      .catch((err) => setError(apiErrorMessage(err, t("live.loadError"))));
                  }}
                />
              ))}
            </View>
            <Field label={t("live.reason")} value={reason} onChangeText={setReason} />
            <Ghost
              label={t("live.submit")}
              danger
              onPress={() => {
                api
                  .forceSubmitSession(session.id, reason.trim() || undefined)
                  .then(() => {
                    setNotice(t("live.submitted"));
                    return api.getLiveSessions(route.params.examId, { holdMs: 0 });
                  })
                  .then(applyResponse)
                  .catch((err) => setError(apiErrorMessage(err, t("live.loadError"))));
              }}
            />
          </View>
        );
      })}
    </StaffBody>
  );
}
