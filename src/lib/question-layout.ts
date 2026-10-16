/**
 * Determines the form layout for a question based on the question type name.
 * Since question types are dynamic (stored in DB), we match by name keywords.
 */

export type QuestionLayout =
  | "multiple_choice"
  | "true_false"
  | "multiple_answer"
  | "identification"
  | "essay"
  | "ordering"
  | "matching";

/** Layouts whose answer is an array compared position by position (see metadata.answerFormat) */
export const POSITIONAL_LAYOUTS = ["ordering", "matching"] as const;
export type PositionalLayout = (typeof POSITIONAL_LAYOUTS)[number];
export const isPositionalLayout = (layout: QuestionLayout): layout is PositionalLayout =>
  (POSITIONAL_LAYOUTS as readonly string[]).includes(layout);

export interface LayoutConfig {
  layout: QuestionLayout;
  /** Whether to show the options list */
  showOptions: boolean;
  /** Whether options can be added/removed */
  editableOptions: boolean;
  /** Whether to show the correct answer field */
  showCorrectAnswer: boolean;
  /** Whether correct answer is a text input (vs select from options) */
  correctAnswerIsText: boolean;
  /** Whether multiple correct answers can be selected */
  multipleCorrectAnswers: boolean;
  /** Default options to pre-fill when this type is selected */
  defaultOptions: string[];
  /** Label for the correct answer field */
  correctAnswerLabel: string;
  /** Placeholder for the correct answer input */
  correctAnswerPlaceholder: string;
}

/**
 * Detects the question layout from a question type name.
 */
export function getQuestionLayout(typeName: string): QuestionLayout {
  const name = typeName.toLowerCase().trim();

  if (name.includes("matching") || name.includes("match the") || name.includes("pairing")) {
    return "matching";
  }

  if (
    name.includes("ordering") ||
    name.includes("sequenc") ||
    name.includes("arrange") ||
    name.includes("put in order") ||
    name.includes("ranking")
  ) {
    return "ordering";
  }

  if (name.includes("true") && name.includes("false")) {
    return "true_false";
  }

  if (
    (name.includes("multiple") &&
      (name.includes("answer") ||
        name.includes("select") ||
        name.includes("response"))) ||
    name.includes("checkbox") ||
    name.includes("multi-select") ||
    name.includes("check all")
  ) {
    return "multiple_answer";
  }

  if (
    name.includes("essay") ||
    name.includes("long answer") ||
    name.includes("open-ended") ||
    name.includes("free response") ||
    name.includes("open ended")
  ) {
    return "essay";
  }

  if (
    name.includes("identification") ||
    name.includes("fill in") ||
    name.includes("fill-in") ||
    name.includes("short answer") ||
    name.includes("enumeration") ||
    name.includes("type the answer") ||
    name.includes("blank")
  ) {
    return "identification";
  }

  // Default to multiple choice
  return "multiple_choice";
}

/**
 * Returns the full layout configuration for a given question type name.
 */
export function getLayoutConfig(typeName: string): LayoutConfig {
  const layout = getQuestionLayout(typeName);

  switch (layout) {
    case "true_false":
      return {
        layout,
        showOptions: true,
        editableOptions: false,
        showCorrectAnswer: true,
        correctAnswerIsText: false,
        multipleCorrectAnswers: true,
        defaultOptions: ["True", "False"],
        correctAnswerLabel: "Correct Answer(s)",
        correctAnswerPlaceholder: "",
      };

    case "multiple_answer":
      return {
        layout,
        showOptions: true,
        editableOptions: true,
        showCorrectAnswer: true,
        correctAnswerIsText: false,
        multipleCorrectAnswers: true,
        defaultOptions: ["", "", "", ""],
        correctAnswerLabel: "Correct Answer(s)",
        correctAnswerPlaceholder: "",
      };

    case "identification":
      return {
        layout,
        showOptions: false,
        editableOptions: false,
        showCorrectAnswer: true,
        correctAnswerIsText: true,
        multipleCorrectAnswers: false,
        defaultOptions: [],
        correctAnswerLabel: "Correct Answer",
        correctAnswerPlaceholder: "Type the correct answer...",
      };

    case "essay":
      return {
        layout,
        showOptions: false,
        editableOptions: false,
        showCorrectAnswer: false,
        correctAnswerIsText: false,
        multipleCorrectAnswers: false,
        defaultOptions: [],
        correctAnswerLabel: "",
        correctAnswerPlaceholder: "",
      };

    // Ordering and matching use their own editor (PositionalQuestionEditor) instead of options/answer fields
    case "ordering":
    case "matching":
      return {
        layout,
        showOptions: false,
        editableOptions: false,
        showCorrectAnswer: false,
        correctAnswerIsText: false,
        multipleCorrectAnswers: false,
        defaultOptions: [],
        correctAnswerLabel: "",
        correctAnswerPlaceholder: "",
      };

    case "multiple_choice":
    default:
      return {
        layout,
        showOptions: true,
        editableOptions: true,
        showCorrectAnswer: true,
        correctAnswerIsText: false,
        multipleCorrectAnswers: true,
        defaultOptions: ["", "", "", ""],
        correctAnswerLabel: "Correct Answer(s)",
        correctAnswerPlaceholder: "",
      };
  }
}
