import type { PositionalLayout } from "@/lib/question-layout";
import type { QuestionMetadata } from "@/types";

/** What the author edits: items in the right order, or prompt/response pairs plus distractors. */
export interface PositionalDraft {
  /** Ordering: items in the correct order */
  items: string[];
  /** Matching: left-hand prompts */
  prompts: string[];
  /** Matching: responses[i] is the right match for prompts[i] */
  responses: string[];
  /** Matching: extra responses that match nothing */
  distractors: string[];
}

export const emptyDraft = (layout: PositionalLayout): PositionalDraft =>
  layout === "ordering"
    ? { items: ["", "", ""], prompts: [], responses: [], distractors: [] }
    : { items: [], prompts: ["", "", ""], responses: ["", "", ""], distractors: [] };

/** Scrambles so the stored option order never equals the answer (when that's possible). */
export function scramble(list: string[]): string[] {
  if (list.length < 2) return [...list];
  for (let attempt = 0; attempt < 10; attempt++) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.some((v, i) => v !== list[i])) return a;
  }
  return [...list.slice(1), list[0]];
}

/** Rebuilds the editable draft from a saved question */
export function draftFromQuestion(
  layout: PositionalLayout,
  q: { options?: string[]; correctAnswer?: string | string[]; metadata?: QuestionMetadata }
): PositionalDraft {
  const key = Array.isArray(q.correctAnswer) ? q.correctAnswer : q.correctAnswer ? [q.correctAnswer] : [];
  if (layout === "ordering") {
    const items = key.length ? key : q.options ?? [];
    return items.length ? { ...emptyDraft(layout), items: [...items] } : emptyDraft(layout);
  }
  const prompts = q.metadata?.matchPrompts ?? [];
  if (prompts.length === 0) return emptyDraft(layout);
  const used = new Set(key);
  return {
    items: [],
    prompts: [...prompts],
    responses: prompts.map((_, i) => key[i] ?? ""),
    distractors: (q.options ?? []).filter((o) => !used.has(o)),
  };
}

/**
 * Keeps an in-progress draft on the question itself (unvalidated, unscrambled) for editors that
 * hold questions in their own state; payloadFromDraft finalizes it when saving.
 */
export function questionFieldsFromDraft(layout: PositionalLayout, draft: PositionalDraft, metadata: QuestionMetadata = {}) {
  const { matchPrompts: _unused, ...rest } = metadata;
  return layout === "ordering"
    ? { options: [...draft.items], correctAnswer: [...draft.items], metadata: { ...rest, answerFormat: "ordering" as const } }
    : {
        options: [...draft.responses, ...draft.distractors],
        correctAnswer: [...draft.responses],
        metadata: { ...rest, answerFormat: "matching" as const, matchPrompts: [...draft.prompts] },
      };
}

/** Drops ordering/matching fields from a question that was switched to another type */
export function withoutPositionalMetadata(metadata: QuestionMetadata | undefined): QuestionMetadata | undefined {
  if (!metadata || (!metadata.answerFormat && !metadata.matchPrompts)) return metadata;
  const { answerFormat: _format, matchPrompts: _prompts, ...rest } = metadata;
  return rest;
}

/** Validates a draft and turns it into the stored question fields, or returns an error message. */
export function payloadFromDraft(
  layout: PositionalLayout,
  draft: PositionalDraft,
  metadata: QuestionMetadata = {}
): { options: string[]; correctAnswer: string[]; metadata: QuestionMetadata; numberOfChoices: number } | { error: string } {
  if (layout === "ordering") {
    const items = draft.items.map((s) => s.trim()).filter(Boolean);
    if (items.length < 2) return { error: "Add at least two items to put in order." };
    if (new Set(items.map((i) => i.toLowerCase())).size !== items.length) return { error: "Each item must be different." };
    const { matchPrompts: _unused, ...rest } = metadata;
    return {
      options: scramble(items),
      correctAnswer: items,
      numberOfChoices: items.length,
      metadata: { ...rest, answerFormat: "ordering" },
    };
  }
  const pairs = draft.prompts
    .map((p, i) => ({ prompt: p.trim(), response: (draft.responses[i] ?? "").trim() }))
    .filter((p) => p.prompt || p.response);
  if (pairs.length < 2) return { error: "Add at least two pairs to match." };
  if (pairs.some((p) => !p.prompt || !p.response)) return { error: "Every pair needs both a prompt and its match." };
  const distractors = draft.distractors.map((d) => d.trim()).filter(Boolean);
  const responses = [...new Set([...pairs.map((p) => p.response), ...distractors])];
  return {
    options: scramble(responses),
    correctAnswer: pairs.map((p) => p.response),
    numberOfChoices: responses.length,
    metadata: { ...metadata, answerFormat: "matching", matchPrompts: pairs.map((p) => p.prompt) },
  };
}