import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, apiErrorMessage } from "../api";
import { useAuth } from "../auth";
import { formatWhen } from "../format";
import { useT } from "../i18n";
import { MathText } from "../math-text";
import { pickNoteFiles, pickNotePhotos, sourceFromText, type NoteSource } from "../notes";
import { generatePracticeQuiz, practiceAnswerIsCorrect, type PracticeQuestion, type PracticeQuizRequest } from "../practice";
import { useColors, type Palette } from "../theme";
import type { StudyTopic } from "../types";

const COUNTS = [5, 10, 15, 20];
const DIFFICULTIES = ["mixed", "easy", "medium", "hard"] as const;
const QUIZ_LANGUAGES = ["English", "Filipino", "Spanish", "French", "German", "Japanese", "Chinese", "Korean", "Arabic", "Hindi", "Indonesian", "Portuguese", "Vietnamese"];
const HISTORY_LIMIT = 20;

interface PracticeAttempt {
  at: string;
  topics: string[];
  notes: string[];
  score: number;
  total: number;
}

const historyKey = (uid: string) => `xebra:practice-history:${uid}`;

async function loadHistory(uid: string): Promise<PracticeAttempt[]> {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(historyKey(uid))) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function PracticeScreen() {
  const { user } = useAuth();
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [phase, setPhase] = useState<"setup" | "quiz" | "results">("setup");
  const [request, setRequest] = useState<PracticeQuizRequest | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<PracticeAttempt[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    loadHistory(user.uid).then(setHistory).catch(() => undefined);
  }, [user?.uid]);

  const start = async (req: PracticeQuizRequest) => {
    setGenerating(true);
    setError("");
    try {
      const quiz = await generatePracticeQuiz(req);
      if (quiz.length === 0) {
        setError(t("practice.emptyQuiz"));
        return;
      }
      setRequest(req);
      setQuestions(quiz);
      setAnswers([]);
      setPhase("quiz");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("practice.couldNot"));
    } finally {
      setGenerating(false);
    }
  };

  const finish = (final: string[]) => {
    setAnswers(final);
    setPhase("results");
    if (!user?.uid || !request) return;
    const attempt: PracticeAttempt = {
      at: new Date().toISOString(),
      topics: request.topics,
      notes: (request.sources ?? []).map((source) => source.name),
      score: questions.filter((question, i) => practiceAnswerIsCorrect(question, final[i])).length,
      total: questions.length,
    };
    const next = [attempt, ...history].slice(0, HISTORY_LIMIT);
    setHistory(next);
    AsyncStorage.setItem(historyKey(user.uid), JSON.stringify(next)).catch(() => undefined);
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t("practice.title")}</Text>
      <Text style={styles.subtitle}>{t("practice.subtitle")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {phase === "setup" ? (
        <PracticeSetup generating={generating} history={history} onStart={start} />
      ) : null}
      {phase === "quiz" ? <PracticeQuiz key={questions.map((q) => q.question).join("|")} questions={questions} onFinish={finish} /> : null}
      {phase === "results" ? (
        <PracticeResults
          questions={questions}
          answers={answers}
          generating={generating}
          onRetry={() => request && start(request)}
          onNew={() => {
            setError("");
            setPhase("setup");
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function PracticeSetup({
  generating,
  history,
  onStart,
}: {
  generating: boolean;
  history: PracticeAttempt[];
  onStart: (req: PracticeQuizRequest) => void;
}) {
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [threshold, setThreshold] = useState(70);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [custom, setCustom] = useState("");
  const [paste, setPaste] = useState("");
  const [sources, setSources] = useState<NoteSource[]>([]);
  const [reading, setReading] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<PracticeQuizRequest["difficulty"]>("mixed");
  const [language, setLanguage] = useState("");

  useEffect(() => {
    api
      .getStudyTopics()
      .then((res) => {
        const list = res.data?.topics ?? [];
        setTopics(list);
        setThreshold(res.data?.threshold ?? 70);
        if (!seeded) {
          setSelected(list.filter((topic) => topic.weak).map((topic) => topic.topic).slice(0, 5));
          setSeeded(true);
        }
      })
      .catch(() => setTopics([]))
      .finally(() => setLoadingTopics(false));
  }, [seeded]);

  const toggle = (topic: string) => setSelected((prev) => (prev.includes(topic) ? prev.filter((item) => item !== topic) : [...prev, topic]));
  const addCustom = () => {
    const topic = custom.trim();
    if (!topic) return;
    setSelected((prev) => (prev.includes(topic) ? prev : [...prev, topic]));
    setCustom("");
  };
  const addSources = async (pick: () => Promise<NoteSource[]>) => {
    setReading(true);
    setNoteError("");
    try {
      const next = await pick();
      setSources((prev) => [...prev, ...next]);
      const warnings = next.flatMap((source) => source.warnings);
      if (warnings.length) setNoteError(warnings.join(" "));
    } catch (err) {
      setNoteError(apiErrorMessage(err, t("practice.couldNot")));
    } finally {
      setReading(false);
    }
  };

  const other = selected.filter((topic) => !topics.some((item) => item.topic === topic));
  const pasted = paste.trim() ? [sourceFromText(paste.trim(), t("practice.paste"))] : [];
  const allSources = [...sources, ...pasted];
  const canStart = (selected.length > 0 || allSources.length > 0) && !generating && !reading;

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("practice.choose")}</Text>
        <Text style={styles.muted}>{t("practice.chooseHint")}</Text>
        <Text style={styles.label}>{t("practice.fromExams")}</Text>
        {loadingTopics ? <ActivityIndicator color={colors.primary} /> : null}
        {!loadingTopics && topics.length === 0 ? <Text style={styles.muted}>{t("practice.noTopics")}</Text> : null}
        <View style={styles.chips}>
          {topics.map((topic) => {
            const on = selected.includes(topic.topic);
            return (
              <Pressable key={topic.topic} onPress={() => toggle(topic.topic)} style={[styles.chip, on && styles.chipOn, !on && topic.weak && styles.chipWeak]}>
                <Text style={[styles.chipText, on && styles.chipTextOn, !on && topic.weak && styles.chipWeakText]}>
                  {topic.topic} · {topic.percentage ?? 0}%
                </Text>
              </Pressable>
            );
          })}
        </View>
        {topics.some((topic) => topic.weak) ? <Text style={styles.muted}>{t("practice.weakHint", { threshold })}</Text> : null}
        <Text style={styles.label}>{t("practice.other")}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={custom}
            placeholder={t("practice.topicPlaceholder")}
            placeholderTextColor={colors.muted}
            onChangeText={setCustom}
            onSubmitEditing={addCustom}
          />
          <Pressable style={[styles.secondary, !custom.trim() && styles.disabled]} disabled={!custom.trim()} onPress={addCustom}>
            <Text style={styles.secondaryText}>{t("practice.add")}</Text>
          </Pressable>
        </View>
        <View style={styles.chips}>
          {other.map((topic) => (
            <Pressable key={topic} onPress={() => toggle(topic)} style={styles.chip}>
              <Text style={styles.chipText}>{topic} ×</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>{t("practice.notes")}</Text>
        <View style={styles.row}>
          <Pressable style={styles.secondary} disabled={reading} onPress={() => addSources(pickNotePhotos)}>
            <Text style={styles.secondaryText}>{t("practice.photos")}</Text>
          </Pressable>
          <Pressable style={styles.secondary} disabled={reading} onPress={() => addSources(pickNoteFiles)}>
            <Text style={styles.secondaryText}>{t("practice.files")}</Text>
          </Pressable>
        </View>
        {reading ? <ActivityIndicator color={colors.primary} /> : null}
        <Text style={styles.muted}>{t("practice.notesHint")}</Text>
        {noteError ? <Text style={styles.error}>{noteError}</Text> : null}
        {sources.map((source) => (
          <View key={source.id} style={styles.fileRow}>
            <Text style={styles.fileName} numberOfLines={1}>{source.name}</Text>
            <Pressable onPress={() => setSources((prev) => prev.filter((item) => item.id !== source.id))} accessibilityLabel={t("practice.remove", { topic: source.name })}>
              <Text style={styles.secondaryText}>×</Text>
            </Pressable>
          </View>
        ))}
        <Text style={styles.label}>{t("practice.paste")}</Text>
        <TextInput
          style={[styles.input, styles.paste]}
          value={paste}
          onChangeText={setPaste}
          multiline
          placeholderTextColor={colors.muted}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("practice.settings")}</Text>
        <Text style={styles.label}>{t("practice.questions")}</Text>
        <View style={styles.chips}>
          {COUNTS.map((value) => (
            <Pressable key={value} onPress={() => setCount(value)} style={[styles.chip, count === value && styles.chipOn]}>
              <Text style={[styles.chipText, count === value && styles.chipTextOn]}>{t("practice.questionCount", { count: value })}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>{t("practice.difficulty")}</Text>
        <View style={styles.chips}>
          {DIFFICULTIES.map((value) => {
            const label = value === "mixed" ? t("practice.mixed") : value === "easy" ? t("practice.easy") : value === "medium" ? t("practice.medium") : t("practice.hard");
            return (
              <Pressable key={value} onPress={() => setDifficulty(value)} style={[styles.chip, difficulty === value && styles.chipOn]}>
                <Text style={[styles.chipText, difficulty === value && styles.chipTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.label}>{t("practice.language")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable onPress={() => setLanguage("")} style={[styles.chip, language === "" && styles.chipOn]}>
            <Text style={[styles.chipText, language === "" && styles.chipTextOn]}>{t("practice.autoLanguage")}</Text>
          </Pressable>
          {QUIZ_LANGUAGES.map((value) => (
            <Pressable key={value} onPress={() => setLanguage(value)} style={[styles.chip, language === value && styles.chipOn]}>
              <Text style={[styles.chipText, language === value && styles.chipTextOn]}>{value}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Pressable
        style={[styles.primary, !canStart && styles.disabled]}
        disabled={!canStart}
        onPress={() => onStart({ topics: selected, sources: allSources, count, difficulty, language: language || undefined })}
      >
        {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t("practice.start")}</Text>}
      </Pressable>
      {generating ? <Text style={styles.muted}>{t("practice.writing")}</Text> : null}
      <Text style={styles.centerMuted}>{t("practice.limitNote")}</Text>

      {history.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("practice.recent")}</Text>
          <Text style={styles.muted}>{t("practice.savedHere")}</Text>
          {history.map((item) => (
            <View key={item.at} style={styles.fileRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>{[...item.topics, ...item.notes].join(", ") || t("practice.fallbackName")}</Text>
                <Text style={styles.muted}>{formatWhen(item.at)}</Text>
              </View>
              <Text style={item.score / item.total >= 0.7 ? styles.pass : styles.muted}>{item.score}/{item.total}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PracticeQuiz({ questions, onFinish }: { questions: PracticeQuestion[]; onFinish: (answers: string[]) => void }) {
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [checked, setChecked] = useState(false);
  const question = questions[index];
  const answer = answers[index] ?? "";
  const correct = checked && practiceAnswerIsCorrect(question, answer);
  const isLast = index === questions.length - 1;

  const setAnswer = (value: string) => {
    if (checked) return;
    setAnswers((prev) => prev.map((item, i) => (i === index ? value : item)));
  };
  const next = () => {
    if (isLast) return onFinish(answers);
    setIndex(index + 1);
    setChecked(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.fileRow}>
        <Text style={styles.muted}>{t("practice.questionN", { n: index + 1, total: questions.length })}</Text>
        {question.topic ? <Text style={styles.badge}>{question.topic}</Text> : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.trackOn, { width: `${((index + (checked ? 1 : 0)) / questions.length) * 100}%` }]} />
      </View>
      <MathText text={question.question} style={styles.stem} />
      {question.type === "identification" ? (
        <TextInput
          style={styles.input}
          value={answer}
          editable={!checked}
          placeholder={t("practice.typeAnswer")}
          placeholderTextColor={colors.muted}
          onChangeText={setAnswer}
          onSubmitEditing={() => {
            if (answer.trim()) checked ? next() : setChecked(true);
          }}
        />
      ) : (
        question.options.map((option, i) => {
          const isKey = checked && practiceAnswerIsCorrect(question, option);
          const isWrong = checked && option === answer && !isKey;
          return (
            <Pressable
              key={`${i}-${option}`}
              disabled={checked}
              onPress={() => setAnswer(option)}
              style={[styles.option, !checked && option === answer && styles.optionOn, isKey && styles.optionRight, isWrong && styles.optionWrong]}
            >
              <Text style={styles.letter}>{String.fromCharCode(65 + i)}.</Text>
              <MathText text={option} style={styles.optionText} />
            </Pressable>
          );
        })
      )}
      {checked ? (
        <View style={[styles.feedback, correct ? styles.optionRight : styles.optionWrong]}>
          <Text style={styles.feedbackTitle}>{correct ? t("practice.correct") : t("practice.notQuite")}</Text>
          {!correct ? <MathText text={question.answer} style={styles.optionText} /> : null}
          {question.explanation ? <MathText text={question.explanation} style={styles.muted} /> : null}
        </View>
      ) : null}
      <Pressable
        style={[styles.primary, !checked && !answer.trim() && styles.disabled]}
        disabled={!checked && !answer.trim()}
        onPress={() => (checked ? next() : setChecked(true))}
      >
        <Text style={styles.primaryText}>{checked ? (isLast ? t("practice.seeResults") : t("practice.next")) : t("practice.check")}</Text>
      </Pressable>
    </View>
  );
}

function PracticeResults({
  questions,
  answers,
  generating,
  onRetry,
  onNew,
}: {
  questions: PracticeQuestion[];
  answers: string[];
  generating: boolean;
  onRetry: () => void;
  onNew: () => void;
}) {
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const score = questions.filter((question, i) => practiceAnswerIsCorrect(question, answers[i] ?? "")).length;
  const percentage = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const missed = [...new Set(questions.filter((question, i) => !practiceAnswerIsCorrect(question, answers[i] ?? "") && question.topic).map((question) => question.topic))];

  return (
    <View style={styles.stack}>
      <View style={[styles.card, styles.center]}>
        <Text style={styles.percent}>{percentage}%</Text>
        <Text style={styles.muted}>{t("practice.correctOf", { score, total: questions.length })}</Text>
        {missed.length > 0 ? <Text style={styles.muted}>{t("practice.worth", { topics: missed.join(", ") })}</Text> : null}
        <Pressable style={styles.secondary} disabled={generating} onPress={onRetry}>
          <Text style={styles.secondaryText}>{t("practice.retry")}</Text>
        </Pressable>
        <Pressable style={styles.primary} disabled={generating} onPress={onNew}>
          <Text style={styles.primaryText}>{t("practice.new")}</Text>
        </Pressable>
        {generating ? <Text style={styles.muted}>{t("practice.writingNew")}</Text> : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("practice.review")}</Text>
        {questions.map((question, i) => {
          const ok = practiceAnswerIsCorrect(question, answers[i] ?? "");
          return (
            <View key={i} style={styles.reviewItem}>
              <Text style={ok ? styles.pass : styles.fail}>{ok ? t("practice.correct") : t("practice.notQuite")}</Text>
              <MathText text={question.question} style={styles.stem} />
              <Text style={styles.muted}>{t("practice.yourAnswer", { answer: answers[i] || "—" })}</Text>
              {!ok ? <Text style={styles.body}>{t("practice.correctWas", { answer: question.answer })}</Text> : null}
              {!ok && question.explanation ? <MathText text={question.explanation} style={styles.muted} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 40, gap: 8 },
    title: { fontSize: 28, fontWeight: "800", color: colors.text },
    subtitle: { color: colors.muted, marginBottom: 8 },
    stack: { gap: 12 },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 },
    cardTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
    muted: { color: colors.muted, lineHeight: 20 },
    centerMuted: { color: colors.muted, textAlign: "center", lineHeight: 18, fontSize: 12 },
    label: { marginTop: 8, color: colors.text, fontWeight: "700" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
    chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipWeak: { borderColor: colors.danger },
    chipText: { color: colors.text, fontSize: 13 },
    chipTextOn: { color: "#fff", fontWeight: "700" },
    chipWeakText: { color: colors.danger },
    row: { flexDirection: "row", gap: 8, alignItems: "center" },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, backgroundColor: colors.bg },
    paste: { minHeight: 88, textAlignVertical: "top" },
    secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, alignItems: "center" },
    secondaryText: { color: colors.primary, fontWeight: "700" },
    fileRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    fileName: { flex: 1, color: colors.text, fontWeight: "600" },
    primary: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    primaryText: { color: "#fff", fontWeight: "800" },
    disabled: { opacity: 0.45 },
    error: { color: colors.danger },
    pass: { color: colors.success, fontWeight: "700" },
    fail: { color: colors.danger, fontWeight: "700" },
    badge: { color: colors.primary, fontWeight: "700", fontSize: 12 },
    track: { height: 6, borderRadius: 99, backgroundColor: colors.tab, overflow: "hidden" },
    trackOn: { height: 6, backgroundColor: colors.primary },
    stem: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: "700" },
    option: { flexDirection: "row", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
    optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    optionRight: { borderColor: colors.success, backgroundColor: colors.successBg },
    optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
    letter: { color: colors.muted, fontWeight: "800" },
    optionText: { flex: 1, color: colors.text },
    feedback: { borderRadius: 12, padding: 12, gap: 4 },
    feedbackTitle: { fontWeight: "800", color: colors.text },
    center: { alignItems: "center" },
    percent: { fontSize: 42, fontWeight: "800", color: colors.text },
    reviewItem: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 4 },
    body: { color: colors.text },
  });
}
