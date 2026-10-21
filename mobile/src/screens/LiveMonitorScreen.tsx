import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, apiErrorMessage } from "../api";
import { formatClock } from "../format";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { Field, Ghost, StaffBody, useStaffStyles } from "../staff-ui";
import type { LiveExamMonitor } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "LiveMonitor">;

export function LiveMonitorScreen({ route }: Props) {
  const t = useT();
  const { styles } = useStaffStyles();
  const [live, setLive] = useState<LiveExamMonitor | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.getLiveSessions(route.params.examId);
      setLive(res.data);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, t("live.loadError")));
    }
  }, [route.params.examId, t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
      const timer = setInterval(() => load().catch(() => undefined), 10000);
      return () => clearInterval(timer);
    }, [load])
  );

  return (
    <StaffBody>
      <Text style={styles.title}>{live?.examTitle || t("live.title")}</Text>
      <Text style={styles.muted}>{live ? String(live.inProgress) : ""}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.ok}>{notice}</Text> : null}
      {!live?.sessions?.length ? <Text style={styles.muted}>{t("live.none")}</Text> : null}
      {live?.sessions?.map((session) => (
        <View key={session.id} style={styles.card}>
          <Text style={styles.title}>{session.examineeName || session.examineeEmail || session.id}</Text>
          <Text style={styles.muted}>{t("live.remaining", { count: formatClock(session.timeRemainingSeconds || 0) })}</Text>
          <Text style={styles.muted}>
            {t("live.answered", { done: session.answeredCount, total: session.totalQuestions })}
          </Text>
          {session.integrityEventCount ? (
            <Text style={styles.muted}>{t("live.flags", { count: session.integrityEventCount })}</Text>
          ) : null}
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
                      return load();
                    })
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
                  return load();
                })
                .catch((err) => setError(apiErrorMessage(err, t("live.loadError"))));
            }}
          />
        </View>
      ))}
    </StaffBody>
  );
}
