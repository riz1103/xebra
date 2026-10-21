import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { api, apiErrorMessage } from "../api";
import { MathText } from "../math-text";
import { formatWhen } from "../format";
import { useColors, type Palette } from "../theme";
import type { AnswerValue, ExamDetail, ExamResult, ReviewQuestion } from "../types";
import type { RootStackParamList } from "../navigation";

export function ResultScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "Result">>();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getExamResult(route.params.resultId)
      .then(async (res) => {
        const next = res.data ?? null;
        setResult(next);
        if (next?.reviewableByExaminee && (next.questionResults?.length ?? 0) > 0) {
          const examRes = await api.getExam(next.examId);
          setExam(examRes.data ?? null);
        }
      })
      .catch((err) => setError(apiErrorMessage(err, "Could not load this result.")));
  }, [route.params.resultId]);

  if (error) {
    return (
      <View style={styles.page}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!result) {
    return (
      <View style={styles.page}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const pending = result.gradingStatus === "pending_review" || result.passed === null;
  const tone = pending ? styles.pending : result.passed ? styles.passed : styles.failed;
  const questions = exam?.questions ?? [];
  const byId = new Map(questions.map((question) => [question.id, question]));
  const review = result.reviewableByExaminee && (result.questionResults?.length ?? 0) > 0;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{result.examTitle || "Exam result"}</Text>
      <Text style={styles.when}>Submitted {formatWhen(result.submittedAt || result.createdAt)}</Text>
      {result.startedAt ? <Text style={styles.when}>Started {formatWhen(result.startedAt)}</Text> : null}
      <View style={[styles.scoreCard, tone]}>
        <Text style={styles.percent}>{pending ? "—" : `${Math.round(result.percentage)}%`}</Text>
        <Text style={styles.outcome}>
          {pending ? "Waiting for a proctor to grade written answers" : result.passed ? "Passed" : "Not passed"}
        </Text>
        <Text style={styles.points}>
          {result.score} / {result.totalPoints} points{pending ? " so far" : ""}
        </Text>
        {pending ? (
          <Text style={styles.note}>
            Your final score appears after{" "}
            {result.pendingReviewCount === 1 ? "1 written answer is" : `${result.pendingReviewCount ?? "the written answers"} are`} graded.
          </Text>
        ) : null}
      </View>
      <View style={styles.row}>
        <Stat label="Correct" value={String(result.correctCount ?? 0)} />
        <Stat label="Incorrect" value={String(result.incorrectCount ?? 0)} />
        <Stat label="Questions" value={String(result.totalQuestions ?? 0)} />
      </View>
      {result.timeSpentMinutes != null ? <Text style={styles.note}>Time spent: {result.timeSpentMinutes} min</Text> : null}
      {result.feedback ? <Text style={styles.note}>{result.feedback}</Text> : null}

      {review ? (
        <View style={styles.review}>
          <Text style={styles.reviewTitle}>Your answers</Text>
          <Text style={styles.when}>Each question, what you answered, and whether it was correct.</Text>
          {(result.questionResults ?? []).map((item, index) => {
            const question = byId.get(item.questionId);
            return (
              <ReviewCard
                key={item.questionId}
                index={index}
                question={question}
                correct={item.isCorrect}
                pendingReview={item.pendingReview === true}
                feedback={item.feedback}
                answer={result.answers?.[item.questionId]}
              />
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

function ReviewCard({
  index,
  question,
  correct,
  pendingReview,
  feedback,
  answer,
}: {
  index: number;
  question?: ReviewQuestion;
  correct: boolean;
  pendingReview: boolean;
  feedback?: string;
  answer: AnswerValue | undefined;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tone = pendingReview ? styles.warn : correct ? styles.pass : styles.fail;
  const label = pendingReview ? "Needs grading" : correct ? "Correct" : "Incorrect";
  const yours = formatAnswer(answer);
  const expected = question?.correctAnswer;
  const correctText = expected == null ? "" : Array.isArray(expected) ? expected.join(", ") : expected;

  return (
    <View style={styles.card}>
      <Text style={[styles.badge, tone]}>
        {index + 1}. {label}
      </Text>
      {question ? <MathText text={question.questionText} style={styles.stem} /> : <Text style={styles.stem}>Question {index + 1}</Text>}
      <Text style={styles.meta}>Your answer</Text>
      <MathText text={yours || "No answer"} style={styles.answer} />
      {correctText ? (
        <>
          <Text style={styles.meta}>Correct answer</Text>
          <MathText text={correctText} style={styles.answer} />
        </>
      ) : null}
      {question?.explanation ? (
        <>
          <Text style={styles.meta}>Explanation</Text>
          <MathText text={question.explanation} style={styles.answer} />
        </>
      ) : null}
      {feedback ? <Text style={styles.note}>{feedback}</Text> : null}
    </View>
  );
}

function formatAnswer(answer: AnswerValue | undefined): string {
  if (answer == null) return "";
  return Array.isArray(answer) ? answer.filter(Boolean).join(", ") : answer;
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, paddingBottom: 40 },
    title: { fontSize: 24, fontWeight: "800", color: colors.text },
    when: { marginTop: 4, color: colors.muted },
    scoreCard: { marginTop: 16, borderRadius: 18, padding: 20, alignItems: "center", borderWidth: 1 },
    passed: { backgroundColor: colors.successBg, borderColor: colors.success },
    failed: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
    pending: { backgroundColor: colors.warningBg, borderColor: colors.warning },
    percent: { fontSize: 42, fontWeight: "800", color: colors.text },
    outcome: { marginTop: 4, fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
    points: { marginTop: 4, color: colors.muted },
    row: { flexDirection: "row", gap: 8, marginTop: 16 },
    stat: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    statValue: { fontSize: 20, fontWeight: "800", color: colors.text },
    statLabel: { marginTop: 2, color: colors.muted, fontSize: 12 },
    note: { marginTop: 12, color: colors.muted, lineHeight: 20 },
    error: { color: colors.danger, padding: 20 },
    review: { marginTop: 22, gap: 10 },
    reviewTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border },
    badge: { fontWeight: "800" },
    pass: { color: colors.success },
    fail: { color: colors.danger },
    warn: { color: colors.warning },
    stem: { marginTop: 8, color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "600" },
    meta: { marginTop: 10, color: colors.muted, fontSize: 12, fontWeight: "700" },
    answer: { marginTop: 2, color: colors.text, lineHeight: 20 },
  });
}
