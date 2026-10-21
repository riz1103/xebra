import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { Ghost, StaffBody, useStaffStyles } from "../staff-ui";
import type { ExamResult } from "../types";

export function ManagedResultsScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<ExamResult[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.getManagedResults();
      setItems(res.data || []);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, t("results.loadError")));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  return (
    <StaffBody>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items.length === 0 ? <Text style={styles.muted}>{t("results.none")}</Text> : null}
      {items.map((result) => (
        <View key={result.id} style={styles.card}>
          <Text style={styles.title}>{result.examTitle || result.examId}</Text>
          <Text style={styles.body}>{result.examineeName || result.examineeEmail || ""}</Text>
          <Text style={styles.muted}>
            {Math.round(result.percentage)}%{result.gradingStatus === "pending_review" ? ` · ${t("results.pending")}` : ""}
          </Text>
          <View style={styles.row}>
            <Ghost label={t("results.review")} onPress={() => navigation.navigate("StaffReview", { resultId: result.id })} />
            <Ghost label={t("results.slip")} onPress={() => navigation.navigate("ScoreSlip", { resultId: result.id })} />
          </View>
        </View>
      ))}
    </StaffBody>
  );
}
