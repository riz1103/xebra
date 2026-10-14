/**
 * Adding AI-generated questions to an exam that already exists: where they go (new parts,
 * an existing part, or the exam without parts), how many each session draws, and how much
 * time to add.
 */

import { api } from "@/lib/api";
import {
  minutesPerItem,
  roundMinutes,
  sessionMinutes,
  totalQuestions,
  type ExamBlueprint,
} from "@/lib/exam-blueprint";
import { toExamPartPayload } from "@/lib/exam-sections";
import { saveSectionsToExam, sectionQuestions } from "@/lib/exam-save";
import type { AppliedExam } from "@/lib/exam-generator";
import type { Exam, ExamPart, QuestionType, UpdateExamPayload } from "@/types";

export interface ExistingExamContext {
  id: string;
  parts: ExamPart[];
  timeType: Exam["timeType"];
  timeLimit: number;
  numberOfItems: number | null;
  /** Active questions only */
  questions: { questionText: string; partId?: string | null }[];
}

export type AppendTarget = { kind: "no_part" } | { kind: "new_parts" } | { kind: "part"; partId: string };

export interface AppendPlacement {
  target: AppendTarget;
  /** Items per session for the target scope after adding; undefined = suggested value, null = all */
  sessionItems?: number | null;
  /** Add the estimated time of the new items to the exam (or to the target part when timed per part) */
  extendTime: boolean;
}

export function examContext(exam: Exam): ExistingExamContext {
  return {
    id: exam.id,
    parts: exam.parts ?? [],
    timeType: exam.timeType,
    timeLimit: exam.timeLimit,
    numberOfItems: exam.numberOfItems ?? null,
    questions: (exam.questions ?? []).filter((q) => q.status !== "disabled"),
  };
}

export function defaultPlacement(exam: ExistingExamContext): AppendPlacement {
  return {
    target: exam.parts.length > 0 ? { kind: "new_parts" } : { kind: "no_part" },
    extendTime: exam.timeType !== "per_question",
  };
}

/** Applies the placement to the blueprint: only new parts are split, and only they can use a pool. */
export function placedBlueprint(bp: ExamBlueprint, exam: ExistingExamContext, placement: AppendPlacement): ExamBlueprint {
  const newParts = placement.target.kind === "new_parts";
  return {
    ...bp,
    splitIntoParts: newParts,
    usePool: newParts && bp.usePool,
    timeType: newParts && exam.timeType === "per_part" ? "per_part" : "per_exam",
    timeLimitOverride: null,
  };
}

export function targetPart(exam: ExistingExamContext, placement: AppendPlacement): ExamPart | undefined {
  const target = placement.target;
  return target.kind === "part" ? exam.parts.find((p) => p.id === target.partId) : undefined;
}

/** Questions in the target scope now, and how many of them a session draws (null = all). */
function currentScope(exam: ExistingExamContext, placement: AppendPlacement): { count: number; drawn: number | null } {
  const part = targetPart(exam, placement);
  if (part) return { count: exam.questions.filter((q) => q.partId === part.id).length, drawn: part.numberOfItems };
  return { count: exam.questions.length, drawn: exam.numberOfItems };
}

export interface ScopeSummary {
  /** Questions in the scope after adding */
  total: number;
  /** Items per session after adding; equals total when every question is used */
  perSession: number;
  /** Items per session before adding */
  perSessionBefore: number;
  suggested: number;
}

/** Only meaningful for the "no_part" and "part" targets; new parts carry their own counts. */
export function scopeSummary(
  exam: ExistingExamContext,
  placement: AppendPlacement,
  addedCount: number
): ScopeSummary {
  const { count, drawn } = currentScope(exam, placement);
  const total = count + addedCount;
  const perSessionBefore = drawn != null && drawn > 0 ? Math.min(drawn, count) : count;
  const suggested = Math.min(total, perSessionBefore + addedCount);
  const chosen = placement.sessionItems === undefined ? suggested : (placement.sessionItems ?? total);
  return { total, perSession: Math.min(total, Math.max(1, chosen)), perSessionBefore, suggested };
}

/** Minutes the new questions add to one session. */
export function addedMinutes(bp: ExamBlueprint, exam: ExistingExamContext, placement: AppendPlacement): number {
  if (placement.target.kind === "new_parts") return roundMinutes(sessionMinutes(bp));
  const { perSession, perSessionBefore } = scopeSummary(exam, placement, totalQuestions(bp));
  const extraItems = perSession - perSessionBefore;
  return extraItems > 0 ? roundMinutes(extraItems * minutesPerItem(bp)) : 0;
}

/**
 * Updates the exam (parts, items per session, time) first so new part IDs exist,
 * then saves the passages and questions.
 */
export async function appendToExam(
  exam: ExistingExamContext,
  applied: AppliedExam,
  bp: ExamBlueprint,
  placement: AppendPlacement,
  questionTypes: Pick<QuestionType, "id" | "name">[],
  onProgress?: (saved: number, total: number) => void
): Promise<void> {
  const addedCount = sectionQuestions(applied.sections).length;
  const keepPartPassing = exam.parts.some((p) => p.passingCondition);
  const toPayload = (p: ExamPart) => toExamPartPayload(p, exam.timeType, keepPartPassing);
  const update: UpdateExamPayload = {};
  const minutes = placement.extendTime ? addedMinutes(bp, exam, placement) : 0;

  if (placement.target.kind === "new_parts") {
    const newParts = applied.sections.flatMap((s) => (s.type === "part" ? [s.part] : []));
    update.parts = [...exam.parts, ...newParts].map(toPayload);
    if (exam.timeType === "per_exam" && minutes > 0) update.timeLimit = exam.timeLimit + minutes;
  } else {
    const { total, perSession } = scopeSummary(exam, placement, addedCount);
    const drawn = perSession < total ? perSession : null;
    const part = targetPart(exam, placement);
    if (part) {
      update.parts = exam.parts
        .map((p) =>
          p.id === part.id
            ? {
                ...p,
                numberOfItems: drawn,
                timeLimit: exam.timeType === "per_part" && minutes > 0 ? (p.timeLimit ?? 0) + minutes : p.timeLimit,
              }
            : p
        )
        .map(toPayload);
    } else {
      update.numberOfItems = drawn;
    }
    if (exam.timeType === "per_exam" && minutes > 0) update.timeLimit = exam.timeLimit + minutes;
  }

  if (Object.keys(update).length > 0) await api.updateExam(exam.id, update);
  await saveSectionsToExam(exam.id, applied.sections, questionTypes, onProgress);
}
