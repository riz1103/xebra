import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAudioPlayer } from "expo-audio";
import { parseBlanks } from "../blanks";
import { useT } from "../i18n";
import { MathText } from "../math-text";
import type { QuestionLayout } from "../question-layout";
import { useColors, type Palette } from "../theme";
import type { AnswerValue, PhraseBlock, SessionQuestion } from "../types";

interface Props {
  question: SessionQuestion;
  index: number;
  total: number;
  partName?: string;
  layout: QuestionLayout;
  answer: AnswerValue | undefined;
  flagged: boolean;
  phrase: PhraseBlock | null;
  playsUsed: number;
  onAnswer: (value: AnswerValue) => void;
  onFlag: () => void;
  onPlayAudio: () => void;
  onPaste?: (length: number) => void;
}

export function QuestionCard(props: Props) {
  const t = useT();
  const styles = useStyles();
  const colors = useColors();
  const { question } = props;
  const blanks = parseBlanks(question.questionText);
  const positional = question.metadata?.answerFormat;
  const isBlank = blanks.blankCount > 0 && !positional;
  const multiple =
    question.multipleAnswers === true ||
    (Array.isArray(question.correctAnswer) && question.correctAnswer.length > 1) ||
    props.layout === "multiple_answer";
  const textAnswer =
    !isBlank &&
    !positional &&
    (props.layout === "identification" || props.layout === "essay" || (question.options?.length ?? 0) === 0);

  return (
    <View style={styles.card}>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {t("q.questionOf", { n: props.index + 1, total: props.total })}
          {props.partName ? ` · ${props.partName}` : ""}
        </Text>
        <View style={styles.metaRight}>
          <Text style={styles.points}>{t("q.pts", { count: question.points })}</Text>
          <Pressable onPress={props.onFlag} hitSlop={8}>
            <Text style={[styles.flag, props.flagged && styles.flagOn]}>{props.flagged ? t("q.flagged") : t("q.flag")}</Text>
          </Pressable>
        </View>
      </View>

      {props.phrase ? <Phrase phrase={props.phrase} /> : null}

      {!isBlank ? <MathText text={question.questionText} style={styles.stem} /> : null}
      {multiple && !isBlank && !positional ? <Text style={styles.hint}>{t("q.selectAll")}</Text> : null}

      {question.metadata?.audioUrl ? (
        <AudioClip
          url={question.metadata.audioUrl}
          maxPlays={question.metadata.maxPlays ?? 0}
          playsUsed={props.playsUsed}
          onPlay={props.onPlayAudio}
        />
      ) : null}

      {positional === "ordering" ? (
        <Ordering items={question.options} value={Array.isArray(props.answer) ? props.answer : null} onChange={props.onAnswer} />
      ) : positional === "matching" ? (
        <Matching
          prompts={question.metadata?.matchPrompts ?? []}
          options={question.options}
          value={Array.isArray(props.answer) ? props.answer : null}
          onChange={props.onAnswer}
        />
      ) : positional === "hotspot" && question.metadata?.hotspotImageUrl ? (
        <Hotspot
          imageUrl={question.metadata.hotspotImageUrl}
          regions={question.metadata.hotspotRegions ?? []}
          selected={Array.isArray(props.answer) ? props.answer[0] : typeof props.answer === "string" ? props.answer : null}
          onChange={(id) => props.onAnswer(id ? [id] : null)}
        />
      ) : isBlank ? (
        <Blanks
          segments={blanks.segments}
          count={blanks.blankCount}
          options={question.options}
          value={props.answer}
          onChange={props.onAnswer}
          onPaste={props.onPaste}
        />
      ) : textAnswer ? (
        <TextInput
          style={[styles.input, props.layout === "essay" && styles.essay]}
          multiline={props.layout === "essay"}
          placeholder={props.layout === "essay" ? t("q.writeAnswer") : t("q.typeAnswer")}
          placeholderTextColor={colors.muted}
          value={typeof props.answer === "string" ? props.answer : ""}
          onChangeText={(text) => {
            const prev = typeof props.answer === "string" ? props.answer : "";
            if (text.length - prev.length > 1) props.onPaste?.(text.length - prev.length);
            props.onAnswer(text.trim() ? text : null);
          }}
          autoCapitalize="sentences"
          autoCorrect
        />
      ) : multiple ? (
        <Choices
          options={question.options}
          selected={Array.isArray(props.answer) ? props.answer : []}
          multiple
          onToggle={(option, on) => {
            const current = Array.isArray(props.answer) ? props.answer : [];
            const next = on ? [...current, option] : current.filter((item) => item !== option);
            props.onAnswer(next.length ? next : null);
          }}
        />
      ) : (
        <Choices
          options={question.options}
          selected={typeof props.answer === "string" ? [props.answer] : []}
          onToggle={(option) => props.onAnswer(option)}
        />
      )}
    </View>
  );
}

function Phrase({ phrase }: { phrase: PhraseBlock }) {
  const styles = useStyles();
  return (
    <View style={styles.phrase}>
      {phrase.title ? <Text style={styles.phraseTitle}>{phrase.title}</Text> : null}
      <MathText text={phrase.body} style={styles.phraseBody} />
      {phrase.imageUrls?.map((url) => (
        <Image key={url} source={{ uri: url }} style={styles.phraseImage} resizeMode="contain" />
      ))}
    </View>
  );
}

function AudioClip({
  url,
  maxPlays,
  playsUsed,
  onPlay,
}: {
  url: string;
  maxPlays: number;
  playsUsed: number;
  onPlay: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const player = useAudioPlayer(url);
  const blocked = maxPlays > 0 && playsUsed >= maxPlays;
  return (
    <Pressable
      style={[styles.audio, blocked && styles.audioOff]}
      disabled={blocked}
      onPress={() => {
        onPlay();
        player.seekTo(0);
        player.play();
      }}
    >
      <Text style={styles.audioText}>
        {blocked ? t("q.noPlays") : maxPlays > 0 ? t("q.playCount", { used: playsUsed, max: maxPlays }) : t("q.playAudio")}
      </Text>
    </Pressable>
  );
}

function Choices({
  options,
  selected,
  multiple,
  onToggle,
}: {
  options: string[];
  selected: string[];
  multiple?: boolean;
  onToggle: (option: string, on: boolean) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.choices}>
      {options.map((option, i) => {
        const on = selected.includes(option);
        return (
          <Pressable
            key={`${i}-${option}`}
            style={[styles.choice, on && styles.choiceOn]}
            onPress={() => onToggle(option, multiple ? !on : true)}
          >
            <Text style={[styles.letter, on && styles.letterOn]}>{String.fromCharCode(65 + i)}</Text>
            <MathText text={option} style={styles.choiceText} />
          </Pressable>
        );
      })}
    </View>
  );
}

function Ordering({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string[] | null;
  onChange: (value: AnswerValue) => void;
}) {
  const t = useT();
  const styles = useStyles();
  const order = value && value.length === items.length ? value : items;
  useEffect(() => {
    if (!value || value.length !== items.length) onChange(items);
    // The order on screen is the answer, including the order the exam started with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  const move = (index: number, dir: -1 | 1) => {
    const next = order.slice();
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };
  return (
    <View style={styles.choices}>
      <Text style={styles.hint}>{t("q.orderHint")}</Text>
      {order.map((item, i) => (
        <View key={`${i}-${item}`} style={styles.orderRow}>
          <Text style={styles.orderIndex}>{i + 1}</Text>
          <MathText text={item} style={styles.choiceText} />
          <Pressable onPress={() => move(i, -1)} hitSlop={6}><Text style={styles.move}>{t("q.up")}</Text></Pressable>
          <Pressable onPress={() => move(i, 1)} hitSlop={6}><Text style={styles.move}>{t("q.down")}</Text></Pressable>
        </View>
      ))}
    </View>
  );
}

function Matching({
  prompts,
  options,
  value,
  onChange,
}: {
  prompts: string[];
  options: string[];
  value: string[] | null;
  onChange: (value: AnswerValue) => void;
}) {
  const styles = useStyles();
  const answers = prompts.map((_, i) => value?.[i] ?? "");
  return (
    <View style={styles.choices}>
      {prompts.map((prompt, i) => (
        <View key={i} style={styles.matchBlock}>
          <MathText text={prompt} style={styles.matchPrompt} />
          <View style={styles.matchOptions}>
            {options.map((option) => {
              const on = answers[i] === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => {
                    const next = answers.slice();
                    next[i] = on ? "" : option;
                    onChange(next.some(Boolean) ? next : null);
                  }}
                >
                  <MathText text={option} style={[styles.chipText, on && styles.chipTextOn]} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function Hotspot({
  imageUrl,
  regions,
  selected,
  onChange,
}: {
  imageUrl: string;
  regions: { id: string; x: number; y: number; radius: number; label?: string }[];
  selected: string | null;
  onChange: (id: string | null) => void;
}) {
  const t = useT();
  const styles = useStyles();
  const [ratio, setRatio] = useState(1.4);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    Image.getSize(imageUrl, (w, h) => setRatio(w / h), () => {});
  }, [imageUrl]);
  const chosen = regions.find((region) => region.id === selected);
  return (
    <View>
      <Text style={styles.hint}>{t("q.hotspot")}</Text>
      <Pressable
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onPress={(e) => {
          if (!width) return;
          const height = width / ratio;
          const xPct = (e.nativeEvent.locationX / width) * 100;
          const yPct = (e.nativeEvent.locationY / height) * 100;
          let best: { id: string; dist: number } | null = null;
          for (const region of regions) {
            const dx = xPct - region.x;
            const dy = (yPct - region.y) * (height / width);
            const dist = Math.hypot(dx, dy);
            if (dist <= region.radius && (!best || dist < best.dist)) best = { id: region.id, dist };
          }
          if (best) onChange(best.id);
        }}
      >
        <Image source={{ uri: imageUrl }} style={{ width: "100%", aspectRatio: ratio }} resizeMode="stretch" />
      </Pressable>
      {chosen?.label ? <Text style={styles.hint}>Selected: {chosen.label}</Text> : null}
    </View>
  );
}

function Blanks({
  segments,
  count,
  options,
  value,
  onChange,
  onPaste,
}: {
  segments: string[];
  count: number;
  options: string[];
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  onPaste?: (length: number) => void;
}) {
  const t = useT();
  const styles = useStyles();
  const colors = useColors();
  const current: string[] =
    count === 1
      ? [typeof value === "string" ? value : ""]
      : Array.isArray(value)
        ? value
        : [];
  const setBlank = (index: number, text: string) => {
    if (count === 1) {
      onChange(text.trim() ? text : null);
      return;
    }
    const next = Array.from({ length: count }, (_, i) => current[i] ?? "");
    next[index] = text;
    onChange(next.some((item) => item.trim()) ? next : null);
  };
  return (
    <View>
      <MathText
        text={segments.map((segment, i) => `${segment}${i < count ? " ______ " : ""}`).join("")}
        style={styles.stem}
      />
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.blank}>
          <Text style={styles.hint}>{count > 1 ? t("q.blank", { n: i + 1 }) : t("q.yourAnswer")}</Text>
          {options.length > 0 ? (
            <View style={styles.matchOptions}>
              {options.map((option) => {
                const on = current[i] === option;
                return (
                  <Pressable key={option} style={[styles.chip, on && styles.chipOn]} onPress={() => setBlank(i, on ? "" : option)}>
                    <MathText text={option} style={[styles.chipText, on && styles.chipTextOn]} />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <TextInput
              style={styles.input}
              value={current[i] ?? ""}
              placeholder={t("q.missingWord")}
              placeholderTextColor={colors.muted}
              onChangeText={(text) => {
                const prev = current[i] ?? "";
                if (text.length - prev.length > 1) onPaste?.(text.length - prev.length);
                setBlank(i, text);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        </View>
      ))}
    </View>
  );
}

const useStyles = () => {
  const colors = useColors();
  return useMemo(() => makeStyles(colors), [colors]);
};

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  meta: { flex: 1, color: colors.muted, fontSize: 13 },
  metaRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  points: { color: colors.primary, fontSize: 12, fontWeight: "700", backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, overflow: "hidden" },
  flag: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  flagOn: { color: colors.flag },
  stem: { marginTop: 14, fontSize: 18, lineHeight: 26, color: colors.text, fontWeight: "600" },
  hint: { marginTop: 6, color: colors.muted, fontSize: 13 },
  phrase: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
  phraseTitle: { fontWeight: "700", color: colors.text, marginBottom: 6 },
  phraseBody: { color: colors.text, lineHeight: 22 },
  phraseImage: { width: "100%", height: 180, marginTop: 8 },
  choices: { marginTop: 14, gap: 8 },
  choice: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  choiceOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  letter: { width: 28, height: 28, borderRadius: 14, textAlign: "center", lineHeight: 28, backgroundColor: colors.bg, color: colors.muted, fontWeight: "700", overflow: "hidden" },
  letterOn: { backgroundColor: colors.primary, color: "#fff" },
  choiceText: { flex: 1, color: colors.text, fontSize: 16, lineHeight: 22 },
  input: { marginTop: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 16, color: colors.text, backgroundColor: colors.card },
  essay: { minHeight: 160, textAlignVertical: "top" },
  audio: { marginTop: 12, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  audioOff: { backgroundColor: colors.border },
  audioText: { color: "#fff", fontWeight: "700" },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10 },
  orderIndex: { width: 22, fontWeight: "700", color: colors.primary },
  move: { color: colors.primary, fontWeight: "700", paddingHorizontal: 4 },
  matchBlock: { gap: 8 },
  matchPrompt: { color: colors.text, fontWeight: "600" },
  matchOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.text },
  chipTextOn: { color: colors.primary, fontWeight: "700" },
  blank: { marginTop: 10 },
});
}
