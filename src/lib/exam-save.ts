import { api } from "@/lib/api";
import { getLayoutConfig } from "@/lib/question-layout";
import { parseBlanks } from "@/lib/question-blanks";
import type { QuestionSection } from "@/lib/exam-sections";
import type { CreateExamQuestionPayload, ExamOrigin, QuestionType } from "@/types";

/**
 * Converts an editor question to the API shape: choice answers are stored by the editor as
 * option indexes and sent as option text; text answers collapse to a string when there is one.
 */
export function toApiQuestionPayload(
  q: CreateExamQuestionPayload,
  questionTypes: Pick<QuestionType, "id" | "name">[]
): CreateExamQuestionPayload {
  const typeName = questionTypes.find((qt) => qt.id === q.questionTypeId)?.name;
  if (!Array.isArray(q.correctAnswer) || !typeName) return q;
  const config = getLayoutConfig(typeName);
  if (config.correctAnswerIsText) {
    const filtered = (q.correctAnswer as string[]).filter(Boolean);
    const orderedBlanks = parseBlanks(q.questionText).blankCount > 1;
    return {
      ...q,
      correctAnswer: filtered.length === 1 ? filtered[0] : filtered,
      ...(orderedBlanks && { metadata: { ...q.metadata, orderedBlanks: true } }),
    };
  }
  return {
    ...q,
    correctAnswer: (q.correctAnswer as string[]).map((idx) => q.options[Number(idx)]).filter(Boolean),
  };
}

export function sectionQuestions(sections: QuestionSection[]): CreateExamQuestionPayload[] {
  return sections.flatMap((s) => {
    if (s.type === "standalone") return [s.question];
    if (s.type === "phrase") return s.questions;
    return [...s.questions, ...s.phrases.flatMap((p) => p.questions)];
  });
}

/** "ai" when every question was generated, "manual" when none were, otherwise "mixed". */
export function examOriginFor(questions: Pick<CreateExamQuestionPayload, "metadata">[]): ExamOrigin {
  const aiCount = questions.filter((q) => q.metadata?.ai?.generated).length;
  if (aiCount === 0) return "manual";
  return aiCount === questions.length ? "ai" : "mixed";
}

async function createPhrase(
  examId: string,
  phrase: { title: string; body: string; usageType?: string },
  imageFiles: File[],
  partId?: string
): Promise<string> {
  const body = (phrase.body || "").trim() || "(No content)";
  const title = (phrase.title || "").trim();
  let res;
  if (imageFiles.length > 0) {
    const formData = new FormData();
    formData.set("body", body);
    if (title) formData.set("title", title);
    formData.set("examId", examId);
    if (partId) formData.set("partId", partId);
    formData.set("usageType", phrase.usageType || "passage");
    imageFiles.forEach((f) => formData.append("images", f));
    res = await api.createPhraseWithFiles(formData);
  } else {
    res = await api.createPhrase({
      body,
      title: title || null,
      examId,
      ...(partId && { partId }),
      usageType: phrase.usageType || "passage",
    });
  }
  const phraseId = (res?.data as { id?: string })?.id;
  if (!phraseId) throw new Error("Phrase created but no ID returned");
  return phraseId;
}

/** Creates the sections' passages and questions in an existing exam, in order. */
export async function saveSectionsToExam(
  examId: string,
  sections: QuestionSection[],
  questionTypes: Pick<QuestionType, "id" | "name">[],
  onProgress?: (saved: number, total: number) => void
): Promise<void> {
  const total = sectionQuestions(sections).length;
  let saved = 0;
  const save = async (q: CreateExamQuestionPayload, extra: { partId?: string; phraseId?: string }) => {
    await api.createExamQuestion({ ...toApiQuestionPayload(q, questionTypes), examId, ...extra });
    onProgress?.(++saved, total);
  };

  for (const sec of sections) {
    if (sec.type === "standalone") {
      await save(sec.question, {});
    } else if (sec.type === "phrase") {
      const phraseId = await createPhrase(examId, sec.phrase, sec.imageFiles);
      for (const q of sec.questions) await save(q, { phraseId });
    } else {
      const partId = sec.part.id;
      for (const q of sec.questions) await save(q, { partId });
      for (const partPhrase of sec.phrases) {
        const phraseId = await createPhrase(examId, partPhrase.phrase, partPhrase.imageFiles, partId);
        for (const q of partPhrase.questions) await save(q, { partId, phraseId });
      }
    }
  }
}
