import type { ExamQuestion } from "./types";

export type Kind =
  | "multiple_choice"
  | "true_false"
  | "multiple_answer"
  | "identification"
  | "essay"
  | "ordering"
  | "matching"
  | "audio"
  | "hotspot";

export const KINDS: Kind[] = [
  "multiple_choice",
  "true_false",
  "multiple_answer",
  "identification",
  "essay",
  "ordering",
  "matching",
  "audio",
  "hotspot",
];

export const KIND_LABEL: Record<Kind, "form.mc" | "form.tf" | "form.ma" | "form.id" | "form.essay" | "form.ordering" | "form.matching" | "form.audio" | "form.hotspot"> = {
  multiple_choice: "form.mc",
  true_false: "form.tf",
  multiple_answer: "form.ma",
  identification: "form.id",
  essay: "form.essay",
  ordering: "form.ordering",
  matching: "form.matching",
  audio: "form.audio",
  hotspot: "form.hotspot",
};

export interface HotspotRegion {
  id: string;
  x: number;
  y: number;
  radius: number;
  label?: string;
}

export interface Draft {
  key: string;
  id?: string;
  kind: Kind;
  text: string;
  options: string[];
  answer: string;
  answers: string[];
  points: string;
  explanation: string;
  items: string[];
  prompts: string[];
  responses: string[];
  distractors: string[];
  audioUrl: string;
  audioPath: string;
  maxPlays: string;
  imageUrl: string;
  imagePath: string;
  regions: HotspotRegion[];
  partId: string;
  phraseId: string;
}

export function newKey(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function blank(kind: Kind = "multiple_choice"): Draft {
  return {
    key: newKey("q"),
    kind,
    text: "",
    options: kind === "true_false" ? ["True", "False"] : ["", "", "", ""],
    answer: kind === "true_false" ? "True" : "",
    answers: [],
    points: "1",
    explanation: "",
    items: ["", "", ""],
    prompts: ["", ""],
    responses: ["", ""],
    distractors: [""],
    audioUrl: "",
    audioPath: "",
    maxPlays: "",
    imageUrl: "",
    imagePath: "",
    regions: [],
    partId: "",
    phraseId: "",
  };
}

function list(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map(String);
  return value ? [String(value)] : [];
}

export function draftFromQuestion(question: ExamQuestion, layout?: string | null): Draft {
  const meta = question.metadata || {};
  const format = meta.answerFormat;
  const kind: Kind =
    layout && (KINDS as string[]).includes(layout)
      ? (layout as Kind)
      : format === "ordering" || format === "matching" || format === "hotspot"
        ? format
        : meta.audioUrl
          ? "audio"
          : Array.isArray(question.correctAnswer)
            ? "multiple_answer"
            : !question.options?.length
              ? question.correctAnswer
                ? "identification"
                : "essay"
              : "multiple_choice";
  const base = blank(kind);
  const correct = list(question.correctAnswer);
  const prompts = meta.matchPrompts || [];
  return {
    ...base,
    key: question.id,
    id: question.id,
    kind,
    text: question.questionText || "",
    options: question.options?.length ? [...question.options] : base.options,
    answer: correct[0] || base.answer,
    answers: correct,
    points: String(question.points || 1),
    explanation: question.explanation || "",
    items: kind === "ordering" && correct.length ? correct : base.items,
    prompts: prompts.length ? prompts : base.prompts,
    responses: kind === "matching" ? prompts.map((_, index) => correct[index] || "") : base.responses,
    distractors:
      kind === "matching"
        ? (question.options || []).filter((option) => !correct.includes(option))
        : base.distractors,
    audioUrl: meta.audioUrl || "",
    audioPath: meta.audioStoragePath || "",
    maxPlays: meta.maxPlays ? String(meta.maxPlays) : "",
    imageUrl: meta.hotspotImageUrl || "",
    imagePath: meta.hotspotImageStoragePath || "",
    regions: meta.hotspotRegions || [],
    partId: question.partId || "",
    phraseId: question.phraseId || "",
  };
}

function scramble(list: string[]): string[] {
  if (list.length < 2) return [...list];
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  if (copy.every((value, index) => value === list[index])) return [...copy.slice(1), copy[0]];
  return copy;
}

export function fieldsFromDraft(question: Draft): { error: string } | { fields: Record<string, unknown> } {
  const points = Number(question.points) || 1;
  const explanation = question.explanation.trim() || undefined;
  const shared = {
    questionText: question.text.trim(),
    points,
    explanation,
    partId: question.partId || null,
    phraseId: question.phraseId || null,
  };
  if (!shared.questionText && question.kind !== "audio") return { error: "form.needQuestion" };

  if (question.kind === "ordering") {
    const items = question.items.map((item) => item.trim()).filter(Boolean);
    if (items.length < 2) return { error: "form.needOrder" };
    if (new Set(items.map((item) => item.toLowerCase())).size !== items.length) return { error: "form.needDistinct" };
    return {
      fields: {
        ...shared,
        options: scramble(items),
        correctAnswer: items,
        numberOfChoices: items.length,
        metadata: { answerFormat: "ordering" },
      },
    };
  }

  if (question.kind === "matching") {
    const pairs = question.prompts
      .map((prompt, index) => ({ prompt: prompt.trim(), response: (question.responses[index] || "").trim() }))
      .filter((pair) => pair.prompt || pair.response);
    if (pairs.length < 2) return { error: "form.needPairs" };
    if (pairs.some((pair) => !pair.prompt || !pair.response)) return { error: "form.needBoth" };
    const distractors = question.distractors.map((item) => item.trim()).filter(Boolean);
    const responses = [...new Set([...pairs.map((pair) => pair.response), ...distractors])];
    return {
      fields: {
        ...shared,
        options: scramble(responses),
        correctAnswer: pairs.map((pair) => pair.response),
        numberOfChoices: responses.length,
        metadata: { answerFormat: "matching", matchPrompts: pairs.map((pair) => pair.prompt) },
      },
    };
  }

  if (question.kind === "hotspot") {
    if (!question.imageUrl) return { error: "form.needImage" };
    if (!question.regions.length || !question.answers.length) return { error: "form.needRegion" };
    return {
      fields: {
        ...shared,
        questionText: shared.questionText || "Tap the correct spot.",
        options: [],
        correctAnswer: question.answers,
        metadata: {
          answerFormat: "hotspot",
          hotspotImageUrl: question.imageUrl,
          hotspotImageStoragePath: question.imagePath || undefined,
          hotspotRegions: question.regions,
        },
      },
    };
  }

  if (question.kind === "audio") {
    if (!question.audioUrl) return { error: "form.needAudio" };
    const options = question.options.map((option) => option.trim()).filter(Boolean);
    const correct = question.answers.filter((answer) => options.includes(answer));
    if (!options.length || !correct.length) return { error: "form.needAnswer" };
    return {
      fields: {
        ...shared,
        questionText: shared.questionText || "Listen and answer.",
        options,
        correctAnswer: correct.length === 1 ? correct[0] : correct,
        metadata: {
          audioUrl: question.audioUrl,
          audioStoragePath: question.audioPath || undefined,
          ...(Number(question.maxPlays) > 0 ? { maxPlays: Number(question.maxPlays) } : {}),
        },
      },
    };
  }

  if (question.kind === "essay") {
    return { fields: { ...shared, options: [], correctAnswer: question.answer.trim() || "Essay" } };
  }
  if (question.kind === "identification") {
    if (!question.answer.trim()) return { error: "form.needAnswer" };
    return { fields: { ...shared, options: [], correctAnswer: question.answer.trim() } };
  }
  if (question.kind === "true_false") {
    return {
      fields: {
        ...shared,
        options: ["True", "False"],
        correctAnswer: question.answer === "False" ? "False" : "True",
      },
    };
  }
  const options = question.options.map((option) => option.trim()).filter(Boolean);
  if (question.kind === "multiple_answer") {
    const correct = question.answers.filter((answer) => options.includes(answer));
    if (!options.length || !correct.length) return { error: "form.needAnswer" };
    return { fields: { ...shared, options, correctAnswer: correct } };
  }
  if (!options.length || !options.includes(question.answer.trim())) return { error: "form.needAnswer" };
  return { fields: { ...shared, options, correctAnswer: question.answer.trim() } };
}
