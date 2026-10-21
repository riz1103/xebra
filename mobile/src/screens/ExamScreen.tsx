import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, usePreventRemove, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, apiErrorMessage } from "../api";
import { QuestionCard } from "../components/QuestionCard";
import { formatClock, isInProgress } from "../format";
import { useIntegrityLogger } from "../integrity";
import { resolveQuestionLayout } from "../question-layout";
import { useColors, type Palette } from "../theme";
import type { AnswerValue, ExamSession, PhraseBlock, SessionQuestion } from "../types";
import type { RootStackParamList } from "../navigation";

type Part = { id: string; name: string; questions: SessionQuestion[] };

function buildParts(session: ExamSession, questions: SessionQuestion[]): Part[] {
  const raw = session.questionsByPart;
  if (!raw) return [];
  const byId = new Map(questions.map((q) => [q.id, q]));
  const parts: Part[] = [];
  for (const [partId, group] of Object.entries(raw)) {
    const list =
      group.questions ??
      (group.questionIds ?? []).map((id) => byId.get(id)).filter((q): q is SessionQuestion => !!q);
    if (list.length) parts.push({ id: partId, name: group.part?.name || "Part", questions: list });
  }
  return parts;
}

function orderedQuestions(session: ExamSession): SessionQuestion[] {
  const all = session.questions ?? [];
  const ids = session.selectedQuestionIds;
  if (!ids?.length) return all;
  const byId = new Map(all.map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter((q): q is SessionQuestion => !!q);
}

function phraseFor(question: SessionQuestion, session: ExamSession, previous?: SessionQuestion): PhraseBlock | null {
  if (!question.phraseId || previous?.phraseId === question.phraseId) return null;
  const phrase = question.phrase ?? session.phrases?.[question.phraseId];
  return phrase && typeof phrase === "object" ? phrase : null;
}

function answered(value: AnswerValue | undefined): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return value.some((item) => String(item ?? "").trim().length > 0);
}

export function ExamScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Exam">>();
  const { sessionId } = route.params;

  const [session, setSession] = useState<ExamSession | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [index, setIndex] = useState(0);
  const [partId, setPartId] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [seconds, setSeconds] = useState(0);
  const [limited, setLimited] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [layouts, setLayouts] = useState<Map<string, ReturnType<typeof resolveQuestionLayout>>>(new Map());
  const plays = useRef<Record<string, number>>({});
  const [, setPlayTick] = useState(0);
  const questionIdRef = useRef<string | undefined>(undefined);
  const answersRef = useRef(answers);
  const indexRef = useRef(index);
  const booted = useRef(false);
  const extraRef = useRef(0);
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingText = useRef<{ questionId: string; answer: AnswerValue } | null>(null);
  answersRef.current = answers;
  indexRef.current = index;

  const load = useCallback(async () => {
    const [sessionRes, typeRes] = await Promise.all([
      api.getExamSession(sessionId, true),
      api.getQuestionTypes().catch(() => ({ data: [] })),
    ]);
    if (!sessionRes.data) throw new Error("Exam not found.");
    setSession(sessionRes.data);
    setLayouts(new Map((typeRes.data ?? []).map((type) => [type.id, resolveQuestionLayout(type)])));
    return sessionRes.data;
  }, [sessionId]);

  useEffect(() => {
    load()
      .catch((err) => setError(apiErrorMessage(err, "Could not open this exam.")))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!session || booted.current) return;
    booted.current = true;
    setAnswers(session.answers ?? {});
    setIndex(session.currentQuestionIndex || 0);
    const remaining = session.timeRemainingSeconds || 0;
    setSeconds(remaining);
    setLimited(remaining > 0);
    extraRef.current = session.extraTimeSeconds ?? 0;
    const parts = buildParts(session, orderedQuestions(session));
    if (parts[0]) setPartId(parts[0].id);
  }, [session]);

  const questions = useMemo(() => (session ? orderedQuestions(session) : []), [session]);
  const parts = useMemo(() => (session ? buildParts(session, questions) : []), [session, questions]);
  const currentList = parts.find((part) => part.id === partId)?.questions ?? questions;
  const question = currentList[Math.min(index, Math.max(currentList.length - 1, 0))];
  const inProgress = isInProgress(session?.status);
  const taking = inProgress && !(showInstructions && session?.exam);
  questionIdRef.current = question?.id;
  const { flush: flushIntegrity, recordPaste } = useIntegrityLogger(sessionId, taking, questionIdRef);

  const flushText = useCallback(async () => {
    const pending = pendingText.current;
    if (!pending) return;
    if (textTimer.current) clearTimeout(textTimer.current);
    textTimer.current = null;
    pendingText.current = null;
    try {
      await api.answerQuestion(sessionId, pending.questionId, pending.answer);
    } catch {
      /* kept locally; the next save retries via updateExamSession */
    }
  }, [sessionId]);

  const saveAnswer = useCallback(
    (questionId: string, answer: AnswerValue, immediate: boolean) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
      if (!immediate) {
        pendingText.current = { questionId, answer };
        if (textTimer.current) clearTimeout(textTimer.current);
        textTimer.current = setTimeout(() => {
          flushText();
        }, 700);
        return;
      }
      api.answerQuestion(sessionId, questionId, answer).catch(() => {});
    },
    [flushText, sessionId]
  );

  const submit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setConfirmOpen(false);
    try {
      await flushText();
      await flushIntegrity();
      await api.updateExamSession(sessionId, {
        currentQuestionIndex: indexRef.current,
        answers: answersRef.current,
      });
      const res = await api.submitExamSession(sessionId);
      const resultId = res.data?.result?.id;
      if (resultId) navigation.replace("Result", { resultId });
      else navigation.navigate("Home");
    } catch (err) {
      setSubmitting(false);
      Alert.alert("Could not submit", apiErrorMessage(err, "Try again in a moment."));
    }
  }, [flushIntegrity, flushText, navigation, sessionId, submitting]);

  useEffect(() => {
    if (!taking || !limited) return;
    const id = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          submit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [taking, limited, submit]);

  useEffect(() => {
    if (!inProgress) return;
    const id = setInterval(() => {
      api
        .updateExamSession(sessionId, { currentQuestionIndex: indexRef.current, answers: answersRef.current })
        .then((res) => {
          const latest = res.data;
          if (!latest) return;
          if (!isInProgress(latest.status)) {
            setSession(latest);
            return;
          }
          const extra = latest.extraTimeSeconds ?? 0;
          if (extra > extraRef.current) {
            const delta = extra - extraRef.current;
            extraRef.current = extra;
            setSeconds((prev) => prev + delta);
            setLimited(true);
          }
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [inProgress, sessionId]);

  usePreventRemove(inProgress && !submitting, ({ data }) => {
    Alert.alert("Leave this exam?", "Answers already saved stay on the exam. You can resume it from Exams.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!session || error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>{error || "Exam not found."}</Text>
          <Pressable style={styles.primary} onPress={() => navigation.navigate("Home")}>
            <Text style={styles.primaryText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!inProgress) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>This attempt is finished</Text>
          <Text style={styles.muted}>{session.examTitle}</Text>
          <Pressable style={styles.primary} onPress={() => navigation.navigate("Home")}>
            <Text style={styles.primaryText}>Back to exams</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (showInstructions && session.exam) {
    const multiplier = session.timeMultiplier ?? 1;
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>Exam instructions</Text>
          <Text style={styles.muted}>Read these before you start. You can still resume later if you leave.</Text>
          {session.exam.instruction ? <Text style={styles.instruction}>{session.exam.instruction}</Text> : null}
          {parts.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sheetTitle}>Exam structure</Text>
              {parts.map((part) => {
                const group = session.questionsByPart?.[part.id];
                const minutes = group?.part.timeLimit;
                return (
                  <Text key={part.id} style={styles.muted}>
                    {part.name}
                    {group?.part.description ? ` — ${group.part.description}` : ""} ({part.questions.length} questions
                    {minutes ? `, ${minutes} minutes` : ""})
                  </Text>
                );
              })}
            </View>
          ) : null}
          {multiplier > 1 ? (
            <Text style={styles.muted}>Your time limit includes extra time ({Number(multiplier.toFixed(2))}× the standard time).</Text>
          ) : null}
          <Text style={styles.muted}>
            Leaving the app or pasting an answer is noted for your proctor. The text you paste is not recorded.
          </Text>
          <Pressable style={styles.primary} onPress={() => setShowInstructions(false)}>
            <Text style={styles.primaryText}>Start exam</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const doneCount = currentList.filter((item) => answered(answers[item.id])).length;
  const urgent = limited && seconds <= 60;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.link}>Close</Text>
        </Pressable>
        <Text style={styles.examTitle} numberOfLines={1}>{session.examTitle || "Exam"}</Text>
        <Text style={[styles.clock, urgent && styles.clockUrgent]}>{limited ? formatClock(seconds) : ""}</Text>
      </View>
      {parts.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.parts}>
          {parts.map((part) => (
            <Pressable
              key={part.id}
              style={[styles.part, part.id === partId && styles.partOn]}
              onPress={() => {
                setPartId(part.id);
                setIndex(0);
              }}
            >
              <Text style={[styles.partText, part.id === partId && styles.partTextOn]}>{part.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {question ? (
          <QuestionCard
            question={question}
            index={index}
            total={currentList.length}
            partName={parts.find((part) => part.id === partId)?.name}
            layout={layouts.get(question.questionTypeId) ?? "multiple_choice"}
            answer={answers[question.id]}
            flagged={flagged.has(question.id)}
            phrase={phraseFor(question, session, currentList[index - 1])}
            playsUsed={plays.current[question.id] ?? 0}
            onPlayAudio={() => {
              plays.current[question.id] = (plays.current[question.id] ?? 0) + 1;
              setPlayTick((n) => n + 1);
            }}
            onFlag={() =>
              setFlagged((prev) => {
                const next = new Set(prev);
                if (next.has(question.id)) next.delete(question.id);
                else next.add(question.id);
                return next;
              })
            }
            onAnswer={(value) => {
              const text =
                question.metadata?.answerFormat == null &&
                (layouts.get(question.questionTypeId) === "essay" ||
                  layouts.get(question.questionTypeId) === "identification" ||
                  (question.options?.length ?? 0) === 0);
              saveAnswer(question.id, value, !text);
            }}
            onPaste={recordPaste}
          />
        ) : (
          <Text style={styles.muted}>This exam has no questions.</Text>
        )}
      </ScrollView>
      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <Pressable style={styles.navBtn} disabled={index <= 0} onPress={() => setIndex((n) => Math.max(0, n - 1))}>
          <Text style={[styles.navText, index <= 0 && styles.navOff]}>Previous</Text>
        </Pressable>
        <Pressable onPress={() => setNavOpen(true)}>
          <Text style={styles.count}>{currentList.length ? index + 1 : 0}/{currentList.length}</Text>
          <Text style={styles.answered}>{doneCount} answered</Text>
        </Pressable>
        {index < currentList.length - 1 ? (
          <Pressable style={styles.navBtn} onPress={() => setIndex((n) => n + 1)}>
            <Text style={[styles.navText, styles.navStrong]}>Next</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.navBtn} onPress={() => setConfirmOpen(true)}>
            <Text style={[styles.navText, styles.navStrong]}>Finish</Text>
          </Pressable>
        )}
      </SafeAreaView>

      <Modal visible={navOpen} animationType="slide" transparent onRequestClose={() => setNavOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setNavOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Questions</Text>
            <Text style={styles.muted}>{doneCount} of {currentList.length} answered{flagged.size ? ` · ${flagged.size} flagged` : ""}</Text>
            <View style={styles.grid}>
              {currentList.map((item, i) => {
                const on = answered(answers[item.id]);
                const here = i === index;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.cell, on && styles.cellOn, here && styles.cellHere, flagged.has(item.id) && styles.cellFlag]}
                    onPress={() => {
                      setIndex(i);
                      setNavOpen(false);
                    }}
                  >
                    <Text style={[styles.cellText, on && styles.cellTextOn, here && styles.cellTextHere]}>{i + 1}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.scrim}>
          <View style={styles.dialog}>
            <Text style={styles.sheetTitle}>Submit this exam?</Text>
            <Text style={styles.muted}>
              {doneCount} of {currentList.length} answered.
              {doneCount < currentList.length ? ` ${currentList.length - doneCount} still blank.` : ""}
              {flagged.size ? ` ${flagged.size} flagged.` : ""} You can't change answers after this.
            </Text>
            <Pressable style={styles.primary} onPress={submit}>
              <Text style={styles.primaryText}>Submit</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setConfirmOpen(false)}>
              <Text style={styles.link}>Keep working</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {submitting ? (
        <View style={styles.blocking}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.blockingText}>Submitting…</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  link: { color: colors.primary, fontWeight: "700" },
  examTitle: { flex: 1, textAlign: "center", fontWeight: "700", color: colors.text },
  clock: { minWidth: 52, textAlign: "right", fontVariant: ["tabular-nums"], fontWeight: "700", color: colors.text },
  clockUrgent: { color: colors.danger },
  parts: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  part: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  partOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  partText: { color: colors.text, fontWeight: "600" },
  partTextOn: { color: "#fff" },
  body: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  instruction: { marginTop: 12, color: colors.text, fontSize: 16, lineHeight: 24 },
  card: { marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 6 },
  muted: { color: colors.muted, lineHeight: 20 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  navBtn: { minWidth: 88, paddingVertical: 12, alignItems: "center" },
  navText: { color: colors.text, fontWeight: "600" },
  navStrong: { color: colors.primary },
  navOff: { color: colors.border },
  count: { textAlign: "center", fontWeight: "800", color: colors.text },
  answered: { textAlign: "center", color: colors.muted, fontSize: 12 },
  scrim: { flex: 1, backgroundColor: "rgba(28,23,48,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 28 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  cell: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  cellOn: { backgroundColor: colors.primarySoft },
  cellHere: { backgroundColor: colors.primary },
  cellFlag: { borderWidth: 2, borderColor: colors.flag },
  cellText: { color: colors.text, fontWeight: "700" },
  cellTextOn: { color: colors.primary },
  cellTextHere: { color: "#fff" },
  dialog: { margin: 24, marginBottom: "auto", marginTop: "auto", backgroundColor: colors.card, borderRadius: 18, padding: 18 },
  primary: { marginTop: 16, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondary: { marginTop: 8, paddingVertical: 12, alignItems: "center" },
  blocking: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(28,23,48,0.55)", alignItems: "center", justifyContent: "center", gap: 12 },
  blockingText: { color: "#fff", fontWeight: "700" },
});
}
