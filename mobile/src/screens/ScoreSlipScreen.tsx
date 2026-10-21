import { useCallback, useState } from "react";
import { Share, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { Ghost, StaffBody, useStaffStyles } from "../staff-ui";
import type { ExamResult } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ScoreSlip">;

export function ScoreSlipScreen({ route }: Props) {
  const t = useT();
  const { styles } = useStaffStyles();
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.getExamResult(route.params.resultId);
      setResult(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, t("review.loadError")));
    }
  }, [route.params.resultId, t]);

  useState(() => {
    load().catch(() => undefined);
  });

  const awaiting = result?.gradingStatus === "pending_review";
  const outcome = awaiting ? t("slip.awaiting") : result?.passed ? t("slip.passed") : t("slip.failed");
  const requirement = result?.passingCondition
    ? result.passingCondition.type === "percentage"
      ? `${result.passingCondition.value}%`
      : String(result.passingCondition.value)
    : "";

  const text = result
    ? `${result.examTitle || ""}\n${result.examineeName || result.examineeEmail || ""}\n${result.score}/${result.totalPoints} (${Math.round(result.percentage)}%)\n${outcome}`
    : "";

  return (
    <StaffBody>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {result ? (
        <View style={styles.card}>
          <Text style={styles.title}>{result.examTitle}</Text>
          <Text style={styles.body}>
            {t("slip.examinee")}: {result.examineeName || result.examineeEmail || ""}
          </Text>
          <Text style={styles.body}>
            {t("slip.score")}: {result.score}/{result.totalPoints} ({Math.round(result.percentage)}%)
          </Text>
          <Text style={styles.body}>{outcome}</Text>
          {requirement ? (
            <Text style={styles.muted}>
              {t("slip.requirement")}: {requirement}
            </Text>
          ) : null}
          {result.timeSpentMinutes != null ? (
            <Text style={styles.muted}>
              {t("slip.time")}: {result.timeSpentMinutes} min
            </Text>
          ) : null}
          <Ghost label={t("slip.share")} onPress={() => Share.share({ message: text })} />
        </View>
      ) : null}
    </StaffBody>
  );
}
