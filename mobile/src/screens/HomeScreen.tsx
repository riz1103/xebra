import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, apiErrorMessage } from "../api";
import { useAuth } from "../auth";
import { asDate, formatClock, formatCountdown, formatWhen, isInProgress } from "../format";
import { useT } from "../i18n";
import { useColors, useTheme, shadow, type Palette } from "../theme";
import type { ExamForExaminee, ExamResult, ExamSession, GroupJoinResult } from "../types";
import type { RootStackParamList } from "../navigation";

type Tab = "exams" | "results" | "join";

function initials(name: string | undefined, email: string | undefined): string {
  const source = (name || email || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function HomeScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>("exams");
  const name = user?.name || user?.displayName || user?.email || "";
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Xevra</Text>
          <Text style={styles.hello} numberOfLines={1}>{name}</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("Profile")}
          style={styles.avatar}
          accessibilityLabel={t("home.profile")}
        >
          <Text style={styles.avatarText}>{initials(name, user?.email)}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabs}>
        {(
          [
            ["exams", t("home.exams")],
            ["results", t("home.results")],
            ["join", t("home.join")],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} style={[styles.tab, tab === id && styles.tabOn]} onPress={() => setTab(id)}>
            <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.tab} onPress={() => navigation.navigate("Practice")}>
          <Text style={styles.tabText}>{t("home.practice")}</Text>
        </Pressable>
        <Pressable style={styles.tab} onPress={() => navigation.navigate("ProctorRequest")}>
          <Text style={styles.tabText}>{t("home.proctor")}</Text>
        </Pressable>
      </ScrollView>
      {tab === "exams" ? <ExamsPane /> : tab === "results" ? <ResultsPane /> : <JoinPane onJoined={() => setTab("exams")} />}
    </SafeAreaView>
  );
}

function ExamsPane() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [examTab, setExamTab] = useState<"pending" | "progress" | "done">("pending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [exams, setExams] = useState<ExamForExaminee[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [starting, setStarting] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    setError("");
    const [examRes, sessionRes, resultRes] = await Promise.all([
      api.getExamsForExaminee(),
      api.getExamSessions(),
      api.getExamResults(),
    ]);
    setExams(examRes.data ?? []);
    setSessions(sessionRes.data ?? []);
    setResults(resultRes.data ?? []);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(apiErrorMessage(err, t("home.loadExamsError")))).finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const activeIds = useMemo(
    () => new Set(sessions.filter((s) => isInProgress(s.status)).map((s) => s.examId)),
    [sessions]
  );
  const inProgress = sessions.filter((s) => isInProgress(s.status));
  const resumeWithoutSession = exams.filter(
    (exam) => exam.invitationStatus === "in_progress" && !activeIds.has(exam.id)
  );
  const pending = exams.filter((exam) => {
    if (activeIds.has(exam.id) || exam.invitationStatus === "completed" || exam.invitationStatus === "in_progress") {
      return false;
    }
    if (exam.invitationStatus === "pending") return true;
    const start = asDate(exam.scheduledStartTime);
    return !!start && start.getTime() > now && exam.attemptsUsed < exam.maxAttempts;
  });

  const completed = useMemo(() => {
    const sessionsDone = sessions.filter((session) => session.status === "completed");
    const ids = new Set<string>();
    for (const session of sessionsDone) if (session.examId) ids.add(session.examId);
    for (const result of results) if (result.examId) ids.add(result.examId);
    return [...ids].map((examId) => {
      const attempts = results
        .filter((result) => result.examId === examId)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      const titled = sessionsDone.find((session) => session.examId === examId && session.examTitle);
      return {
        examId,
        title: titled?.examTitle || attempts[0]?.examTitle || t("home.exam"),
        latest: attempts[0],
        count: attempts.length,
        sessionCount: sessionsDone.filter((session) => session.examId === examId).length,
      };
    });
  }, [results, sessions, t]);

  const openSession = async (invitationId: string) => {
    setStarting(invitationId);
    setError("");
    try {
      const res = await api.createExamSession(invitationId);
      const session = res.data;
      if (!session?.id) throw new Error(t("home.didNotStart"));
      navigation.navigate("Exam", { sessionId: session.id });
    } catch (err) {
      setError(apiErrorMessage(err, t("home.couldNotStart")));
    } finally {
      setStarting(null);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load().catch((err) => setError(apiErrorMessage(err))).finally(() => setRefreshing(false));
          }}
        />
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.tabs}>
        {(
          [
            ["pending", t("home.pending", { count: pending.length })],
            ["progress", t("home.progress", { count: inProgress.length + resumeWithoutSession.length })],
            ["done", t("home.done", { count: completed.length })],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} style={[styles.tab, styles.tabGrow, examTab === id && styles.tabOn]} onPress={() => setExamTab(id)}>
            <Text style={[styles.tabText, examTab === id && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {examTab === "progress" ? (
        <>
          {inProgress.length === 0 && resumeWithoutSession.length === 0 ? (
            <Text style={styles.empty}>{t("home.noneOpen")}</Text>
          ) : null}
          {inProgress.map((session) => (
            <View key={session.id} style={styles.card}>
              <Text style={styles.cardTitle}>{session.examTitle || t("home.exam")}</Text>
              <Text style={styles.cardMeta}>{t("home.questionN", { n: (session.currentQuestionIndex || 0) + 1 })}</Text>
              <LiveTimer seconds={session.timeRemainingSeconds} />
              <Pressable style={styles.primary} onPress={() => navigation.navigate("Exam", { sessionId: session.id })}>
                <Text style={styles.primaryText}>{t("home.resume")}</Text>
              </Pressable>
            </View>
          ))}
          {resumeWithoutSession.map((exam) => (
            <View key={exam.invitationId || exam.id} style={styles.card}>
              <Text style={styles.cardTitle}>{exam.title || t("home.exam")}</Text>
              <Text style={styles.cardMeta}>
                {exam.expiresAt ? t("home.expires", { when: formatWhen(exam.expiresAt) }) : ""}
                {t("home.attemptsRetry", { used: exam.attemptsUsed, max: exam.maxAttempts })}
              </Text>
              <Pressable
                style={[styles.primary, (exam.status !== "active" || starting === exam.invitationId) && styles.disabled]}
                disabled={exam.status !== "active" || starting === exam.invitationId}
                onPress={() => exam.invitationId && openSession(exam.invitationId)}
              >
                {starting === exam.invitationId ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t("home.attemptAgain")}</Text>}
              </Pressable>
            </View>
          ))}
        </>
      ) : null}

      {examTab === "pending" ? (
        <>
          {pending.length === 0 ? <Text style={styles.empty}>{t("home.noInvitations")}</Text> : null}
          {pending.map((exam) => {
            const start = asDate(exam.scheduledStartTime);
            const waiting = !!start && start.getTime() > now;
            const canStart = exam.status === "active" && !waiting;
            return (
              <View key={exam.invitationId || exam.id} style={styles.card}>
                <Text style={styles.cardTitle}>{exam.title || t("home.exam")}</Text>
                {start ? <Text style={styles.cardMeta}>{t("home.scheduled", { when: formatWhen(exam.scheduledStartTime) })}</Text> : null}
                <Text style={styles.cardMeta}>
                  {t("home.attempts", { used: exam.attemptsUsed, max: exam.maxAttempts })}
                  {exam.expiresAt ? t("home.expiresSuffix", { when: formatWhen(exam.expiresAt) }) : ""}
                </Text>
                {waiting && start ? <Text style={styles.warn}>{t("home.availableIn", { time: formatCountdown(start.getTime() - now) })}</Text> : null}
                {exam.status !== "active" ? <Text style={styles.cardMeta}>{t("home.notAvailable")}</Text> : null}
                <Pressable
                  style={[styles.primary, !canStart && styles.disabled]}
                  disabled={!canStart || starting === exam.invitationId}
                  onPress={() => exam.invitationId && openSession(exam.invitationId)}
                >
                  {starting === exam.invitationId ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t("home.startExam")}</Text>}
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}

      {examTab === "done" ? (
        <>
          {completed.length === 0 ? <Text style={styles.empty}>{t("home.completedEmpty")}</Text> : null}
          {completed.map((entry) => {
            const pendingGrade = entry.latest?.gradingStatus === "pending_review" || entry.latest?.passed === null;
            return (
              <Pressable
                key={entry.examId}
                style={styles.card}
                onPress={() => entry.latest && navigation.navigate("Result", { resultId: entry.latest.id })}
              >
                <Text style={styles.cardTitle}>{entry.title}</Text>
                {entry.latest ? (
                  <Text style={[styles.score, pendingGrade ? styles.warn : entry.latest.passed ? styles.pass : styles.fail]}>
                    {pendingGrade
                      ? t("home.waiting")
                      : t("home.scoreLine", { percent: Math.round(entry.latest.percentage), outcome: entry.latest.passed ? t("home.passed") : t("home.notPassed") })}
                    {entry.count > 1 ? t("home.latestOf", { count: entry.count }) : ""}
                  </Text>
                ) : (
                  <Text style={styles.cardMeta}>{t("home.sessionsCompleted", { count: entry.sessionCount })}</Text>
                )}
                {entry.latest ? <Text style={styles.cardMeta}>{t("home.submitted", { when: formatWhen(entry.latest.submittedAt) })}</Text> : null}
              </Pressable>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

function ResultsPane() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await api.getExamResults();
    const list = res.data ?? [];
    list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    setResults(list);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(apiErrorMessage(err, t("home.loadResultsError")))).finally(() => setLoading(false));
  }, [load]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.list}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {results.length === 0 ? <Text style={styles.empty}>{t("home.resultsEmpty")}</Text> : null}
      {results.map((result) => {
        const pending = result.gradingStatus === "pending_review" || result.passed === null;
        return (
          <Pressable key={result.id} style={styles.card} onPress={() => navigation.navigate("Result", { resultId: result.id })}>
            <Text style={styles.cardTitle}>{result.examTitle || t("home.exam")}</Text>
            <Text style={styles.cardMeta}>{formatWhen(result.submittedAt)}</Text>
            <Text style={[styles.score, pending ? styles.warn : result.passed ? styles.pass : styles.fail]}>
              {pending ? t("home.waiting") : t("home.scoreLine", { percent: Math.round(result.percentage), outcome: result.passed ? t("home.passed") : t("home.notPassed") })}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function JoinPane({ onJoined }: { onJoined: () => void }) {
  const colors = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState<GroupJoinResult | null>(null);
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

  const join = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.joinGroupByCode(normalized);
      if (!res.data) throw new Error(t("home.couldNotJoin"));
      setJoined(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, t("home.couldNotJoin")));
    } finally {
      setBusy(false);
    }
  };

  if (joined) {
    return (
      <View style={styles.list}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{joined.alreadyMember ? t("home.alreadyIn", { name: joined.name }) : t("home.youJoined", { name: joined.name })}</Text>
          <Text style={styles.cardMeta}>
            {joined.invitationsCreated > 0
              ? t("home.invitationsAdded", { count: joined.invitationsCreated })
              : t("home.examsWillShow")}
          </Text>
          <Pressable style={styles.primary} onPress={onJoined}>
            <Text style={styles.primaryText}>{t("home.seeExams")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("home.joinTitle")}</Text>
        <Text style={styles.cardMeta}>{t("home.joinHint")}</Text>
        <TextInput
          style={styles.code}
          value={normalized}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          placeholder="ABCD1234"
          placeholderTextColor={colors.muted}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.primary, normalized.length < 8 && styles.disabled]} disabled={normalized.length < 8 || busy} onPress={join}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t("home.join")}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function LiveTimer({ seconds }: { seconds: number }) {
  const colors = useColors();
  const t = useT();
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    setRemaining(seconds);
    if (seconds <= 0) return;
    const id = setInterval(() => setRemaining((prev) => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);
  if (seconds <= 0) return null;
  return <Text style={{ marginTop: 6, fontWeight: "700", color: remaining <= 60 ? colors.danger : colors.text }}>{t("home.timeLeft", { time: formatClock(remaining) })}</Text>;
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  brand: { fontSize: 22, fontWeight: "800", color: colors.primary },
  hello: { color: colors.muted, marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.primary, fontWeight: "800" },
  tabBar: { flexGrow: 0, marginHorizontal: 16, marginBottom: 8 },
  fill: { flex: 1 },
  tabs: { flexDirection: "row", backgroundColor: colors.tab, borderRadius: 12, padding: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tabGrow: { flex: 1 },
  tabOn: { backgroundColor: colors.card },
  tabText: { color: colors.muted, fontWeight: "600" },
  tabTextOn: { color: colors.text },
  list: { padding: 16, paddingBottom: 40, gap: 10 },
  section: { marginTop: 8, fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  empty: { color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, ...shadow },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  cardMeta: { marginTop: 4, color: colors.muted, lineHeight: 20 },
  warn: { marginTop: 6, color: colors.warning, fontWeight: "600" },
  pass: { color: colors.success },
  fail: { color: colors.danger },
  score: { marginTop: 8, fontWeight: "700" },
  primary: { marginTop: 12, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.45 },
  error: { color: colors.danger },
  code: { marginTop: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 20, letterSpacing: 3, textAlign: "center", color: colors.text, fontWeight: "700" },
});
}
