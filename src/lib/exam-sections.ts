import type { CreateExamQuestionPayload, ExamPart, ExamPartPayload } from "@/types";

/** Nested phrase under a part (same shape as top-level phrase block) */
export type PartPhrase = {
  id: string;
  phrase: { title: string; body: string; usageType?: string };
  imageFiles: File[];
  questions: CreateExamQuestionPayload[];
};

/** One item in the Questions section: standalone question, phrase block, or part block with nested questions and phrases */
export type QuestionSection =
  | { id: string; type: "standalone"; question: CreateExamQuestionPayload }
  | {
      id: string;
      type: "phrase";
      phrase: { title: string; body: string; usageType?: string };
      imageFiles: File[];
      questions: CreateExamQuestionPayload[];
    }
  | {
      id: string;
      type: "part";
      part: ExamPart;
      questions: CreateExamQuestionPayload[];
      phrases: PartPhrase[];
    };

export function genSectionId() {
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function genPartPhraseId() {
  return `pp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function genPartId() {
  return `part_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** The API rejects a part timeLimit unless the exam is timed per part. */
export function toExamPartPayload(
  part: ExamPart,
  timeType: "per_exam" | "per_question" | "per_part",
  includePassingCondition: boolean
): ExamPartPayload {
  return {
    id: part.id,
    name: part.name,
    description: part.description,
    ...(part.numberOfItems != null && { numberOfItems: part.numberOfItems }),
    ...(timeType === "per_part" && { timeLimit: part.timeLimit ?? null }),
    passingCondition: includePassingCondition ? (part.passingCondition ?? null) : null,
  };
}
