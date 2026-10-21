import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api, apiErrorMessage } from "../api";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { Ghost, Primary, StaffBody, useStaffStyles } from "../staff-ui";
import type { Exam, ExamResultStats } from "../types";

export function OverviewScreen() {
  const t = useT();
  const { colors, styles } = useStaffStyles();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const staff = user?.role === "proctor" || user?.role === "admin";
  const [stats, setStats] = useState<ExamResultStats | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [invites, setInvites] = useState(0);
  const [dismissed, setDismissed] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const uid = user?.uid || user?.id || "";
    try {
      const resultStats = await api.getExamResultStats(staff ? "managed" : "mine");
      setStats(resultStats.data);
      if (staff) {
        const [examRes, inviteRes, stored] = await Promise.all([
          api.getExams({ page: 1, size: 100 }),
          api.getExamInvitations(),
          uid ? AsyncStorage.getItem(`xevra:onboarding-dismissed:${uid}`) : Promise.resolve("1"),
        ]);
        setExams(examRes.data || []);
        setInvites(inviteRes.data?.length || 0);
        setDismissed(stored === "1");
      }
    } catch (err) {
      setError(apiErrorMessage(err, t("overview.loadError")));
    }
  }, [staff, t, user?.id, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const steps = [
    { label: t("overview.step1"), done: exams.length > 0, go: () => navigation.navigate("ExamForm", {}) },
    { label: t("overview.step2"), done: exams.some((exam) => (exam.questionCount || 0) > 0), go: () => navigation.navigate("ManagedExams") },
    { label: t("overview.step3"), done: exams.some((exam) => exam.status === "active"), go: () => navigation.navigate("ManagedExams") },
    { label: t("overview.step4"), done: invites > 0, go: () => navigation.navigate("Invitations") },
    { label: t("overview.step5"), done: (stats?.total || 0) > 0, go: () => navigation.navigate("ManagedResults") },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const showGuide = staff && !dismissed && doneCount < steps.length;
  const maxBucket = Math.max(1, ...(stats?.distribution || []).map((bucket) => bucket.count));

  return (
    <StaffBody>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {showGuide ? (
        <View style={styles.card}>
          <Text style={styles.title}>{t("overview.start")}</Text>
          <Text style={styles.muted}>{t("overview.progress", { done: doneCount, total: steps.length })}</Text>
          <View style={{ height: 8, borderRadius: 99, backgroundColor: colors.tab }}>
            <View style={{ height: 8, borderRadius: 99, backgroundColor: colors.primary, width: `${(doneCount / steps.length) * 100}%` }} />
          </View>
          {steps.map((step) => (
            <View key={step.label} style={styles.row}>
              <Text style={[styles.body, step.done && { color: colors.success }]}>{step.done ? "✓" : "○"} {step.label}</Text>
              {!step.done ? <Ghost label={t("overview.open")} onPress={step.go} /> : null}
            </View>
          ))}
          {!exams.some((exam) => exam.isSample) ? (
            <Ghost
              label={t("overview.sample")}
              onPress={() => {
                api
                  .createSampleExam()
                  .then((res) => navigation.navigate("ExamForm", { examId: res.data.id }))
                  .catch((err) => setError(apiErrorMessage(err, t("overview.loadError"))));
              }}
            />
          ) : null}
          <Ghost
            label={t("overview.dismiss")}
            onPress={() => {
              const uid = user?.uid || user?.id || "";
              if (uid) AsyncStorage.setItem(`xevra:onboarding-dismissed:${uid}`, "1").catch(() => undefined);
              setDismissed(true);
            }}
          />
        </View>
      ) : null}
      <Text style={styles.muted}>{t("overview.results")}</Text>
      <Text style={styles.title}>{stats ? String(stats.total) : "—"}</Text>
      <Text style={styles.body}>
        {t("overview.passRate")}: {stats ? `${Math.round(stats.passRate)}%` : "—"}
      </Text>
      <Text style={styles.body}>
        {t("overview.average")}: {stats ? `${Math.round(stats.averagePercentage)}%` : "—"}
      </Text>
      <Text style={styles.body}>
        {t("overview.pending")}: {stats ? stats.pendingReview : "—"}
      </Text>
      {staff ? (
        <Text style={styles.body}>
          {t("overview.exams")}: {exams.length}
        </Text>
      ) : null}
      <Text style={styles.title}>{t("overview.distribution")}</Text>
      {(stats?.distribution || []).some((bucket) => bucket.count > 0) ? (
        stats?.distribution?.map((bucket) => (
          <View key={bucket.range} style={{ gap: 4 }}>
            <Text style={styles.muted}>
              {bucket.range}% · {bucket.count}
            </Text>
            <View style={{ height: 10, borderRadius: 99, backgroundColor: colors.dangerBg, width: `${(bucket.count / maxBucket) * 100}%` }}>
              <View
                style={{
                  height: 10,
                  borderRadius: 99,
                  backgroundColor: colors.success,
                  width: `${bucket.count ? (bucket.passed / bucket.count) * 100 : 0}%`,
                }}
              />
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.muted}>{t("overview.noChart")}</Text>
      )}
      <Text style={styles.title}>{t("overview.trend")}</Text>
      {(stats?.trend || []).some((week) => week.count > 0) ? (
        <View style={[styles.row, { alignItems: "flex-end", minHeight: 120 }]}>
          {(stats?.trend || []).map((week) => (
            <View key={week.weekStart} style={{ alignItems: "center", width: 28 }}>
              <View
                style={{
                  width: 16,
                  height: Math.max(4, week.count * 8),
                  borderRadius: 4,
                  backgroundColor: colors.primary,
                }}
              />
              <Text style={styles.muted}>{week.passRate == null ? "—" : `${Math.round(week.passRate)}`}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>{t("overview.noChart")}</Text>
      )}
      <Primary
        label={staff ? t("hub.exams") : t("overview.openExams")}
        onPress={() => (staff ? navigation.navigate("ManagedExams") : navigation.navigate("Home"))}
      />
      {!staff ? <Primary label={t("overview.practice")} onPress={() => navigation.navigate("Practice")} /> : null}
    </StaffBody>
  );
}
