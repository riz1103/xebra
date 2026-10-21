import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { Field, Primary, StaffBody, useStaffStyles } from "../staff-ui";
import type { AnswerValue, ExamQuestion, QuestionResult } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "StaffReview">;

function showAnswer(value: AnswerValue | undefined): string {
  if (value == null || value === "") return "";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export function StaffReviewScreen({ route }: Props) {
  const t = useT();
  const { styles } = useStaffStyles();
  const [rows, setRows] = useState<{ question: ExamQuestion; result?: QuestionResult; answer: string; score: string; feedback: string }[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const resultRes = await api.getExamResult(route.params.resultId);
      const result = resultRes.data;
      const examRes = await api.getExam(result.examId, true);
      const questions = ((examRes.data as { questions?: ExamQuestion[] }).questions || []) as ExamQuestion[];
      const byId = new Map((result.questionResults || []).map((item) => [item.questionId, item]));
      setRows(
        questions.map((question) => {
          const graded = byId.get(question.id);
          return {
            question,
            result: graded,
            answer: showAnswer(result.answers?.[question.id]),
            score: graded ? String(graded.score) : "",
            feedback: graded?.feedback || "",
          };
        })
      );
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, t("review.loadError")));
    }
  }, [route.params.resultId, t]);

  useState(() => {
    load().catch(() => undefined);
  });

  function patch(id: string, next: Partial<(typeof rows)[number]>) {
    setRows((current) => current.map((row) => (row.question.id === id ? { ...row, ...next } : row)));
  }

  async function save() {
    const grades = rows
      .filter((row) => row.result?.pendingReview || row.score.trim())
      .map((row) => ({
        questionId: row.question.id,
        score: row.score.trim() === "" ? null : Number(row.score),
        feedback: row.feedback.trim() || undefined,
      }));
    try {
      await api.gradeExamResult(route.params.resultId, grades);
      setNotice(t("review.saved"));
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, t("review.loadError")));
    }
  }

  return (
    <StaffBody>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.ok}>{notice}</Text> : null}
      {rows.map((row) => (
        <View key={row.question.id} style={styles.card}>
          <Text style={styles.body}>{row.question.questionText}</Text>
          <Text style={styles.muted}>
            {t("review.answer")}: {row.answer || t("review.noAnswer")}
          </Text>
          <Field label={t("review.score")} value={row.score} onChangeText={(score) => patch(row.question.id, { score })} keyboardType="number-pad" />
          <Field label={t("review.feedback")} value={row.feedback} onChangeText={(feedback) => patch(row.question.id, { feedback })} />
          <Text style={styles.muted}>/ {row.question.points}</Text>
        </View>
      ))}
      <Primary label={t("review.save")} onPress={save} />
    </StaffBody>
  );
}
