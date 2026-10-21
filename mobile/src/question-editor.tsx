import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { api, apiErrorMessage } from "./api";
import { useT } from "./i18n";
import { Choice, Field, Ghost, useStaffStyles } from "./staff-ui";
import { KIND_LABEL, KINDS, newKey, type Draft } from "./question-draft";

export function QuestionEditor({
  draft,
  onChange,
  parts,
  phrases,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  parts?: { id: string; name: string }[];
  phrases?: { id: string; title: string }[];
}) {
  const t = useT();
  const { styles } = useStaffStyles();
  const [uploadError, setUploadError] = useState("");
  const [imageBox, setImageBox] = useState({ width: 320, height: 220 });
  const choice = draft.kind === "multiple_choice" || draft.kind === "multiple_answer" || draft.kind === "audio";

  async function uploadAudio() {
    setUploadError("");
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const file = picked.assets[0];
    try {
      const res = await api.uploadQuestionMedia(file.uri, file.name, file.mimeType || "audio/mpeg", "audio");
      onChange({ audioUrl: res.data.url, audioPath: res.data.path });
    } catch (err) {
      setUploadError(apiErrorMessage(err, t("form.saveError")));
    }
  }

  async function uploadImage() {
    setUploadError("");
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (picked.canceled || !picked.assets[0]) return;
    const file = picked.assets[0];
    try {
      const res = await api.uploadQuestionMedia(file.uri, file.fileName || "hotspot.jpg", file.mimeType || "image/jpeg", "image");
      onChange({ imageUrl: res.data.url, imagePath: res.data.path, regions: [], answers: [] });
    } catch (err) {
      setUploadError(apiErrorMessage(err, t("form.saveError")));
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        {KINDS.map((kind) => (
          <Choice
            key={kind}
            label={t(KIND_LABEL[kind])}
            on={draft.kind === kind}
            onPress={() =>
              onChange({
                kind,
                options: kind === "true_false" ? ["True", "False"] : draft.options,
                answer: kind === "true_false" ? "True" : draft.answer,
              })
            }
          />
        ))}
      </View>
      <Field label={t("form.question")} value={draft.text} onChangeText={(text) => onChange({ text })} multiline />
      {choice
        ? draft.options.map((option, index) => (
            <Field
              key={`${draft.key}-opt-${index}`}
              label={`${t("form.option")} ${index + 1}`}
              value={option}
              onChangeText={(value) => {
                const options = [...draft.options];
                options[index] = value;
                onChange({ options });
              }}
            />
          ))
        : null}
      {draft.kind === "multiple_choice" ? (
        <Field label={t("form.answer")} value={draft.answer} onChangeText={(answer) => onChange({ answer })} />
      ) : null}
      {draft.kind === "true_false" ? (
        <View style={styles.row}>
          {["True", "False"].map((value) => (
            <Choice key={value} label={value} on={draft.answer === value} onPress={() => onChange({ answer: value })} />
          ))}
        </View>
      ) : null}
      {draft.kind === "multiple_answer" || draft.kind === "audio" ? (
        <View style={styles.row}>
          {draft.options.filter(Boolean).map((option) => (
            <Choice
              key={option}
              label={option}
              on={draft.answers.includes(option)}
              onPress={() =>
                onChange({
                  answers: draft.answers.includes(option)
                    ? draft.answers.filter((item) => item !== option)
                    : [...draft.answers, option],
                })
              }
            />
          ))}
        </View>
      ) : null}
      {draft.kind === "identification" || draft.kind === "essay" ? (
        <Field label={t("form.answer")} value={draft.answer} onChangeText={(answer) => onChange({ answer })} />
      ) : null}
      {draft.kind === "ordering"
        ? draft.items.map((item, index) => (
            <Field
              key={`${draft.key}-item-${index}`}
              label={`${t("form.item")} ${index + 1}`}
              value={item}
              onChangeText={(value) => {
                const items = [...draft.items];
                items[index] = value;
                onChange({ items });
              }}
            />
          ))
        : null}
      {draft.kind === "ordering" ? (
        <Ghost label={t("form.addItem")} onPress={() => onChange({ items: [...draft.items, ""] })} />
      ) : null}
      {draft.kind === "matching"
        ? draft.prompts.map((prompt, index) => (
            <View key={`${draft.key}-pair-${index}`} style={{ gap: 8 }}>
              <Field
                label={`${t("form.prompt")} ${index + 1}`}
                value={prompt}
                onChangeText={(value) => {
                  const prompts = [...draft.prompts];
                  prompts[index] = value;
                  onChange({ prompts });
                }}
              />
              <Field
                label={t("form.match")}
                value={draft.responses[index] || ""}
                onChangeText={(value) => {
                  const responses = [...draft.responses];
                  responses[index] = value;
                  onChange({ responses });
                }}
              />
            </View>
          ))
        : null}
      {draft.kind === "matching" ? (
        <>
          <Ghost
            label={t("form.addPair")}
            onPress={() => onChange({ prompts: [...draft.prompts, ""], responses: [...draft.responses, ""] })}
          />
          {draft.distractors.map((item, index) => (
            <Field
              key={`${draft.key}-extra-${index}`}
              label={t("form.distractor")}
              value={item}
              onChangeText={(value) => {
                const distractors = [...draft.distractors];
                distractors[index] = value;
                onChange({ distractors });
              }}
            />
          ))}
          <Ghost label={t("form.addDistractor")} onPress={() => onChange({ distractors: [...draft.distractors, ""] })} />
        </>
      ) : null}
      {draft.kind === "audio" ? (
        <View style={{ gap: 8 }}>
          <Ghost label={t("form.uploadAudio")} onPress={() => uploadAudio().catch(() => undefined)} />
          {draft.audioUrl ? <Text style={styles.ok}>{t("form.audioReady")}</Text> : null}
          <Field label={t("form.plays")} value={draft.maxPlays} onChangeText={(maxPlays) => onChange({ maxPlays })} keyboardType="number-pad" />
        </View>
      ) : null}
      {draft.kind === "hotspot" ? (
        <View style={{ gap: 8 }}>
          <Ghost label={t("form.uploadImage")} onPress={() => uploadImage().catch(() => undefined)} />
          {draft.imageUrl ? (
            <View style={{ gap: 8 }}>
            <Pressable
              onLayout={(event) => setImageBox({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
              onPress={(event) => {
                const box = event.nativeEvent;
                const region = {
                  id: newKey("spot"),
                  x: Math.max(0, Math.min(100, (box.locationX / Math.max(imageBox.width, 1)) * 100)),
                  y: Math.max(0, Math.min(100, (box.locationY / Math.max(imageBox.height, 1)) * 100)),
                  radius: 8,
                };
                onChange({ regions: [...draft.regions, region], answers: [...draft.answers, region.id] });
              }}
            >
              <Image source={{ uri: draft.imageUrl }} style={{ width: "100%", height: 220, borderRadius: 12 }} resizeMode="contain" />
            </Pressable>
            <Text style={styles.muted}>{t("form.tapHotspot")}</Text>
            </View>
          ) : null}
          {draft.regions.map((region, index) => (
            <Ghost
              key={region.id}
              label={`${t("form.removeRegion")} ${index + 1}`}
              danger
              onPress={() =>
                onChange({
                  regions: draft.regions.filter((item) => item.id !== region.id),
                  answers: draft.answers.filter((id) => id !== region.id),
                })
              }
            />
          ))}
        </View>
      ) : null}
      {parts?.length ? (
        <View style={styles.row}>
          <Choice label={t("form.noPart")} on={!draft.partId} onPress={() => onChange({ partId: "" })} />
          {parts.map((part) => (
            <Choice key={part.id} label={part.name} on={draft.partId === part.id} onPress={() => onChange({ partId: part.id })} />
          ))}
        </View>
      ) : null}
      {phrases?.length ? (
        <View style={styles.row}>
          <Choice label={t("form.noPassage")} on={!draft.phraseId} onPress={() => onChange({ phraseId: "" })} />
          {phrases.map((phrase) => (
            <Choice key={phrase.id} label={phrase.title} on={draft.phraseId === phrase.id} onPress={() => onChange({ phraseId: phrase.id })} />
          ))}
        </View>
      ) : null}
      <Field label={t("form.points")} value={draft.points} onChangeText={(points) => onChange({ points })} keyboardType="number-pad" />
      <Field label={t("form.explanation")} value={draft.explanation} onChangeText={(explanation) => onChange({ explanation })} />
      {uploadError ? <Text style={styles.error}>{uploadError}</Text> : null}
    </View>
  );
}

