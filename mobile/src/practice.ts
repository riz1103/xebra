import { Schema, type Part } from "firebase/ai";
import { describeAiError, generateJson } from "./ai";
import { mathAnswersMatch } from "./math-notation";
import type { NoteSource } from "./notes";

export type PracticeQuestionType = "multiple_choice" | "true_false" | "identification";

export interface PracticeQuestion {
  type: PracticeQuestionType;
  question: string;
  options: string[];
  answer: string;
  acceptedAnswers?: string[];
  explanation: string;
  topic: string;
}

export interface PracticeQuizRequest {
  topics: string[];
  sources?: NoteSource[];
  count: number;
  difficulty: "mixed" | "easy" | "medium" | "hard";
  language?: string;
}

const MATH_NOTATION = `Never use LaTeX or Markdown math: no $...$, \\(...\\), \\frac, \\times, \\div, \\sqrt, or braces. Write math in this plain-text notation, which the app displays like a printed exam:
  - Multiplication: × (e.g. 3 × 4). Division: ÷ (e.g. 12 ÷ 4). Never use * for multiplication.
  - Fractions: a/b with no spaces around the slash; it is displayed stacked. Whenever the top or bottom has more than one number or letter, wrap it in parentheses: (2x^3y)/(3x^2), (x+1)/2, 5/(2x). Letters written right after the denominator belong to it (3x/10x^2 is 3x over 10x²), so write a fraction times a variable as (1/2)x. Mixed numbers: 1 1/2.
  - Never write a spaced slash or chain slashes and ÷ ambiguously. Dividing fractions: (2x^3y)/(3x^2) ÷ (5y^2)/(18xy), not 2x^3y/3x^2 ÷ 5y^2 / 18xy.
  - Exponents: ^ (x^2, 10^-3, 2^(n+1)); group longer exponents in parentheses. Scientific notation: 3.0 × 10^8.
  - Subscripts: Unicode subscript digits for chemical formulas and ions (H₂O, CO₂, SO₄²⁻, Ca²⁺) and indexed variables (x₁, a₂); x_n for letter subscripts.
  - Roots: sqrt(16), sqrt(x+1), cbrt(27).
  - Symbols: ≤ ≥ ≠ ≈ ± ∞ π ° ∠ △ ⊥ ∥ ≅ ∈ ∪ ∩ ∅ ∑ ∫ Δ, Greek letters (α β θ λ μ Ω), units with ℃ or °C, arrows → for reactions and implications, ⇌ for reversible reactions.
  - Units: rates inline as m/s, km/h, m/s^2.
  - Subtraction: 7 - 3 with spaces around the minus; negative numbers as -5.`;

const practiceSchema = Schema.object({
  properties: {
    questions: Schema.array({
      items: Schema.object({
        properties: {
          type: Schema.enumString({ enum: ["multiple_choice", "true_false", "identification"] }),
          question: Schema.string(),
          options: Schema.array({ items: Schema.string() }),
          answer: Schema.string(),
          acceptedAnswers: Schema.array({ items: Schema.string() }),
          explanation: Schema.string(),
          topic: Schema.string(),
        },
      }),
    }),
  },
});

const MAX_NOTES_CHARS = 40_000;
const MAX_NOTE_IMAGES = 8;

function notesParts(sources: NoteSource[]): { text: string; files: Part[] } {
  let text = "";
  const files: Part[] = [];
  for (const source of sources) {
    for (const page of source.pages) {
      if (page.text && text.length < MAX_NOTES_CHARS) text += `\n[${source.name} — ${page.label}]\n${page.text}\n`;
      for (const img of [...(page.images ?? []), ...(page.file ? [page.file] : [])]) {
        if (files.length < MAX_NOTE_IMAGES) files.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }
    }
  }
  return { text: text.slice(0, MAX_NOTES_CHARS), files };
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function phraseContains(longer: string, shorter: string): boolean {
  if (!shorter || shorter.length < 2) return false;
  return ` ${longer} `.includes(` ${shorter} `);
}

export function practiceAnswerIsCorrect(question: PracticeQuestion, answer: string): boolean {
  const given = normalize(answer);
  if (!given) return false;
  const keys = [question.answer, ...(question.acceptedAnswers ?? [])].map(normalize).filter(Boolean);
  if (keys.some((key) => key === given)) return true;
  const rawKeys = [question.answer, ...(question.acceptedAnswers ?? [])];
  if (rawKeys.some((key) => mathAnswersMatch(answer, key))) return true;
  if (question.type !== "identification") return false;
  return keys.some((key) => {
    const [a, b] = given.length >= key.length ? [given, key] : [key, given];
    return b.length >= 3 && phraseContains(a, b);
  });
}

export async function generatePracticeQuiz(req: PracticeQuizRequest): Promise<PracticeQuestion[]> {
  const notes = req.sources?.length ? notesParts(req.sources) : null;
  const difficulty = req.difficulty === "mixed" ? "a mix of easy, medium and hard" : req.difficulty;
  const focus = req.topics.length ? `Focus on these topics: ${req.topics.join("; ")}.` : "";
  const prompt = `Write a practice quiz of exactly ${req.count} questions for a student to study with. Difficulty: ${difficulty}.
${focus}
${notes ? "Base every question on the student's notes provided below (text, photos, or attached files); don't test facts that aren't in them." : "Use well-established knowledge appropriate for a student studying these topics."}

Rules:
- Mostly multiple_choice (4 plausible options, one correct), with a few true_false and identification (short answers of 1-4 words).
- answer must be copied exactly from options for multiple_choice and true_false; leave acceptedAnswers empty for those.
- For identification, put the preferred short answer in answer, and list every reasonable phrasing in acceptedAnswers (including the preferred one). Example: answer "Grouping", acceptedAnswers ["Grouping", "Grouping symbols", "Groupings"].
- Every question tests understanding, not trivia; no "all of the above".
- ${req.language ? `Write every question, option, answer, and explanation in ${req.language}.` : "Write in the language of the notes or topics."}
- topic is the specific topic the question covers.
${MATH_NOTATION}
Math notation applies to question, options, answer, and explanation.${notes?.text ? `\n\nStudent's notes:\n"""${notes.text}"""` : ""}`;

  const request: string | Part[] = notes?.files.length ? [{ text: prompt }, ...notes.files] : prompt;
  try {
    const text = await generateJson(practiceSchema, request, { temperature: 0.6, maxOutputTokens: 8192 });
    const parsed = JSON.parse(text) as { questions?: Partial<PracticeQuestion>[] };
    return (parsed.questions ?? [])
      .map((q): PracticeQuestion | null => {
        const type = q.type === "true_false" || q.type === "identification" ? q.type : "multiple_choice";
        const question = (q.question ?? "").trim();
        const answer = (q.answer ?? "").trim();
        let options = type === "identification" ? [] : (q.options ?? []).map((o) => String(o).trim()).filter(Boolean);
        if (type === "true_false") options = ["True", "False"];
        if (!question || !answer) return null;
        if (type !== "identification" && !options.some((o) => normalize(o) === normalize(answer))) return null;
        const acceptedAnswers =
          type === "identification"
            ? [...new Set([answer, ...((q.acceptedAnswers ?? []) as string[]).map((a) => String(a).trim()).filter(Boolean)])]
            : undefined;
        return { type, question, options, answer, acceptedAnswers, explanation: (q.explanation ?? "").trim(), topic: (q.topic ?? "").trim() };
      })
      .filter((q): q is PracticeQuestion => q !== null)
      .slice(0, req.count);
  } catch (err) {
    if (err instanceof SyntaxError) throw new Error("The AI response could not be read. Try again.");
    throw new Error(describeAiError(err));
  }
}
