/**
 * AI exam generation pipeline (Firebase AI Logic / Gemini):
 *   1. transcribeSources – read photos and scanned pages into text
 *   2. analyzeMaterial   – detect subject, level, topics and recommend an exam blueprint
 *      planFromPrompt    – same output from a short description when there is no material
 *   3. generateExam      – write questions in batches that follow the blueprint
 *   4. generatedToSections – convert the result into the exam editor's sections
 */

import { Schema, type Part } from "firebase/ai";
import { generateJson } from "@/lib/ai";
import {
  EXAM_PURPOSES,
  LAYOUT_DESCRIPTIONS,
  LAYOUT_LABELS,
  PURPOSE_PRESETS,
  QUESTION_LAYOUTS,
  COGNITIVE_LEVEL_LABELS,
  EDUCATION_LEVEL_LABELS,
  effectiveTimeLimit,
  estimateLayoutMinutes,
  estimatePassageMinutes,
  itemsPerSession,
  roundMinutes,
  sessionLayoutCount,
  sessionPassageCount,
  splitByDifficulty,
  totalQuestions,
  type CognitiveLevel,
  type Difficulty,
  type EducationLevel,
  type ExamBlueprint,
  type ExamPurpose,
} from "@/lib/exam-blueprint";
import { resolveQuestionLayout, type QuestionLayout } from "@/lib/question-layout";
import { parseBlanks } from "@/lib/question-blanks";
import { latexToPlainMath, normalizeAnswer } from "@/lib/math-notation";
import { genPartId, genPartPhraseId, genSectionId, type QuestionSection } from "@/lib/exam-sections";
import type { ExtractedSource, SourceImage } from "@/lib/source-extract";
import type { AiQuestionMetadata, CreateExamQuestionPayload, ExamPart } from "@/types";

/** ~150k tokens; keeps prompts well inside the model context and free-tier limits */
const MAX_CORPUS_CHARS = 600_000;
/** Below this size every batch gets the full material instead of topic-filtered pages */
const SMALL_CORPUS_CHARS = 60_000;
const IMAGES_PER_TRANSCRIPTION_CALL = 6;
const QUESTIONS_PER_BATCH = 15;
const ESSAYS_PER_BATCH = 5;
const CONCURRENCY = 3;
const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const COGNITIVE_LEVELS = Object.keys(COGNITIVE_LEVEL_LABELS) as CognitiveLevel[];
const EDUCATION_LEVELS = Object.keys(EDUCATION_LEVEL_LABELS) as EducationLevel[];

export type ProgressCallback = (done: number, total: number, label: string) => void;

// ============ Shared helpers ============

interface MaterialPage {
  ref: string;
  text: string;
  sourceId: string;
  page?: number;
}

function pageRef(source: ExtractedSource, label: string, sources: ExtractedSource[]): string {
  const sameName = sources.filter((s) => s.name === source.name);
  const name = sameName.length > 1 ? `${source.name} (${sameName.indexOf(source) + 1})` : source.name;
  return `${name} — ${label}`;
}

function buildCorpus(sources: ExtractedSource[]): MaterialPage[] {
  return sources.flatMap((source) =>
    source.pages
      .filter((p) => p.text && p.text.trim())
      .map((p) => ({ ref: pageRef(source, p.label, sources), text: p.text!.trim(), sourceId: source.id, page: p.page }))
  );
}

function formatCorpus(pages: MaterialPage[]): { text: string; truncated: boolean } {
  let text = "";
  for (const page of pages) {
    const block = `<<Reference: ${page.ref}>>\n${page.text}\n\n`;
    if (text.length + block.length > MAX_CORPUS_CHARS) return { text, truncated: true };
    text += block;
  }
  return { text, truncated: false };
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
  onDone?: (done: number) => void
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < tasks.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await tasks[index]() };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
      onDone?.(++done);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

function imagePart(image: SourceImage): Part {
  return { inlineData: { mimeType: image.mimeType, data: image.data } };
}

function genQuestionId() {
  return `gq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ============ 1. Transcription ============

const transcriptionSchema = Schema.object({
  properties: {
    pages: Schema.array({
      items: Schema.object({
        properties: {
          ref: Schema.string({ description: "Reference label exactly as given" }),
          text: Schema.string(),
        },
      }),
    }),
  },
});

/**
 * How math must be written in everything the model returns. The app renders this notation like a
 * printed exam (see math-notation.ts); LaTeX would show up as raw backslashes and braces.
 */
export const MATH_NOTATION = `Never use LaTeX or Markdown math: no $...$, \\(...\\), \\frac, \\times, \\div, \\sqrt, or braces. Write math in this plain-text notation, which the app displays like a printed exam:
  - Multiplication: × (e.g. 3 × 4). Division: ÷ (e.g. 12 ÷ 4). Never use * for multiplication.
  - Fractions: a/b with no spaces around the slash; it is displayed stacked. Whenever the top or bottom has more than one number or letter, wrap it in parentheses: (2x^3y)/(3x^2), (x+1)/2, 5/(2x). Letters written right after the denominator belong to it (3x/10x^2 is 3x over 10x²), so write a fraction times a variable as (1/2)x. Mixed numbers: 1 1/2.
  - Never write a spaced slash or chain slashes and ÷ ambiguously. Dividing fractions: (2x^3y)/(3x^2) ÷ (5y^2)/(18xy), not 2x^3y/3x^2 ÷ 5y^2 / 18xy.
  - Exponents: ^ (x^2, 10^-3, 2^(n+1)); group longer exponents in parentheses. Scientific notation: 3.0 × 10^8.
  - Subscripts: Unicode subscript digits for chemical formulas and ions (H₂O, CO₂, SO₄²⁻, Ca²⁺) and indexed variables (x₁, a₂); x_n for letter subscripts.
  - Roots: sqrt(16), sqrt(x+1), cbrt(27).
  - Symbols: ≤ ≥ ≠ ≈ ± ∞ π ° ∠ △ ⊥ ∥ ≅ ∈ ∪ ∩ ∅ ∑ ∫ Δ, Greek letters (α β θ λ μ Ω), units with ℃ or °C, arrows → for reactions and implications, ⇌ for reversible reactions.
  - Units: rates inline as m/s, km/h, m/s^2.
  - Subtraction: 7 - 3 with spaces around the minus; negative numbers as -5.`;

const TRANSCRIBE_PROMPT = `You are transcribing study material (lecture slides, textbook pages, handwritten notes, or whiteboard photos) so it can be used to write exam questions.
For every image, return its reference label and the full text exactly as written. Preserve headings, bullet lists, numbering, and formulas.
${MATH_NOTATION}
Describe diagrams, charts, tables, and figures in words, including labels and values, so their information is usable without the image.
Ignore page decorations such as headers, footers, and slide numbers. If an image is unreadable, return an empty string for it.`;

/** Fills in text for every page that only has images. Returns new source objects; inputs are not mutated. */
export async function transcribeSources(
  sources: ExtractedSource[],
  onProgress?: ProgressCallback
): Promise<{ sources: ExtractedSource[]; warnings: string[] }> {
  const jobs: { sourceIndex: number; pageIndex: number; ref: string; images: SourceImage[] }[] = [];
  sources.forEach((source, sourceIndex) =>
    source.pages.forEach((page, pageIndex) => {
      if (page.images?.length) {
        jobs.push({ sourceIndex, pageIndex, ref: pageRef(source, page.label, sources), images: page.images });
      }
    })
  );
  if (jobs.length === 0) return { sources, warnings: [] };

  const batches: (typeof jobs)[] = [];
  let current: typeof jobs = [];
  let imageCount = 0;
  for (const job of jobs) {
    if (current.length > 0 && imageCount + job.images.length > IMAGES_PER_TRANSCRIPTION_CALL) {
      batches.push(current);
      current = [];
      imageCount = 0;
    }
    current.push(job);
    imageCount += job.images.length;
  }
  if (current.length > 0) batches.push(current);

  onProgress?.(0, batches.length, "Reading photos and scanned pages…");

  const results = await runWithConcurrency(
    batches.map((batch) => async () => {
      const parts: Part[] = [{ text: TRANSCRIBE_PROMPT }];
      for (const job of batch) {
        parts.push({ text: `Reference: ${job.ref}` });
        job.images.forEach((img) => parts.push(imagePart(img)));
      }
      const text = await generateJson(transcriptionSchema, parts, { temperature: 0, maxOutputTokens: 32768 });
      return JSON.parse(text) as { pages: { ref: string; text: string }[] };
    }),
    CONCURRENCY,
    (done) => onProgress?.(done, batches.length, "Reading photos and scanned pages…")
  );

  const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (firstFailure && results.every((r) => r.status === "rejected")) throw firstFailure.reason;

  const next = sources.map((s) => ({ ...s, pages: s.pages.map((p) => ({ ...p })) }));
  const warnings: string[] = [];
  let failedPages = 0;
  results.forEach((result, batchIndex) => {
    const batch = batches[batchIndex];
    if (result.status === "rejected") {
      failedPages += batch.length;
      return;
    }
    const byRef = new Map(result.value.pages.map((p) => [p.ref.trim(), p.text]));
    batch.forEach((job, i) => {
      const text = byRef.get(job.ref) ?? result.value.pages[i]?.text ?? "";
      const page = next[job.sourceIndex].pages[job.pageIndex];
      page.text = [page.text, text].filter((t) => t && t.trim()).join("\n\n");
      page.images = undefined;
    });
  });
  if (failedPages > 0) warnings.push(`${failedPages} page(s) could not be read by the AI and were left out.`);
  return { sources: next, warnings };
}

// ============ 2. Analysis ============

export interface MaterialTopic {
  name: string;
  importance: number;
  refs: string[];
  /** Concepts and skills to test; set when the exam is planned from a description */
  keyPoints?: string[];
}

export interface MaterialAnalysis {
  title: string;
  subject: string;
  educationLevel: EducationLevel;
  /** Specific examinee group, e.g. "Grade 6 students" */
  audience?: string;
  language: string;
  contentType: "lecture_notes" | "textbook" | "slides" | "existing_exam" | "reading_material" | "mixed" | "description";
  summary: string;
  topics: MaterialTopic[];
  hasReadingPassages: boolean;
  containsExistingQuestions: boolean;
  recommendedPurpose: ExamPurpose;
  recommendedItemCount: number;
  recommendedLayouts: QuestionLayout[];
  rationale: string;
  /** The teacher's description of the exam they want */
  request?: string;
}

const AUDIENCE_DESCRIPTION = "Specific examinee group if known, e.g. 'Grade 6 students', 'First-year nursing students'";

const analysisSchema = Schema.object({
  properties: {
    title: Schema.string({ description: "Suggested exam title, e.g. 'Cell Biology Long Test'" }),
    subject: Schema.string(),
    educationLevel: Schema.enumString({ enum: EDUCATION_LEVELS }),
    audience: Schema.string({ description: AUDIENCE_DESCRIPTION }),
    language: Schema.string({ description: "Main language of the material, e.g. 'English', 'Filipino'" }),
    contentType: Schema.enumString({
      enum: ["lecture_notes", "textbook", "slides", "existing_exam", "reading_material", "mixed"],
    }),
    summary: Schema.string({ description: "2-3 sentence overview of what the material covers" }),
    topics: Schema.array({
      items: Schema.object({
        properties: {
          name: Schema.string(),
          importance: Schema.integer({ description: "1 (minor) to 5 (central)" }),
          refs: Schema.array({ items: Schema.string(), description: "Reference labels where the topic appears" }),
        },
      }),
    }),
    hasReadingPassages: Schema.boolean({
      description: "True if the material contains prose suitable for reading-comprehension passages (stories, articles, essays)",
    }),
    containsExistingQuestions: Schema.boolean(),
    recommendedPurpose: Schema.enumString({ enum: EXAM_PURPOSES }),
    recommendedItemCount: Schema.integer(),
    recommendedLayouts: Schema.array({ items: Schema.enumString({ enum: QUESTION_LAYOUTS }) }),
    rationale: Schema.string({ description: "1-2 sentences explaining the recommended exam type and size" }),
  },
  optionalProperties: ["audience"],
});

function purposeGuide(): string {
  return EXAM_PURPOSES.map((p) => {
    const preset = PURPOSE_PRESETS[p];
    return `- ${p}: ${preset.description} (${preset.itemRange[0]}-${preset.itemRange[1]} items)`;
  }).join("\n");
}

const LEVEL_GUIDE = `Examinee levels: Kindergarten to Grade 6 → elementary; Grades 7-10 → junior_high; Grades 11-12 → senior_high; college or university courses → college; board, licensure, or certification review → professional; otherwise general.`;

function requestBlock(request: string | undefined, intro: string): string {
  const trimmed = request?.trim();
  return trimmed ? `\n${intro}\n"""\n${trimmed}\n"""\n` : "";
}

function normalizeAnalysis(analysis: MaterialAnalysis): MaterialAnalysis {
  analysis.topics = (analysis.topics ?? [])
    .filter((t) => t.name?.trim())
    .map((t) => ({
      ...t,
      name: t.name.trim(),
      refs: t.refs ?? [],
      ...(t.keyPoints && { keyPoints: t.keyPoints.map(cleanText).filter(Boolean) }),
    }))
    .sort((a, b) => b.importance - a.importance);
  analysis.recommendedLayouts = (analysis.recommendedLayouts ?? []).filter((l) => QUESTION_LAYOUTS.includes(l));
  if (!EXAM_PURPOSES.includes(analysis.recommendedPurpose)) analysis.recommendedPurpose = "quiz";
  if (!Number.isFinite(analysis.recommendedItemCount) || analysis.recommendedItemCount < 1) {
    analysis.recommendedItemCount = PURPOSE_PRESETS[analysis.recommendedPurpose].itemRange[0];
  }
  if (!EDUCATION_LEVELS.includes(analysis.educationLevel)) analysis.educationLevel = "general";
  analysis.audience = analysis.audience?.trim() || undefined;
  return analysis;
}

export async function analyzeMaterial(
  sources: ExtractedSource[],
  request?: string
): Promise<{ analysis: MaterialAnalysis; warnings: string[] }> {
  const corpus = buildCorpus(sources);
  if (corpus.length === 0) throw new Error("No readable text was found in the material.");
  const { text, truncated } = formatCorpus(corpus);
  const warnings = truncated
    ? ["The material is very long, so only the first part was analyzed. Consider splitting it into several exams."]
    : [];

  const prompt = `You are an experienced teacher and assessment designer. Analyze the study material below and recommend the exam that best fits it.
${requestBlock(
  request,
  "The teacher described the exam they want. Follow it for the exam type, size, question types, examinee level, and which parts of the material to focus on, as far as the material supports it:"
)}
Exam purposes:
${purposeGuide()}

Question layouts: ${QUESTION_LAYOUTS.join(", ")}.

${LEVEL_GUIDE}

Guidelines:
- A single short lesson or a few slides suits a quiz; a full chapter or unit suits a long_test; several chapters suit a midterm or final.
- Recommend an item count proportional to how much testable content there is; never more than the material can support without repeating facts.
- Recommend layouts the content supports: definitions and terms suit identification; processes, comparisons, and arguments suit essay; factual statements suit true_false.
- List 3-15 topics, ordered by importance. For each topic, list the reference labels (exactly as given) where it appears.
- If the material is itself an exam or worksheet, set containsExistingQuestions to true.
- ${MATH_NOTATION}

Material:
${text}`;

  const response = await generateJson(analysisSchema, prompt, { temperature: 0.2, maxOutputTokens: 8192 });
  const analysis = normalizeAnalysis(JSON.parse(response) as MaterialAnalysis);
  if (request?.trim()) analysis.request = request.trim();
  return { analysis, warnings };
}

const promptPlanSchema = Schema.object({
  properties: {
    title: Schema.string({ description: "Exam title, e.g. 'Grade 6 English: Phrases and Clauses Quiz'" }),
    subject: Schema.string(),
    educationLevel: Schema.enumString({ enum: EDUCATION_LEVELS }),
    audience: Schema.string({ description: AUDIENCE_DESCRIPTION }),
    language: Schema.string({ description: "Language the exam is written in, e.g. 'English', 'Filipino'" }),
    summary: Schema.string({ description: "2-3 sentences describing what the exam covers, suitable as its description" }),
    topics: Schema.array({
      items: Schema.object({
        properties: {
          name: Schema.string(),
          importance: Schema.integer({ description: "1 (minor) to 5 (central)" }),
          keyPoints: Schema.array({
            items: Schema.string(),
            description: "3-6 specific concepts, rules, skills, or facts examinees should know for this topic",
          }),
        },
      }),
    }),
    hasReadingPassages: Schema.boolean({
      description: "True if reading-comprehension passages written by the AI suit this exam",
    }),
    recommendedPurpose: Schema.enumString({ enum: EXAM_PURPOSES }),
    recommendedItemCount: Schema.integer(),
    recommendedLayouts: Schema.array({ items: Schema.enumString({ enum: QUESTION_LAYOUTS }) }),
    rationale: Schema.string({ description: "1-2 sentences explaining the recommended exam type and size" }),
  },
});

/** Plans an exam from a short description such as "Grade 6 English exam about phrases and clauses". */
export async function planFromPrompt(request: string): Promise<{ analysis: MaterialAnalysis; warnings: string[] }> {
  const trimmed = request.trim();
  if (!trimmed) throw new Error("Describe the exam you want to generate.");

  const prompt = `You are an experienced teacher and curriculum designer. A teacher described the exam they need. There is no study material: plan the exam from the description and from what is normally taught at that level.
${requestBlock(trimmed, "Teacher's description:")}
Exam purposes:
${purposeGuide()}

Question layouts: ${QUESTION_LAYOUTS.join(", ")}.

${LEVEL_GUIDE}

Guidelines:
- Infer the subject, examinee level, audience, and language from the description. The language is the one the description asks for; for a language subject (e.g. English, Filipino) use that language; otherwise the language the description is written in.
- Stay within the scope the teacher asked for. Keep every topic they name, and split broad topics into subtopics instead of adding unrelated ones. If the description only names a subject, choose the core topics of that subject at that level.
- List 2-10 topics, ordered by importance. For each, give 3-6 keyPoints: the specific concepts, rules, definitions, skills, or facts examinees at this level are expected to know, each a short, accurate sentence. Questions will be written from these, so match the depth of a typical curriculum for the level.
- If the description states an exam type, item count, or question types, follow it exactly. Otherwise a narrow topic suits a quiz, a unit suits a long_test, and a whole term suits a midterm or final.
- Recommend layouts that fit the topics: terms and definitions suit identification; rules and facts suit true_false and multiple_choice; explanations and arguments suit essay. For young examinees, prefer multiple_choice, true_false, and short identification.
- Set hasReadingPassages to true only when reading comprehension fits the subject (language, literature, reading) or the description asks for passages.
- ${MATH_NOTATION}`;

  const response = await generateJson(promptPlanSchema, prompt, { temperature: 0.3, maxOutputTokens: 8192 });
  const plan = JSON.parse(response) as Omit<MaterialAnalysis, "contentType" | "containsExistingQuestions" | "request">;
  const analysis = normalizeAnalysis({
    ...plan,
    topics: (plan.topics ?? []).map((t) => ({ ...t, refs: [] })),
    contentType: "description",
    containsExistingQuestions: false,
    request: trimmed,
  });
  if (analysis.topics.length === 0) throw new Error("The AI couldn't work out topics from that description. Add more detail and try again.");
  return { analysis, warnings: [] };
}

// ============ 3. Generation ============

export interface GeneratedQuestion {
  id: string;
  layout: QuestionLayout;
  questionText: string;
  options: string[];
  /** Indexes into options (choice layouts) */
  correctIndexes: number[];
  /** Identification answers: one per blank, or the answer followed by accepted variants */
  acceptedAnswers: string[];
  rubric: string;
  explanation: string;
  difficulty: Difficulty;
  cognitiveLevel: CognitiveLevel;
  topic: string;
  sourceRef: string;
  /** Text of the cited page as the AI read it */
  sourceExcerpt: string;
  /** ExtractedSource the cited page belongs to */
  sourceId?: string;
  /** PDF page number of the cited page */
  sourcePage?: number;
  /** Link to the uploaded original file; set when the questions are applied */
  sourceUrl?: string;
  /** Problems found while validating; shown to the proctor during review */
  issues: string[];
  passageId?: string;
}

export interface GeneratedPassage {
  id: string;
  title: string;
  body: string;
  sourceRef: string;
}

export interface GenerationResult {
  questions: GeneratedQuestion[];
  passages: GeneratedPassage[];
  warnings: string[];
}

interface RawQuestion {
  questionText: string;
  options: string[];
  correctOptions: string[];
  acceptedAnswers: string[];
  rubric?: string;
  explanation: string;
  difficulty: Difficulty;
  cognitiveLevel: CognitiveLevel;
  topic: string;
  sourceRef: string;
}

const questionSchema = Schema.object({
  properties: {
    questionText: Schema.string(),
    options: Schema.array({ items: Schema.string(), description: "Empty for identification and essay" }),
    correctOptions: Schema.array({
      items: Schema.enumString({ enum: OPTION_LETTERS }),
      description: "Letters of the correct options; empty for identification and essay",
    }),
    acceptedAnswers: Schema.array({ items: Schema.string(), description: "Identification answers; empty otherwise" }),
    rubric: Schema.string({ description: "Essay only: expected key points and scoring guide" }),
    explanation: Schema.string({ description: "1-2 sentences on why the answer is correct" }),
    difficulty: Schema.enumString({ enum: DIFFICULTIES }),
    cognitiveLevel: Schema.enumString({ enum: COGNITIVE_LEVELS }),
    topic: Schema.string(),
    sourceRef: Schema.string({ description: "Reference label of the page the question is based on" }),
  },
  optionalProperties: ["rubric"],
});

const questionBatchSchema = Schema.object({
  properties: { questions: Schema.array({ items: questionSchema }) },
});

const passageBatchSchema = Schema.object({
  properties: {
    passages: Schema.array({
      items: Schema.object({
        properties: {
          title: Schema.string(),
          body: Schema.string(),
          sourceRef: Schema.string(),
          questions: Schema.array({ items: questionSchema }),
        },
      }),
    }),
  },
});

type Batch =
  | { kind: "questions"; layout: QuestionLayout; count: number; topics: string[] }
  | { kind: "passages"; passageCount: number; questionsPerPassage: number };

function planBatches(bp: ExamBlueprint): Batch[] {
  const batches: Batch[] = [];
  for (const layout of QUESTION_LAYOUTS) {
    const total = bp.questionCounts[layout];
    if (total <= 0) continue;
    const size = layout === "essay" ? ESSAYS_PER_BATCH : QUESTIONS_PER_BATCH;
    const batchCount = Math.ceil(total / size);
    for (let i = 0; i < batchCount; i++) {
      const count = Math.floor(total / batchCount) + (i < total % batchCount ? 1 : 0);
      const topics =
        batchCount > 1 && bp.topics.length >= batchCount
          ? bp.topics.filter((_, ti) => ti % batchCount === i)
          : bp.topics;
      batches.push({ kind: "questions", layout, count, topics });
    }
  }
  if (bp.includePassages && bp.passageCount > 0 && bp.questionsPerPassage > 0) {
    batches.push({ kind: "passages", passageCount: bp.passageCount, questionsPerPassage: bp.questionsPerPassage });
  }
  return batches;
}

function layoutRules(layout: QuestionLayout, choices: number, points: number): string {
  switch (layout) {
    case "multiple_choice":
      return `Each question has exactly ${choices} options and exactly one correct option. Distractors must be plausible, similar in length and style to the answer, and clearly wrong to someone who knows the material. Avoid "all of the above" and "none of the above".`;
    case "multiple_answer":
      return `Each question has exactly ${choices} options with two or more correct options (never all of them). End each question with "(Select all that apply.)".`;
    case "true_false":
      return `Each question is a single declarative statement. options must be exactly ["True", "False"]; correctOptions is ["A"] for true statements and ["B"] for false ones. Make roughly half true and half false. False statements must change one meaningful detail, not just add "not".`;
    case "identification":
      return `options and correctOptions are empty. Either ask for a specific term, name, date, or value, or write a fill-in-the-blank sentence using "_____" (five underscores) for each blank. For fill-in-the-blank, acceptedAnswers has exactly one answer per blank, in order. Otherwise acceptedAnswers lists the expected answer first, then up to 3 accepted variants (abbreviations, alternate spellings). Answers should be 1-4 words.`;
    case "essay":
      return `options, correctOptions, and acceptedAnswers are empty. Ask open-ended questions that require explaining, comparing, or evaluating ideas from the material. Provide a rubric listing the key points expected and how to award ${points} points.`;
    case "ordering":
    case "matching":
    case "audio":
    case "hotspot":
      // Not in QUESTION_LAYOUTS, so the generator never requests these
      return "";
  }
}

function blueprintContext(bp: ExamBlueprint, analysis: MaterialAnalysis): string {
  const level = EDUCATION_LEVEL_LABELS[bp.educationLevel];
  // The audience only applies while the proctor keeps the level the AI detected
  const audience = analysis.audience && bp.educationLevel === analysis.educationLevel ? ` (${analysis.audience})` : "";
  return [
    `Exam: ${PURPOSE_PRESETS[bp.purpose].label} — "${bp.title}"`,
    `Subject: ${bp.subject}`,
    `Examinee level: ${level}${audience}`,
    `Language: write every question, option, and answer in ${bp.language}.`,
    `Thinking skills to target: ${bp.cognitiveFocus.map((c) => COGNITIVE_LEVEL_LABELS[c]).join(", ")}.`,
  ].join("\n");
}

const SHARED_RULES = `- Write questions that stand alone: never mention "the text", "the lecture", "the slide", or page numbers.
- Do not repeat a fact across questions, and don't let one question reveal another's answer.
- Do not use underscores except for blanks in identification questions.
- Keep wording clear and unambiguous, appropriate for the examinee level.
- Math notation applies to questionText, every option, acceptedAnswers, explanation, rubric, and passages. Keep options in the same notation as each other and as the question.
- Do not list notation-only variants in acceptedAnswers (3/4 vs ¾, 3 × 4 vs 3*4, x^2 vs x²); they are graded as equal. Use the variant slots for genuinely different accepted answers (e.g. 0.75 for 3/4).
- ${MATH_NOTATION}`;

const MATERIAL_RULES = `General rules:
- Base every question only on the material. Do not use outside facts.
- sourceRef must be one of the reference labels from the material, copied exactly.
${SHARED_RULES}`;

const TOPIC_RULES = `General rules:
- There is no study material. Write from accurate, well-established knowledge of the topics, at the depth normally taught at the examinee level. The topic guide sets the scope; closely related details a teacher at this level would expect are fine.
- Every question must have exactly one defensible answer (or exactly the marked answers). Avoid facts that are disputed, outdated, or differ between textbooks or regions.
- For skills (grammar, computation, problem solving), mostly write items that apply the skill to fresh example sentences or problems rather than items that only ask for definitions.
- Use examples, names, and situations familiar to the examinees.
- sourceRef must be the name of the topic the question tests, copied exactly from the topic guide.
${SHARED_RULES}`;

function teacherNotes(bp: ExamBlueprint, analysis: MaterialAnalysis): string {
  const notes: string[] = [];
  if (analysis.request) {
    notes.push(
      `The teacher's original request (the counts and question types above take precedence over any it mentions): ${analysis.request}`
    );
  }
  if (bp.additionalInstructions.trim()) notes.push(`Additional instructions from the teacher: ${bp.additionalInstructions.trim()}`);
  return notes.length > 0 ? `\n${notes.join("\n")}\n` : "";
}

/** Reference for description-based exams: the planned topics and their key points. */
function topicGuide(analysis: MaterialAnalysis, topics: string[]): string {
  const selected = topics.length > 0 ? analysis.topics.filter((t) => topics.includes(t.name)) : analysis.topics;
  return (selected.length > 0 ? selected : analysis.topics)
    .map((t) => {
      const points = (t.keyPoints ?? []).map((k) => `  - ${k}`).join("\n");
      return points ? `${t.name}:\n${points}` : t.name;
    })
    .join("\n");
}

function selectMaterial(corpus: MaterialPage[], topics: string[], analysis: MaterialAnalysis): string {
  const full = formatCorpus(corpus).text;
  if (full.length <= SMALL_CORPUS_CHARS || topics.length === 0) return full;
  const refs = new Set(
    analysis.topics.filter((t) => topics.includes(t.name)).flatMap((t) => t.refs.map((r) => r.trim()))
  );
  const selected = corpus.filter((p) => refs.has(p.ref));
  const text = formatCorpus(selected).text;
  return text.length >= 2000 ? text : full;
}

const MAX_AVOID_QUESTIONS = 150;

function avoidBlock(existing: string[]): string {
  if (existing.length === 0) return "";
  const list = existing
    .slice(0, MAX_AVOID_QUESTIONS)
    .map((q) => `- ${q.replace(/\s+/g, " ").slice(0, 200)}`)
    .join("\n");
  return `\nThe exam already contains these questions. Do not repeat them or test the same fact the same way:\n${list}\n`;
}

/** What the questions are written from: uploaded material, or the topic guide of a description-based plan. */
type Reference = { kind: "material"; text: string } | { kind: "topics"; text: string };

function referenceBlock(reference: Reference): string {
  return reference.kind === "material" ? `Material:\n${reference.text}` : `Topic guide:\n${reference.text}`;
}

function questionBatchPrompt(
  bp: ExamBlueprint,
  analysis: MaterialAnalysis,
  batch: Extract<Batch, { kind: "questions" }>,
  reference: Reference,
  existing: string[]
): string {
  const split = splitByDifficulty(batch.count, bp.difficultyMix);
  return `You are an experienced teacher writing exam questions.
${blueprintContext(bp, analysis)}

Write exactly ${batch.count} ${LAYOUT_LABELS[batch.layout]} questions: ${split.easy} easy, ${split.medium} medium, ${split.hard} hard.
${batch.topics.length > 0 ? `Cover these topics, spreading questions across them by importance: ${batch.topics.join("; ")}.` : ""}

${LAYOUT_LABELS[batch.layout]} rules: ${layoutRules(batch.layout, bp.choicesPerQuestion, bp.pointsPerLayout[batch.layout])}

${reference.kind === "material" ? MATERIAL_RULES : TOPIC_RULES}
${teacherNotes(bp, analysis)}${avoidBlock(existing)}
${referenceBlock(reference)}`;
}

function passageBatchPrompt(
  bp: ExamBlueprint,
  analysis: MaterialAnalysis,
  batch: Extract<Batch, { kind: "passages" }>,
  reference: Reference
): string {
  const task =
    reference.kind === "material"
      ? `Choose ${batch.passageCount} passage(s) from the material, each 120-400 words, quoted or lightly adapted so it reads well on its own. Give each a short title.
For each passage, write exactly ${batch.questionsPerPassage} Multiple Choice questions answerable from that passage alone, mixing literal, inferential, and vocabulary-in-context questions.`
      : `Write ${batch.passageCount} original passage(s) suited to the examinees, each 120-400 words: a story, article, or informational text that reads well on its own and relates to the topics. Give each a short title. Set sourceRef to an empty string.
For each passage, write exactly ${batch.questionsPerPassage} Multiple Choice questions answerable from that passage alone, mixing literal, inferential, and vocabulary-in-context questions. Where it fits, also ask questions that apply the topics to the passage (for example, a language feature used in it).`;
  return `You are an experienced teacher writing a reading-comprehension section.
${blueprintContext(bp, analysis)}

${task}

Multiple Choice rules: ${layoutRules("multiple_choice", bp.choicesPerQuestion, bp.pointsPerLayout.multiple_choice)}

${reference.kind === "material" ? MATERIAL_RULES : TOPIC_RULES}
- In this section, questions may refer to "the passage".
${teacherNotes(bp, analysis)}
${referenceBlock(reference)}`;
}

const NO_SHUFFLE_PATTERN = /\b(all|none|both|neither) of the (above|following)\b|\bboth [a-h] and [a-h]\b|\b[a-h] and [a-h] only\b/i;

function shuffleOptions(options: string[], correct: number[]): { options: string[]; correct: number[] } {
  if (options.some((o) => NO_SHUFFLE_PATTERN.test(o))) return { options, correct };
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    options: order.map((i) => options[i]),
    correct: correct.map((c) => order.indexOf(c)).sort((a, b) => a - b),
  };
}

const MAX_SOURCE_EXCERPT_CHARS = 4000;

/** Finds the cited page; the model sometimes drops the " — Photo" / " — Page N" suffix. */
function resolveSourcePage(ref: string, pages: Map<string, MaterialPage>): MaterialPage | undefined {
  if (!ref) return undefined;
  const exact = pages.get(ref);
  if (exact) return exact;
  const prefixed = [...pages.values()].filter((p) => p.ref.startsWith(`${ref} — `));
  return prefixed.length === 1 ? prefixed[0] : undefined;
}

function sourceExcerpt(text: string): string {
  return text.length > MAX_SOURCE_EXCERPT_CHARS ? `${text.slice(0, MAX_SOURCE_EXCERPT_CHARS).trimEnd()}…` : text;
}

/** Trims model output and rewrites any LaTeX math in the app's notation. */
function cleanText(value: unknown): string {
  return latexToPlainMath(String(value ?? "").trim()).trim();
}

/** Validates and normalizes one raw question; returns null when it can't be used at all. */
function normalizeQuestion(
  raw: RawQuestion,
  layout: QuestionLayout,
  pages: Map<string, MaterialPage>,
  passageId?: string
): GeneratedQuestion | null {
  const questionText = cleanText(raw.questionText);
  if (!questionText) return null;
  const issues: string[] = [];
  let options: string[] = [];
  let correctIndexes: number[] = [];
  let acceptedAnswers: string[] = [];

  const rawOptions = (raw.options ?? []).map(cleanText);
  const rawCorrectTexts = (raw.correctOptions ?? [])
    .map((letter) => rawOptions[OPTION_LETTERS.indexOf(String(letter).toUpperCase())])
    .filter((t): t is string => !!t);

  if (layout === "true_false") {
    options = ["True", "False"];
    correctIndexes = rawCorrectTexts
      .map((t) => (/^true$/i.test(t) ? 0 : /^false$/i.test(t) ? 1 : -1))
      .filter((i) => i >= 0)
      .slice(0, 1);
    if (correctIndexes.length === 0) issues.push("No correct answer was identified.");
  } else if (layout === "multiple_choice" || layout === "multiple_answer") {
    const seen = new Set<string>();
    for (const opt of rawOptions) {
      const key = normalizeAnswer(opt);
      if (!opt || seen.has(key)) continue;
      seen.add(key);
      options.push(opt);
    }
    if (options.length < 2) return null;
    if (options.length < rawOptions.length) issues.push("Duplicate or empty options were removed.");
    correctIndexes = [...new Set(rawCorrectTexts.map((t) => options.findIndex((o) => normalizeAnswer(o) === normalizeAnswer(t))))]
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    if (layout === "multiple_choice" && correctIndexes.length > 1) {
      issues.push("More than one option was marked correct; only the first was kept.");
      correctIndexes = correctIndexes.slice(0, 1);
    }
    if (layout === "multiple_answer" && correctIndexes.length === options.length) {
      issues.push("Every option is marked correct.");
    }
    if (correctIndexes.length === 0) issues.push("No correct answer was identified.");
    ({ options, correct: correctIndexes } = shuffleOptions(options, correctIndexes));
  } else if (layout === "identification") {
    const blankCount = parseBlanks(questionText).blankCount;
    acceptedAnswers = (raw.acceptedAnswers ?? []).map(cleanText).filter(Boolean);
    if (blankCount === 0) {
      // Variants that differ only in notation (3/4 vs ¾, 3 × 4 vs 3*4) are graded as equal anyway
      acceptedAnswers = acceptedAnswers.filter(
        (a, i) => acceptedAnswers.findIndex((b) => normalizeAnswer(b) === normalizeAnswer(a)) === i
      );
    }
    if (acceptedAnswers.length === 0) issues.push("No accepted answer was provided.");
    else if (blankCount > 0 && acceptedAnswers.length < blankCount) {
      issues.push(`The question has ${blankCount} blanks but only ${acceptedAnswers.length} answer(s).`);
    }
  }

  // Without material (description-based exams) the model cites a topic name, not a page
  const grounded = pages.size > 0;
  const rawRef = grounded ? (raw.sourceRef ?? "").trim() : "";
  const page = resolveSourcePage(rawRef, pages);
  if (rawRef && !page) issues.push("The cited source page couldn't be matched to the material.");

  return {
    id: genQuestionId(),
    layout,
    questionText,
    options,
    correctIndexes,
    acceptedAnswers,
    rubric: cleanText(raw.rubric),
    explanation: cleanText(raw.explanation),
    difficulty: DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : "medium",
    cognitiveLevel: COGNITIVE_LEVELS.includes(raw.cognitiveLevel) ? raw.cognitiveLevel : "remember",
    topic: (raw.topic ?? "").trim() || (grounded ? "" : (raw.sourceRef ?? "").trim()),
    sourceRef: page?.ref ?? rawRef,
    sourceExcerpt: page ? sourceExcerpt(page.text) : "",
    sourceId: page?.sourceId,
    sourcePage: page?.page,
    issues,
    passageId,
  };
}

function stemKey(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function isNearDuplicate(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  let overlap = 0;
  a.forEach((w) => b.has(w) && overlap++);
  return overlap / (a.size + b.size - overlap) >= 0.8;
}

/**
 * Drops questions whose wording overlaps heavily with an earlier question of the same layout,
 * or with any question the exam already has.
 */
function dedupeQuestions(
  questions: GeneratedQuestion[],
  existing: string[]
): { kept: GeneratedQuestion[]; removed: number; matchedExisting: number } {
  const existingKeys = existing.map((t) => new Set(stemKey(t)));
  const kept: GeneratedQuestion[] = [];
  const keys: { layout: QuestionLayout; words: Set<string> }[] = [];
  let matchedExisting = 0;
  for (const q of questions) {
    const words = new Set(stemKey(q.questionText));
    if (existingKeys.some((k) => isNearDuplicate(words, k))) {
      matchedExisting++;
      continue;
    }
    if (keys.some((k) => k.layout === q.layout && isNearDuplicate(words, k.words))) continue;
    kept.push(q);
    keys.push({ layout: q.layout, words });
  }
  return { kept, removed: questions.length - kept.length - matchedExisting, matchedExisting };
}

export interface GenerateOptions {
  /** Question texts already in the exam; the AI is told to avoid them and near-copies are dropped */
  existingQuestions?: string[];
}

export async function generateExam(
  sources: ExtractedSource[],
  analysis: MaterialAnalysis,
  bp: ExamBlueprint,
  onProgress?: ProgressCallback,
  options: GenerateOptions = {}
): Promise<GenerationResult> {
  const existing = options.existingQuestions ?? [];
  const corpus = buildCorpus(sources);
  const grounded = corpus.length > 0;
  if (!grounded && analysis.topics.length === 0) throw new Error("Add material or describe the exam first.");
  const pagesByRef = new Map(corpus.map((p) => [p.ref, p]));
  const batches = planBatches(bp);
  if (batches.length === 0) throw new Error("Set at least one question to generate.");

  const referenceFor = (topics: string[]): Reference =>
    grounded
      ? { kind: "material", text: selectMaterial(corpus, topics, analysis) }
      : { kind: "topics", text: topicGuide(analysis, topics.length > 0 ? topics : bp.topics) };

  const batchOptions = { temperature: 0.5, maxOutputTokens: 32768 };
  onProgress?.(0, batches.length, "Writing questions…");

  const results = await runWithConcurrency(
    batches.map((batch) => async () => {
      if (batch.kind === "questions") {
        const prompt = questionBatchPrompt(bp, analysis, batch, referenceFor(batch.topics), existing);
        const text = await generateJson(questionBatchSchema, prompt, batchOptions);
        const parsed = JSON.parse(text) as { questions: RawQuestion[] };
        return {
          questions: (parsed.questions ?? [])
            .slice(0, batch.count)
            .map((q) => normalizeQuestion(q, batch.layout, pagesByRef))
            .filter((q): q is GeneratedQuestion => q !== null),
          passages: [] as GeneratedPassage[],
        };
      }
      const reference: Reference = grounded
        ? { kind: "material", text: formatCorpus(corpus).text }
        : { kind: "topics", text: topicGuide(analysis, bp.topics) };
      const text = await generateJson(passageBatchSchema, passageBatchPrompt(bp, analysis, batch, reference), batchOptions);
      const parsed = JSON.parse(text) as {
        passages: { title: string; body: string; sourceRef: string; questions: RawQuestion[] }[];
      };
      const passages: GeneratedPassage[] = [];
      const questions: GeneratedQuestion[] = [];
      for (const p of (parsed.passages ?? []).slice(0, batch.passageCount)) {
        if (!p.body?.trim()) continue;
        const passage = {
          id: genQuestionId(),
          title: cleanText(p.title),
          body: cleanText(p.body),
          sourceRef: grounded ? (p.sourceRef ?? "").trim() : "",
        };
        passages.push(passage);
        (p.questions ?? [])
          .slice(0, batch.questionsPerPassage)
          .map((q) => normalizeQuestion(q, "multiple_choice", pagesByRef, passage.id))
          .forEach((q) => q && questions.push(q));
      }
      return { questions, passages };
    }),
    CONCURRENCY,
    (done) => onProgress?.(done, batches.length, "Writing questions…")
  );

  const warnings: string[] = grounded
    ? []
    : ["These questions come from the AI's general knowledge, not uploaded material. Check facts and answer keys before publishing."];
  const allQuestions: GeneratedQuestion[] = [];
  const passages: GeneratedPassage[] = [];
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failures.length === results.length) throw failures[0].reason;
  if (failures.length > 0) warnings.push(`${failures.length} of ${batches.length} generation batch(es) failed; you may want to generate again.`);
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    allQuestions.push(...r.value.questions);
    passages.push(...r.value.passages);
  }

  const { kept, removed, matchedExisting } = dedupeQuestions(allQuestions, existing);
  if (removed > 0) warnings.push(`${removed} near-duplicate question(s) were removed.`);
  if (matchedExisting > 0) warnings.push(`${matchedExisting} question(s) repeated ones already in the exam and were removed.`);

  const requested = totalQuestions(bp);
  if (kept.length < requested) warnings.push(`Generated ${kept.length} of ${requested} requested questions.`);

  const flagged = kept.filter((q) => q.issues.length > 0).length;
  if (flagged > 0) warnings.push(`${flagged} question(s) need a closer look before publishing.`);

  return { questions: kept, passages, warnings };
}

// ============ 4. Editor sections ============

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/** Finds an existing question type bound to (or resolving to) the given layout. */
export function findQuestionTypeId(
  layout: QuestionLayout,
  types: { id: string; name: string; layout?: string | null }[]
): string | null {
  const matches = types.filter((t) => resolveQuestionLayout(t) === layout);
  if (layout === "multiple_choice") {
    const explicit = matches.find((t) => t.layout === "multiple_choice" || /choice/i.test(t.name));
    if (explicit) return explicit.id;
  }
  return matches[0]?.id ?? null;
}

export function missingLayouts(
  layouts: QuestionLayout[],
  types: { id: string; name: string; layout?: string | null }[]
): QuestionLayout[] {
  return [...new Set(layouts)].filter((l) => !findQuestionTypeId(l, types));
}

function toPayload(q: GeneratedQuestion, typeId: string, points: number): CreateExamQuestionPayload {
  const correctAnswer =
    q.layout === "identification"
      ? q.acceptedAnswers
      : q.layout === "essay"
        ? []
        : q.correctIndexes.map(String);
  const ai: AiQuestionMetadata = {
    generated: true,
    difficulty: q.difficulty,
    cognitiveLevel: q.cognitiveLevel,
    ...(q.topic && { topic: q.topic }),
    ...(q.sourceRef && { sourceRef: q.sourceRef }),
    ...(q.sourceExcerpt && { sourceExcerpt: q.sourceExcerpt }),
    ...(q.sourceUrl && { sourceUrl: q.sourceUrl }),
    ...(q.rubric && { rubric: q.rubric }),
  };
  return {
    questionTypeId: typeId,
    questionText: q.questionText,
    options: q.options,
    correctAnswer,
    points,
    numberOfChoices: q.options.length || undefined,
    explanation: q.explanation,
    metadata: { ai },
    examId: "",
  };
}

export interface AppliedExam {
  sections: QuestionSection[];
  timeLimit: number;
  timeType: "per_exam" | "per_part";
  /** Exam-level items per session when the pool isn't split into parts; null = all */
  numberOfItems: number | null;
}

export interface SectionOptions {
  /** Parts the exam already has, so new part numbering continues after them */
  existingPartCount?: number;
  /** Put every question (and passage) into this existing part instead of creating parts */
  targetPart?: ExamPart;
}

/** Items a session draws from a pool of `available`; null means "all of them". */
function drawCount(wanted: number, available: number): number | null {
  return wanted > 0 && wanted < available ? wanted : null;
}

export function generatedToSections(
  result: GenerationResult,
  bp: ExamBlueprint,
  types: { id: string; name: string }[],
  options: SectionOptions = {}
): AppliedExam {
  const typeIds = new Map(QUESTION_LAYOUTS.map((l) => [l, findQuestionTypeId(l, types)]));
  const payload = (q: GeneratedQuestion) => {
    const typeId = typeIds.get(q.layout);
    return typeId ? toPayload(q, typeId, bp.pointsPerLayout[q.layout]) : null;
  };
  const standaloneByLayout = QUESTION_LAYOUTS.map((layout) => ({
    layout,
    questions: result.questions
      .filter((q) => !q.passageId && q.layout === layout)
      .map(payload)
      .filter((p): p is CreateExamQuestionPayload => p !== null),
  })).filter((g) => g.questions.length > 0);
  const passageGroups = result.passages
    .map((passage) => ({
      passage,
      questions: result.questions
        .filter((q) => q.passageId === passage.id)
        .map(payload)
        .filter((p): p is CreateExamQuestionPayload => p !== null),
    }))
    .filter((g) => g.questions.length > 0);

  const toPhrase = (g: (typeof passageGroups)[number]) => ({
    phrase: { title: g.passage.title, body: g.passage.body, usageType: "passage" },
    imageFiles: [] as File[],
    questions: g.questions,
  });
  const passageQuestionCount = passageGroups.reduce((s, g) => s + g.questions.length, 0);
  const generatedCount = standaloneByLayout.reduce((s, g) => s + g.questions.length, 0) + passageQuestionCount;

  if (options.targetPart) {
    const sections: QuestionSection[] = [
      {
        id: genSectionId(),
        type: "part",
        part: options.targetPart,
        questions: standaloneByLayout.flatMap((g) => g.questions),
        phrases: passageGroups.map((g) => ({ id: genPartPhraseId(), ...toPhrase(g) })),
      },
    ];
    return {
      sections,
      timeLimit: effectiveTimeLimit(bp),
      timeType: bp.timeType,
      numberOfItems: drawCount(itemsPerSession(bp), generatedCount),
    };
  }

  const perPart = bp.splitIntoParts && bp.timeType === "per_part";

  if (!bp.splitIntoParts) {
    const sections: QuestionSection[] = [
      ...passageGroups.map((g) => ({ id: genSectionId(), type: "phrase" as const, ...toPhrase(g) })),
      ...standaloneByLayout.flatMap((g) =>
        g.questions.map((question) => ({ id: genSectionId(), type: "standalone" as const, question }))
      ),
    ];
    return {
      sections,
      timeLimit: effectiveTimeLimit(bp),
      timeType: "per_exam",
      numberOfItems: bp.usePool ? drawCount(itemsPerSession(bp), generatedCount) : null,
    };
  }

  const sections: QuestionSection[] = [];
  let partIndex = options.existingPartCount ?? 0;
  const partName = (label: string) => `Part ${ROMAN[partIndex++] ?? partIndex}: ${label}`;

  for (const group of standaloneByLayout) {
    const drawn = bp.usePool ? drawCount(sessionLayoutCount(bp, group.layout), group.questions.length) : null;
    const part: ExamPart = {
      id: genPartId(),
      name: partName(LAYOUT_LABELS[group.layout]),
      description: LAYOUT_DESCRIPTIONS[group.layout],
      numberOfItems: drawn,
      timeLimit: perPart ? roundMinutes(estimateLayoutMinutes(group.layout, drawn ?? group.questions.length)) : null,
      passingCondition: null,
    };
    sections.push({ id: genSectionId(), type: "part", part, questions: group.questions, phrases: [] });
  }

  if (passageGroups.length > 0) {
    const drawn = bp.usePool ? drawCount(sessionPassageCount(bp), passageQuestionCount) : null;
    const shown = drawn ?? passageQuestionCount;
    const part: ExamPart = {
      id: genPartId(),
      name: partName("Reading Comprehension"),
      description: "Read each passage carefully, then answer the questions that follow it.",
      numberOfItems: drawn,
      timeLimit: perPart ? roundMinutes(estimatePassageMinutes(Math.min(passageGroups.length, shown), shown)) : null,
      passingCondition: null,
    };
    sections.push({
      id: genSectionId(),
      type: "part",
      part,
      questions: [],
      phrases: passageGroups.map((g) => ({ id: genPartPhraseId(), ...toPhrase(g) })),
    });
  }

  const timeLimit = perPart
    ? sections.reduce((s, sec) => s + (sec.type === "part" ? sec.part.timeLimit ?? 0 : 0), 0)
    : effectiveTimeLimit(bp);
  return { sections, timeLimit, timeType: perPart ? "per_part" : "per_exam", numberOfItems: null };
}
