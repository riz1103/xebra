import { useCallback, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { Choice, Field, Ghost, Primary, StaffBody, useStaffStyles } from "../staff-ui";
import type { Exam } from "../types";

const FILTERS = ["all", "draft", "active", "archived"] as const;
const SORTS = ["newest", "oldest", "title_asc", "title_desc", "updated"] as const;

type ExamSortKey = (typeof SORTS)[number];

const SORT_PARAMS: Record<
  ExamSortKey,
  { sortBy: "createdAt" | "title" | "updatedAt"; sortOrder: "asc" | "desc" }
> = {
  newest: { sortBy: "createdAt", sortOrder: "desc" },
  oldest: { sortBy: "createdAt", sortOrder: "asc" },
  title_asc: { sortBy: "title", sortOrder: "asc" },
  title_desc: { sortBy: "title", sortOrder: "desc" },
  updated: { sortBy: "updatedAt", sortOrder: "desc" },
};

function examFieldMillis(exam: Exam, field: "createdAt" | "updatedAt"): number {
  const value = exam[field] as unknown;
  if (!value) return 0;
  if (typeof value === "object" && value !== null && "_seconds" in value) {
    return Number((value as { _seconds: number })._seconds) * 1000;
  }
  const ms = new Date(value as string).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function sortExams(list: Exam[], sort: ExamSortKey): Exam[] {
  const { sortBy, sortOrder } = SORT_PARAMS[sort];
  const direction = sortOrder === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    if (sortBy === "title") {
      const diff = (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" });
      if (diff !== 0) return diff * direction;
    } else {
      const diff = examFieldMillis(a, sortBy) - examFieldMillis(b, sortBy);
      if (diff !== 0) return diff * direction;
    }
    return examFieldMillis(b, "createdAt") - examFieldMillis(a, "createdAt");
  });
}

export function ManagedExamsScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("all");
  const [sort, setSort] = useState<ExamSortKey>("newest");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Exam[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const sortParams = SORT_PARAMS[sort];

  const load = useCallback(async () => {
    setError("");
    try {
      const [mine, shared] = await Promise.all([
        api.getExams({
          page: 1,
          size: 100,
          status: status === "all" ? undefined : status,
          sortBy: sortParams.sortBy,
          sortOrder: sortParams.sortOrder,
        }),
        api.getSharedExams().catch(() => ({ data: [] as Exam[] })),
      ]);
      const seen = new Set<string>();
      const merged = [...(mine.data || []), ...(shared.data || [])].filter((exam) => {
        if (seen.has(exam.id)) return false;
        seen.add(exam.id);
        return true;
      });
      setItems(sortExams(merged, sort));
    } catch (err) {
      setError(apiErrorMessage(err, t("exams.loadError")));
    }
  }, [status, sort, sortParams.sortBy, sortParams.sortOrder, t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const shown = useMemo(
    () => items.filter((exam) => exam.title.toLowerCase().includes(search.trim().toLowerCase())),
    [items, search]
  );

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
      <View style={styles.row}>
        {SORTS.map((id) => (
          <Choice key={id} label={t(`exams.sort.${id}`)} on={sort === id} onPress={() => setSort(id)} />
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
