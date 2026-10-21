import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { Choice, Field, Ghost, Primary, StaffBody, useStaffStyles } from "../staff-ui";
import type { Exam } from "../types";

const FILTERS = ["all", "draft", "active", "archived"] as const;

export function ManagedExamsScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Exam[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [mine, shared] = await Promise.all([
        api.getExams({ page: 1, size: 100, status: status === "all" ? undefined : status }),
        api.getSharedExams().catch(() => ({ data: [] as Exam[] })),
      ]);
      const seen = new Set<string>();
      const merged = [...(mine.data || []), ...(shared.data || [])].filter((exam) => {
        if (seen.has(exam.id)) return false;
        seen.add(exam.id);
        return true;
      });
      setItems(merged);
    } catch (err) {
      setError(apiErrorMessage(err, t("exams.loadError")));
    }
  }, [status, t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const shown = items.filter((exam) => exam.title.toLowerCase().includes(search.trim().toLowerCase()));

  async function duplicate(id: string) {
    setNotice("");
    try {
      await api.duplicateExam(id);
      setNotice(t("exams.duplicated"));
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, t("exams.loadError")));
    }
  }

  function remove(id: string) {
    Alert.alert(t("exams.delete"), t("exams.confirmDelete"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("exams.delete"),
        style: "destructive",
        onPress: () => {
          api
            .deleteExam(id)
            .then(() => {
              setNotice(t("exams.deleted"));
              return load();
            })
            .catch((err) => setError(apiErrorMessage(err, t("exams.loadError"))));
        },
      },
    ]);
  }

  return (
    <StaffBody>
      <Primary label={t("exams.create")} onPress={() => navigation.navigate("ExamForm", {})} />
      <Ghost
        label={t("exams.sample")}
        onPress={() => {
          api
            .createSampleExam()
            .then(() => load())
            .catch((err) => setError(apiErrorMessage(err, t("exams.loadError"))));
        }}
      />
      <Field label={t("exams.search")} value={search} onChangeText={setSearch} />
      <View style={styles.row}>
        {FILTERS.map((id) => (
          <Choice key={id} label={t(`exams.${id}`)} on={status === id} onPress={() => setStatus(id)} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.ok}>{notice}</Text> : null}
      {shown.length === 0 ? <Text style={styles.muted}>{t("exams.none")}</Text> : null}
      {shown.map((exam) => (
        <View key={exam.id} style={styles.card}>
          <Text style={styles.title}>{exam.title}</Text>
          <Text style={styles.muted}>{exam.status}</Text>
          <Text style={styles.muted}>
            {t("exams.questions", { count: exam.questionCount || exam.questions?.length || 0 })} · {t("exams.minutes", { count: exam.timeLimit || 0 })}
          </Text>
          <View style={styles.row}>
            <Ghost label={t("exams.edit")} onPress={() => navigation.navigate("ExamForm", { examId: exam.id })} />
            <Ghost label={t("exams.live")} onPress={() => navigation.navigate("LiveMonitor", { examId: exam.id })} />
            <Ghost label={t("exams.duplicate")} onPress={() => duplicate(exam.id)} />
            <Ghost label={t("exams.delete")} danger onPress={() => remove(exam.id)} />
          </View>
        </View>
      ))}
    </StaffBody>
  );
}
