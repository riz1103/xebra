import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import { Choice, Field, Ghost, Primary, StaffBody, useStaffStyles } from "../staff-ui";
import type { Exam, ExamBundle } from "../types";

export function BundlesScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const [items, setItems] = useState<ExamBundle[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [examIds, setExamIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [bundles, examList] = await Promise.all([api.getExamBundles(), api.getExams({ page: 1, size: 100 })]);
      setItems(bundles.data || []);
      setExams(examList.data || []);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, t("bundles.loadError")));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  function toggle(id: string) {
    setExamIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function save() {
    const payload = { name: name.trim(), description: description.trim(), examIds };
    try {
      if (editing) await api.updateExamBundle(editing, payload);
      else await api.createExamBundle(payload);
      setName("");
      setDescription("");
      setExamIds([]);
      setEditing(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, t("bundles.loadError")));
    }
  }

  return (
    <StaffBody>
      <Text style={styles.title}>{t("bundles.new")}</Text>
      <Field label={t("bundles.name")} value={name} onChangeText={setName} />
      <Field label={t("bundles.description")} value={description} onChangeText={setDescription} multiline />
      <Text style={styles.muted}>{t("bundles.exams")}</Text>
      <View style={styles.row}>
        {exams.map((exam) => (
          <Choice key={exam.id} label={exam.title} on={examIds.includes(exam.id)} onPress={() => toggle(exam.id)} />
        ))}
      </View>
      <Primary label={t("bundles.save")} onPress={save} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items.length === 0 ? <Text style={styles.muted}>{t("bundles.none")}</Text> : null}
      {items.map((bundle) => (
        <View key={bundle.id} style={styles.card}>
          <Text style={styles.title}>{bundle.name}</Text>
          <Text style={styles.muted}>{bundle.description}</Text>
          <Text style={styles.muted}>{t("exams.questions", { count: bundle.examIds?.length || 0 })}</Text>
          <View style={styles.row}>
            <Ghost
              label={t("exams.edit")}
              onPress={() => {
                setEditing(bundle.id);
                setName(bundle.name);
                setDescription(bundle.description || "");
                setExamIds(bundle.examIds || []);
              }}
            />
            <Ghost
              label={t("bundles.delete")}
              danger
              onPress={() => {
                api
                  .deleteExamBundle(bundle.id)
                  .then(load)
                  .catch((err) => setError(apiErrorMessage(err, t("bundles.loadError"))));
              }}
            />
          </View>
        </View>
      ))}
    </StaffBody>
  );
}
