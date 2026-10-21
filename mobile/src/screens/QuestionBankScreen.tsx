import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import { QuestionEditor } from "../question-editor";
import { blank, draftFromQuestion, fieldsFromDraft, type Draft } from "../question-draft";
import { Field, Ghost, Primary, StaffBody, useStaffStyles } from "../staff-ui";
import type { BankQuestion, Exam, ExamQuestion, QuestionType } from "../types";

export function QuestionBankScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const [items, setItems] = useState<BankQuestion[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [draft, setDraft] = useState<Draft>(blank());
  const [topic, setTopic] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [bank, examList, typeList] = await Promise.all([
        api.getBankQuestions(),
        api.getExams({ page: 1, size: 100 }),
        api.getQuestionTypes(),
      ]);
      setItems(bank.data || []);
      setExams(examList.data || []);
      setTypes(typeList.data || []);
    } catch (err) {
      setError(apiErrorMessage(err, t("bank.loadError")));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  async function save() {
    const typeId = types.find((type) => type.layout === draft.kind)?.id;
    if (!typeId) {
      setError(t("form.needType"));
      return;
    }
    const built = fieldsFromDraft(draft);
    if ("error" in built) {
      setError(t(built.error as "form.needAnswer"));
      return;
    }
    const payload = { ...built.fields, questionTypeId: typeId, topic: topic.trim() || null, partId: null, phraseId: null };
    try {
      if (editing) await api.updateBankQuestion(editing, payload);
      else await api.createBankQuestion(payload);
      setDraft(blank());
      setTopic("");
      setEditing(null);
      setNotice(t("settings.saved"));
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, t("bank.loadError")));
    }
  }

  return (
    <StaffBody>
      <Text style={styles.title}>{editing ? t("bank.save") : t("bank.new")}</Text>
      <QuestionEditor draft={draft} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} />
      <Field label={t("bank.topic")} value={topic} onChangeText={setTopic} />
      <Primary label={t("bank.save")} onPress={save} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.ok}>{notice}</Text> : null}
      <Text style={styles.title}>{t("bank.import")}</Text>
      {exams.map((exam) => (
        <Ghost
          key={exam.id}
          label={exam.title}
          onPress={() => {
            api
              .importExamToBank(exam.id)
              .then((res) => {
                setNotice(t("bank.imported", { count: res.data?.imported || 0 }));
                return load();
              })
              .catch((err) => setError(apiErrorMessage(err, t("bank.loadError"))));
          }}
        />
      ))}
      {items.length === 0 ? <Text style={styles.muted}>{t("bank.none")}</Text> : null}
      {items.map((question) => (
        <View key={question.id} style={styles.card}>
          <Text style={styles.body}>{question.questionText}</Text>
          <Text style={styles.muted}>{question.topic || ""}</Text>
          <View style={styles.row}>
            <Ghost
              label={t("exams.edit")}
              onPress={() => {
                const type = types.find((item) => item.id === question.questionTypeId);
                setEditing(question.id);
                setTopic(question.topic || "");
                setDraft(draftFromQuestion(question as unknown as ExamQuestion, type?.layout));
              }}
            />
            <Ghost
              label={t("bank.delete")}
              danger
              onPress={() => {
                api
                  .deleteBankQuestion(question.id)
                  .then(load)
                  .catch((err) => setError(apiErrorMessage(err, t("bank.loadError"))));
              }}
            />
          </View>
        </View>
      ))}
    </StaffBody>
  );
}
