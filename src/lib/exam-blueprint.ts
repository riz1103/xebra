/**
 * Exam blueprint: the parameters that decide what kind of exam gets generated
 * (purpose, item mix, difficulty, timing, passing rules). Presets give sensible
 * defaults per exam purpose; timing is computed deterministically from the item mix.
 */

import type { QuestionLayout } from "@/lib/question-layout";

export type ExamPurpose = "quiz" | "practice" | "long_test" | "midterm" | "final" | "diagnostic";
export type Difficulty = "easy" | "medium" | "hard";
export type CognitiveLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
export type EducationLevel =
  | "elementary"
  | "junior_high"
  | "senior_high"
  | "college"
  | "professional"
  | "general";

export const QUESTION_LAYOUTS: QuestionLayout[] = [
  "multiple_choice",
  "true_false",
  "multiple_answer",
  "identification",
  "essay",
];

export const LAYOUT_LABELS: Record<QuestionLayout, string> = {
  multiple_choice: "Multiple Choice",
  true_false: "True or False",
  multiple_answer: "Multiple Answer",
  identification: "Identification",
  essay: "Essay",
};

export const LAYOUT_DESCRIPTIONS: Record<QuestionLayout, string> = {
  multiple_choice: "Choose the single best answer from the options.",
  true_false: "Decide whether each statement is true or false.",
  multiple_answer: "Select all options that apply.",
  identification: "Type the correct term, name, or value. Fill in blanks where shown.",
  essay: "Answer in complete sentences. Graded manually.",
};

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  elementary: "Elementary",
  junior_high: "Junior High School",
  senior_high: "Senior High School",
  college: "College / University",
  professional: "Professional / Licensure",
  general: "General",
};

export const COGNITIVE_LEVEL_LABELS: Record<CognitiveLevel, string> = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyze: "Analyze",
  evaluate: "Evaluate",
  create: "Create",
};

export type LayoutCounts = Record<QuestionLayout, number>;
export type DifficultyMix = Record<Difficulty, number>;

export interface PurposePreset {
  label: string;
  description: string;
  itemRange: [number, number];
  /** Share of non-essay items per layout (sums to 1) */
  layoutRatio: Partial<Record<Exclude<QuestionLayout, "essay">, number>>;
  essayCount: number;
  difficultyMix: DifficultyMix;
  cognitiveFocus: CognitiveLevel[];
  passingPercentage: number;
  questionOrder: "random" | "fixed";
  reviewableByExaminee: boolean;
  splitIntoParts: boolean;
}

export const PURPOSE_PRESETS: Record<ExamPurpose, PurposePreset> = {
  quiz: {
    label: "Quick quiz",
    description: "Short check of key facts and concepts after a lesson.",
    itemRange: [10, 20],
    layoutRatio: { multiple_choice: 0.6, true_false: 0.3, identification: 0.1 },
    essayCount: 0,
    difficultyMix: { easy: 40, medium: 50, hard: 10 },
    cognitiveFocus: ["remember", "understand"],
    passingPercentage: 60,
    questionOrder: "random",
    reviewableByExaminee: true,
    splitIntoParts: false,
  },
  practice: {
    label: "Practice / review",
    description: "Self-study drill with answers revealed after submission.",
    itemRange: [20, 40],
    layoutRatio: { multiple_choice: 0.5, true_false: 0.2, multiple_answer: 0.1, identification: 0.2 },
    essayCount: 0,
    difficultyMix: { easy: 30, medium: 50, hard: 20 },
    cognitiveFocus: ["remember", "understand", "apply"],
    passingPercentage: 50,
    questionOrder: "random",
    reviewableByExaminee: true,
    splitIntoParts: false,
  },
  long_test: {
    label: "Long test / unit exam",
    description: "Covers a full unit or chapter, organized into parts by question type.",
    itemRange: [30, 60],
    layoutRatio: { multiple_choice: 0.5, true_false: 0.2, multiple_answer: 0.1, identification: 0.2 },
    essayCount: 1,
    difficultyMix: { easy: 30, medium: 50, hard: 20 },
    cognitiveFocus: ["remember", "understand", "apply", "analyze"],
    passingPercentage: 75,
    questionOrder: "fixed",
    reviewableByExaminee: false,
    splitIntoParts: true,
  },
  midterm: {
    label: "Midterm exam",
    description: "Comprehensive exam over half a term's material.",
    itemRange: [50, 80],
    layoutRatio: { multiple_choice: 0.55, true_false: 0.15, multiple_answer: 0.1, identification: 0.2 },
    essayCount: 2,
    difficultyMix: { easy: 25, medium: 50, hard: 25 },
    cognitiveFocus: ["understand", "apply", "analyze", "evaluate"],
    passingPercentage: 75,
    questionOrder: "fixed",
    reviewableByExaminee: false,
    splitIntoParts: true,
  },
  final: {
    label: "Final exam",
    description: "Comprehensive end-of-term exam across all topics.",
    itemRange: [60, 100],
    layoutRatio: { multiple_choice: 0.55, true_false: 0.15, multiple_answer: 0.1, identification: 0.2 },
    essayCount: 3,
    difficultyMix: { easy: 20, medium: 50, hard: 30 },
    cognitiveFocus: ["understand", "apply", "analyze", "evaluate"],
    passingPercentage: 75,
    questionOrder: "fixed",
    reviewableByExaminee: false,
    splitIntoParts: true,
  },
  diagnostic: {
    label: "Diagnostic / pre-test",
    description: "Measures prior knowledge across easy to hard items; no pass/fail emphasis.",
    itemRange: [15, 30],
    layoutRatio: { multiple_choice: 0.7, true_false: 0.15, identification: 0.15 },
    essayCount: 0,
    difficultyMix: { easy: 34, medium: 33, hard: 33 },
    cognitiveFocus: ["remember", "understand", "apply", "analyze"],
    passingPercentage: 0,
    questionOrder: "fixed",
    reviewableByExaminee: true,
    splitIntoParts: false,
  },
};

export const EXAM_PURPOSES = Object.keys(PURPOSE_PRESETS) as ExamPurpose[];

/** Estimated minutes an examinee needs per item, by layout */
const MINUTES_PER_ITEM: Record<QuestionLayout, number> = {
  true_false: 0.5,
  multiple_choice: 1,
  multiple_answer: 1.5,
  identification: 1,
  essay: 10,
};
const MINUTES_PER_PASSAGE = 3;

export const DEFAULT_POINTS: Record<QuestionLayout, number> = {
  multiple_choice: 1,
  true_false: 1,
  multiple_answer: 2,
  identification: 1,
  essay: 10,
};

export interface ExamBlueprint {
  purpose: ExamPurpose;
  title: string;
  subject: string;
  educationLevel: EducationLevel;
  language: string;
  topics: string[];
  questionCounts: LayoutCounts;
  pointsPerLayout: LayoutCounts;
  choicesPerQuestion: number;
  difficultyMix: DifficultyMix;
  cognitiveFocus: CognitiveLevel[];
  includePassages: boolean;
  passageCount: number;
  questionsPerPassage: number;
  splitIntoParts: boolean;
  timeType: "per_exam" | "per_part";
  /** null = use the computed estimate */
  timeLimitOverride: number | null;
  passingPercentage: number;
  questionOrder: "random" | "fixed";
  reviewableByExaminee: boolean;
  additionalInstructions: string;
  /** Generate a larger pool than each session uses; every session draws a random subset. */
  usePool: boolean;
  /** Items each session draws per layout (only when usePool) */
  sessionCounts: LayoutCounts;
  /** Passage questions each session draws (only when usePool) */
  sessionPassageQuestions: number;
}

/** Upper bound per layout when generating a pool */
export const MAX_POOL_PER_LAYOUT = 200;
/** Pools larger than this take noticeably longer and use more AI quota */
export const LARGE_POOL_WARNING = 200;

function emptyCounts(): LayoutCounts {
  return { multiple_choice: 0, true_false: 0, multiple_answer: 0, identification: 0, essay: 0 };
}

/** Splits a total item count across layouts using the preset ratio (largest-remainder rounding). */
export function distributeItems(purpose: ExamPurpose, total: number, allowed?: QuestionLayout[]): LayoutCounts {
  const preset = PURPOSE_PRESETS[purpose];
  const counts = emptyCounts();
  const essay = allowed && !allowed.includes("essay") ? 0 : preset.essayCount;
  counts.essay = Math.min(essay, total);
  const remaining = Math.max(0, total - counts.essay);

  let ratios = Object.entries(preset.layoutRatio).filter(
    ([layout]) => !allowed || allowed.includes(layout as QuestionLayout)
  ) as [QuestionLayout, number][];
  if (ratios.length === 0) ratios = [["multiple_choice", 1]];
  const sum = ratios.reduce((s, [, r]) => s + r, 0);

  const raw = ratios.map(([layout, r]) => ({ layout, exact: (remaining * r) / sum }));
  let assigned = 0;
  for (const item of raw) {
    counts[item.layout] = Math.floor(item.exact);
    assigned += counts[item.layout];
  }
  raw
    .sort((a, b) => (b.exact % 1) - (a.exact % 1))
    .slice(0, remaining - assigned)
    .forEach((item) => counts[item.layout]++);
  return counts;
}

export function clampItemCount(purpose: ExamPurpose, count: number): number {
  const [min, max] = PURPOSE_PRESETS[purpose].itemRange;
  return Math.min(max, Math.max(min, Math.round(count)));
}

/** Number of questions to generate (the pool size when usePool is on). */
export function totalQuestions(bp: Pick<ExamBlueprint, "questionCounts" | "includePassages" | "passageCount" | "questionsPerPassage">): number {
  const base = QUESTION_LAYOUTS.reduce((s, l) => s + bp.questionCounts[l], 0);
  return base + passageQuestionTotal(bp);
}

export function passageQuestionTotal(bp: Pick<ExamBlueprint, "includePassages" | "passageCount" | "questionsPerPassage">): number {
  return bp.includePassages ? bp.passageCount * bp.questionsPerPassage : 0;
}

/** Items of a layout that each session shows. */
export function sessionLayoutCount(bp: ExamBlueprint, layout: QuestionLayout): number {
  return bp.usePool ? Math.min(bp.sessionCounts[layout], bp.questionCounts[layout]) : bp.questionCounts[layout];
}

/** Passage questions that each session shows. */
export function sessionPassageCount(bp: ExamBlueprint): number {
  const total = passageQuestionTotal(bp);
  return bp.usePool ? Math.min(bp.sessionPassageQuestions, total) : total;
}

/** Items each examinee answers in one session. */
export function itemsPerSession(bp: ExamBlueprint): number {
  return QUESTION_LAYOUTS.reduce((s, l) => s + sessionLayoutCount(bp, l), 0) + sessionPassageCount(bp);
}

export function estimateLayoutMinutes(layout: QuestionLayout, count: number): number {
  return count * MINUTES_PER_ITEM[layout];
}

/** Reading time per passage plus answering time per passage question. */
export function estimatePassageMinutes(passagesRead: number, questionCount: number): number {
  return passagesRead * MINUTES_PER_PASSAGE + questionCount * MINUTES_PER_ITEM.multiple_choice;
}

/** Rounds up to the nearest 5 minutes, minimum 5. */
export function roundMinutes(minutes: number): number {
  return Math.max(5, Math.ceil(minutes / 5) * 5);
}

/** Unrounded minutes for what one session shows (not the whole pool). */
export function sessionMinutes(bp: ExamBlueprint): number {
  const items = QUESTION_LAYOUTS.reduce((s, l) => s + estimateLayoutMinutes(l, sessionLayoutCount(bp, l)), 0);
  const passageQuestions = sessionPassageCount(bp);
  const passages = passageQuestions > 0 ? estimatePassageMinutes(Math.min(bp.passageCount, passageQuestions), passageQuestions) : 0;
  return items + passages;
}

/** Average minutes per generated question, for estimating the time of a partial draw. */
export function minutesPerItem(bp: ExamBlueprint): number {
  const items = QUESTION_LAYOUTS.reduce((s, l) => s + estimateLayoutMinutes(l, bp.questionCounts[l]), 0);
  const passageQuestions = passageQuestionTotal(bp);
  const passages = passageQuestions > 0 ? estimatePassageMinutes(bp.passageCount, passageQuestions) : 0;
  const total = totalQuestions(bp);
  return total > 0 ? (items + passages) / total : 0;
}

export function estimateTimeLimit(bp: ExamBlueprint): number {
  return roundMinutes(sessionMinutes(bp));
}

export function effectiveTimeLimit(bp: ExamBlueprint): number {
  return bp.timeLimitOverride ?? estimateTimeLimit(bp);
}

/** Splits a count into difficulty buckets following the mix percentages. */
export function splitByDifficulty(count: number, mix: DifficultyMix): Record<Difficulty, number> {
  const total = mix.easy + mix.medium + mix.hard || 1;
  const easy = Math.round((count * mix.easy) / total);
  const hard = Math.round((count * mix.hard) / total);
  return { easy, hard, medium: Math.max(0, count - easy - hard) };
}

export interface BlueprintSeed {
  purpose: ExamPurpose;
  title: string;
  subject: string;
  educationLevel: EducationLevel;
  language: string;
  topics: string[];
  recommendedItemCount: number;
  recommendedLayouts: QuestionLayout[];
  hasReadingPassages: boolean;
}

export function buildBlueprint(seed: BlueprintSeed): ExamBlueprint {
  const preset = PURPOSE_PRESETS[seed.purpose];
  const allowed = seed.recommendedLayouts.length > 0 ? seed.recommendedLayouts : undefined;
  const includePassages = seed.hasReadingPassages && seed.purpose !== "quiz";
  const passageCount = includePassages ? (seed.purpose === "final" || seed.purpose === "midterm" ? 2 : 1) : 0;
  const questionsPerPassage = 5;
  const total = clampItemCount(seed.purpose, seed.recommendedItemCount) - passageCount * questionsPerPassage;
  const questionCounts = distributeItems(seed.purpose, Math.max(1, total), allowed);
  return {
    purpose: seed.purpose,
    title: seed.title,
    subject: seed.subject,
    educationLevel: seed.educationLevel,
    language: seed.language,
    topics: seed.topics,
    questionCounts,
    pointsPerLayout: { ...DEFAULT_POINTS },
    choicesPerQuestion: 4,
    difficultyMix: { ...preset.difficultyMix },
    cognitiveFocus: [...preset.cognitiveFocus],
    includePassages,
    passageCount,
    questionsPerPassage,
    splitIntoParts: preset.splitIntoParts,
    timeType: "per_exam",
    timeLimitOverride: null,
    passingPercentage: preset.passingPercentage,
    questionOrder: preset.questionOrder,
    reviewableByExaminee: preset.reviewableByExaminee,
    additionalInstructions: "",
    usePool: false,
    sessionCounts: { ...questionCounts },
    sessionPassageQuestions: passageCount * questionsPerPassage,
  };
}

/**
 * Turns the question pool on or off. Turning it on keeps the current mix as the per-session
 * count and doubles what gets generated; turning it off generates exactly the per-session mix.
 */
export function setPoolEnabled(bp: ExamBlueprint, enabled: boolean): ExamBlueprint {
  if (enabled === bp.usePool) return bp;
  if (enabled) {
    const questionCounts = { ...bp.questionCounts };
    for (const l of QUESTION_LAYOUTS) questionCounts[l] = Math.min(MAX_POOL_PER_LAYOUT, bp.questionCounts[l] * 2);
    return {
      ...bp,
      usePool: true,
      sessionCounts: { ...bp.questionCounts },
      sessionPassageQuestions: passageQuestionTotal(bp),
      questionCounts,
      passageCount: bp.includePassages ? Math.min(5, bp.passageCount * 2) : bp.passageCount,
    };
  }
  const questionCounts = { ...bp.questionCounts };
  for (const l of QUESTION_LAYOUTS) questionCounts[l] = sessionLayoutCount(bp, l);
  const passageQuestions = sessionPassageCount(bp);
  return {
    ...bp,
    usePool: false,
    questionCounts,
    passageCount: bp.includePassages
      ? Math.max(1, Math.min(bp.passageCount, Math.ceil(passageQuestions / Math.max(1, bp.questionsPerPassage))))
      : bp.passageCount,
  };
}

/** Re-applies a purpose preset while keeping material-specific fields (title, topics, language). */
export function applyPurpose(bp: ExamBlueprint, purpose: ExamPurpose): ExamBlueprint {
  const preset = PURPOSE_PRESETS[purpose];
  const currentTotal = totalQuestions(bp);
  const passageItems = bp.includePassages ? bp.passageCount * bp.questionsPerPassage : 0;
  const allowed = QUESTION_LAYOUTS.filter((l) => bp.questionCounts[l] > 0);
  const questionCounts = distributeItems(
    purpose,
    Math.max(1, clampItemCount(purpose, currentTotal) - passageItems),
    allowed.length > 0 ? [...allowed, "essay"] : undefined
  );
  return {
    ...bp,
    purpose,
    questionCounts,
    usePool: false,
    sessionCounts: { ...questionCounts },
    sessionPassageQuestions: passageItems,
    difficultyMix: { ...preset.difficultyMix },
    cognitiveFocus: [...preset.cognitiveFocus],
    splitIntoParts: preset.splitIntoParts,
    timeLimitOverride: null,
    passingPercentage: preset.passingPercentage,
    questionOrder: preset.questionOrder,
    reviewableByExaminee: preset.reviewableByExaminee,
  };
}

export function buildExamInstruction(bp: ExamBlueprint, timeLimitMinutes: number): string {
  const lines = [
    `This ${PURPOSE_PRESETS[bp.purpose].label.toLowerCase()} has ${itemsPerSession(bp)} items and must be completed in ${timeLimitMinutes} minutes.`,
  ];
  for (const layout of QUESTION_LAYOUTS) {
    if (sessionLayoutCount(bp, layout) > 0) {
      lines.push(`- ${LAYOUT_LABELS[layout]}: ${LAYOUT_DESCRIPTIONS[layout]}`);
    }
  }
  if (sessionPassageCount(bp) > 0) {
    lines.push("- Reading comprehension: read each passage carefully before answering its questions.");
  }
  if (bp.purpose !== "diagnostic" && bp.passingPercentage > 0) {
    lines.push(`A score of at least ${bp.passingPercentage}% is required to pass.`);
  }
  return lines.join("\n");
}
