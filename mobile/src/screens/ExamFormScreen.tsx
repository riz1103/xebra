import { useCallback, useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, apiErrorMessage } from "../api";
import { useLocale, useT } from "../i18n";
import { pickNoteFiles, sourceFromText, type NoteSource } from "../notes";
import type { RootStackParamList } from "../navigation";
import { generatePracticeQuiz } from "../practice";
import { QuestionEditor } from "../question-editor";
import { blank, draftFromQuestion, fieldsFromDraft, newKey, type Draft } from "../question-draft";
import { Choice, Field, Ghost, Primary, StaffBody, useStaffStyles } from "../staff-ui";
import type { ExamQuestion, QuestionType } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ExamForm">;

interface PartDraft {
  id: string;
  name: string;
  minutes: string;
}

interface PhraseDraft {
  key: string;
  id?: string;
  title: string;
  body: string;
}

export function ExamFormScreen({ route, navigation }: Props) {
  const examId = route.params?.examId;
  const t = useT();
  const { locale } = useLocale();
  const { colors, styles } = useStaffStyles();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instruction, setInstruction] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [passing, setPassing] = useState("60");
  const [order, setOrder] = useState<"random" | "fixed">("fixed");
  const [review, setReview] = useState(true);
  const [certificates, setCertificates] = useState(true);
  const [shuffle, setShuffle] = useState(false);
  const [active, setActive] = useState(false);
  const [questions, setQuestions] = useState<Draft[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [parts, setParts] = useState<PartDraft[]>([]);
  const [phrases, setPhrases] = useState<PhraseDraft[]>([]);
  const [removedPhrases, setRemovedPhrases] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("10");
  const [pasted, setPasted] = useState("");
  const [sources, setSources] = useState<NoteSource[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!examId) return;
    setError("");
    try {
      const [examRes, typeRes, phraseRes] = await Promise.all([
        api.getExam(examId, true),
        api.getQuestionTypes(),
        api.getPhrases(examId),
      ]);
      const exam = examRes.data as unknown as {
        title?: string;
        description?: string;
        instruction?: string | null;
        timeLimit?: number;
        passingCondition?: { value?: number };
        questionOrder?: "random" | "fixed";
        reviewableByExaminee?: boolean;
        certificatesEnabled?: boolean;
        shuffleOptions?: boolean;
        status?: string;
        questions?: ExamQuestion[];
        parts?: { id: string; name: string; timeLimit?: number | null }[] | null;
      };
      const types = typeRes.data || [];
      setTitle(exam.title || "");
      setDescription(exam.description || "");
      setInstruction(exam.instruction || "");
      setMinutes(String(exam.timeLimit || 60));
      setPassing(String(exam.passingCondition?.value ?? 60));
      setOrder(exam.questionOrder === "random" ? "random" : "fixed");
      setReview(exam.reviewableByExaminee !== false);
      setCertificates(exam.certificatesEnabled !== false);
      setShuffle(!!exam.shuffleOptions);
      setActive(exam.status === "active");
      setParts((exam.parts || []).map((part) => ({ id: part.id, name: part.name, minutes: part.timeLimit ? String(part.timeLimit) : "" })));
      setPhrases(
        (phraseRes.data || []).map((phrase) => ({
          key: phrase.id,
          id: phrase.id,
          title: phrase.title || "",
          body: phrase.body || "",
        }))
      );
      setQuestions(
        (exam.questions || []).map((question) =>
          draftFromQuestion(question, types.find((type) => type.id === question.questionTypeId)?.layout)
        )
      );
    } catch (err) {
      setError(apiErrorMessage(err, t("form.loadError")));
    }
  }, [examId, t]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  function update(key: string, patch: Partial<Draft>) {
    setQuestions((current) => current.map((question) => (question.key === key ? { ...question, ...patch } : question)));
  }

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const notes = pasted.trim() ? [...sources, sourceFromText(pasted.trim(), "Notes")] : sources;
      const written = await generatePracticeQuiz({
        topics: topic.trim() ? [topic.trim()] : ["General"],
        sources: notes,
        count: Math.min(20, Math.max(1, Number(count) || 10)),
        difficulty: "mixed",
        language: locale === "fil" ? "Filipino" : "English",
      });
      setQuestions((current) => [
        ...current,
        ...written.map((question) => ({
          ...blank(question.type === "true_false" || question.type === "identification" ? question.type : "multiple_choice"),
          text: question.question,
          options: question.options?.length ? question.options : question.type === "true_false" ? ["True", "False"] : [],
          answer: question.answer,
          explanation: question.explanation,
        })),
      ]);
    } catch (err) {
      setError(apiErrorMessage(err, t("form.saveError")));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!title.trim()) {
      setError(t("form.needTitle"));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const typeRes = await api.getQuestionTypes();
      const types: QuestionType[] = typeRes.data || [];
      const typeId = (kind: Draft["kind"]) => types.find((type) => type.layout === kind)?.id;
      if (questions.some((question) => question.text.trim() && !typeId(question.kind))) {
        setError(t("form.needType"));
        setBusy(false);
        return;
      }
      const built = questions
        .filter((question) => question.text.trim() || question.kind === "audio" || question.kind === "hotspot")
        .map((question) => ({ question, built: fieldsFromDraft(question), typeId: typeId(question.kind) }));
      const invalid = built.find((item) => "error" in item.built);
      if (invalid && "error" in invalid.built) {
        setError(t(invalid.built.error as "form.needAnswer"));
        setBusy(false);
        return;
      }
      const timedParts = parts.filter((part) => part.name.trim());
      const perPart = timedParts.some((part) => Number(part.minutes) > 0);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        instruction: instruction.trim() || null,
        questionOrder: order,
        timeType: perPart ? "per_part" : "per_exam",
        timeLimit: perPart ? timedParts.reduce((sum, part) => sum + (Number(part.minutes) || 0), 0) : Number(minutes) || 60,
        passingCondition: { type: "percentage", value: Number(passing) || 0 },
        isPublic: false,
        reviewableByExaminee: review,
        certificatesEnabled: certificates,
        shuffleOptions: shuffle,
        origin: "manual",
        parts: timedParts.length
          ? timedParts.map((part) => ({
              id: part.id,
              name: part.name.trim(),
              description: "",
              ...(perPart ? { timeLimit: Number(part.minutes) || 0 } : {}),
            }))
          : null,
      };
      let id = examId;
      if (!id) {
        const created = await api.createExam(payload);
        id = created.data.id;
        if (active && id) await api.updateExam(id, { status: "active" });
      } else {
        await api.updateExam(id, { ...payload, status: active ? "active" : "draft" });
      }
      if (!id) throw new Error(t("form.saveError"));
      const phraseIds = new Map<string, string>();
      for (const phraseId of removedPhrases) await api.deletePhrase(phraseId);
      for (const phrase of phrases.filter((item) => item.body.trim())) {
        if (phrase.id) {
          await api.updatePhrase(phrase.id, { title: phrase.title.trim() || null, body: phrase.body.trim() });
          phraseIds.set(phrase.key, phrase.id);
        } else {
          const created = await api.createPhrase({ examId: id, title: phrase.title.trim() || null, body: phrase.body.trim() });
          phraseIds.set(phrase.key, created.data.id);
        }
      }
      for (const questionId of removed) await api.deleteExamQuestion(questionId);
      for (const item of built) {
        if ("error" in item.built || !item.typeId) continue;
        const phraseId = item.question.phraseId ? phraseIds.get(item.question.phraseId) || item.question.phraseId : null;
        const body = { ...item.built.fields, questionTypeId: item.typeId, phraseId, examId: id };
        if (item.question.id) await api.updateExamQuestion(item.question.id, body);
        else await api.createExamQuestion(body);
      }
      setNotice(t("form.saved"));
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err, t("form.saveError")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StaffBody>
      <Field label={t("form.title")} value={title} onChangeText={setTitle} />
      <Field label={t("form.description")} value={description} onChangeText={setDescription} multiline />
      <Field label={t("form.instructions")} value={instruction} onChangeText={setInstruction} multiline />
      <Field label={t("form.minutes")} value={minutes} onChangeText={setMinutes} keyboardType="number-pad" />
      <Field label={t("form.passing")} value={passing} onChangeText={setPassing} keyboardType="number-pad" />
      <Text style={styles.muted}>{t("form.order")}</Text>
      <View style={styles.row}>
        <Choice label={t("form.fixed")} on={order === "fixed"} onPress={() => setOrder("fixed")} />
        <Choice label={t("form.random")} on={order === "random"} onPress={() => setOrder("random")} />
      </View>
      <Toggle label={t("form.review")} value={review} onValueChange={setReview} color={colors.primary} />
      <Toggle label={t("form.certificates")} value={certificates} onValueChange={setCertificates} color={colors.primary} />
      <Toggle label={t("form.shuffle")} value={shuffle} onValueChange={setShuffle} color={colors.primary} />
      <Toggle label={t("form.publish")} value={active} onValueChange={setActive} color={colors.primary} />

      <Text style={styles.title}>{t("form.parts")}</Text>
      {parts.map((part) => (
        <View key={part.id} style={styles.card}>
          <Field
            label={t("form.partName")}
            value={part.name}
            onChangeText={(name) => setParts((current) => current.map((item) => (item.id === part.id ? { ...item, name } : item)))}
          />
          <Field
            label={t("form.partMinutes")}
            value={part.minutes}
            keyboardType="number-pad"
            onChangeText={(value) => setParts((current) => current.map((item) => (item.id === part.id ? { ...item, minutes: value } : item)))}
          />
          <Ghost label={t("form.remove")} danger onPress={() => setParts((current) => current.filter((item) => item.id !== part.id))} />
        </View>
      ))}
      <Ghost
        label={t("form.addPart")}
        onPress={() => setParts((current) => [...current, { id: newKey("part"), name: "", minutes: "" }])}
      />

      <Text style={styles.title}>{t("form.passage")}</Text>
      {phrases.map((phrase) => (
        <View key={phrase.key} style={styles.card}>
          <Field
            label={t("form.passageTitle")}
            value={phrase.title}
            onChangeText={(value) => setPhrases((current) => current.map((item) => (item.key === phrase.key ? { ...item, title: value } : item)))}
          />
          <Field
            label={t("form.passageBody")}
            value={phrase.body}
            multiline
            onChangeText={(value) => setPhrases((current) => current.map((item) => (item.key === phrase.key ? { ...item, body: value } : item)))}
          />
          <Ghost
            label={t("form.remove")}
            danger
            onPress={() => {
              if (phrase.id) setRemovedPhrases((current) => [...current, phrase.id as string]);
              setPhrases((current) => current.filter((item) => item.key !== phrase.key));
            }}
          />
        </View>
      ))}
      <Ghost
        label={t("form.addPassage")}
        onPress={() => setPhrases((current) => [...current, { key: newKey("phrase"), title: "", body: "" }])}
      />

      <View style={styles.card}>
        <Text style={styles.title}>{t("form.generate")}</Text>
        <Field label={t("form.topic")} value={topic} onChangeText={setTopic} />
        <Field label={t("form.count")} value={count} onChangeText={setCount} keyboardType="number-pad" />
        <Field label={t("form.paste")} value={pasted} onChangeText={setPasted} multiline />
        <Ghost
          label={t("form.files")}
          onPress={() => {
            pickNoteFiles()
              .then((picked) => setSources((current) => [...current, ...picked]))
              .catch((err) => setError(apiErrorMessage(err, t("form.saveError"))));
          }}
        />
        {sources.length ? <Text style={styles.muted}>{sources.map((source) => source.name).join(", ")}</Text> : null}
        <Primary label={busy ? t("form.generating") : t("form.generate")} onPress={generate} disabled={busy} />
      </View>

      {questions.map((question, index) => (
        <View key={question.key} style={styles.card}>
          <Text style={styles.title}>
            {t("form.question")} {index + 1}
          </Text>
          <QuestionEditor
            draft={question}
            onChange={(patch) => update(question.key, patch)}
            parts={parts.filter((part) => part.name.trim()).map((part) => ({ id: part.id, name: part.name }))}
            phrases={phrases.filter((phrase) => phrase.body.trim()).map((phrase) => ({ id: phrase.key, title: phrase.title || t("form.passage") }))}
          />
          <Ghost
            label={t("form.remove")}
            danger
            onPress={() => {
              if (question.id) setRemoved((current) => [...current, question.id as string]);
              setQuestions((current) => current.filter((item) => item.key !== question.key));
            }}
          />
        </View>
      ))}
      <Ghost label={t("form.add")} onPress={() => setQuestions((current) => [...current, blank()])} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.ok}>{notice}</Text> : null}
      <Primary label={t("form.save")} onPress={save} disabled={busy} />
    </StaffBody>
  );
}

function Toggle({
  label,
  value,
  onValueChange,
  color,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  color: string;
}) {
  const { styles } = useStaffStyles();
  return (
    <View style={[styles.row, { justifyContent: "space-between" }]}>
      <Text style={styles.body}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: color }} />
    </View>
  );
}
