import type { CreateExamQuestionPayload } from "@/types";
import { hasBlanks } from "@/lib/question-blanks";
import { extractPdfText } from "@/lib/source-extract";

export interface ParsedQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  points: number;
  /** Question number from the document (1-based) for passage grouping */
  questionNumber?: number;
  /** Index into ParseResult.sections when question falls in a section range */
  sectionIndex?: number;
}

/** Section header from the document (e.g. "True or False (11-20)", "Grammar and Vocabulary (21-40)") */
export interface ParsedSection {
  name: string;
  /** Question numbers that belong to this section (by range) */
  questionNumbers: number[];
  /** Hint to set question type from section title (e.g. "true_false") */
  typeHint?: "true_false" | "multiple_choice" | "identification";
}

/** A reading passage (e.g. "Read the story below...") that applies to a range of questions */
export interface ParsedPassage {
  /** Optional title, e.g. "Read the story below and answer Questions 1-10" */
  title?: string;
  /** Passage body text to show above the questions */
  body: string;
  /** Question numbers this passage applies to (e.g. [1,2,...,10]) */
  questionNumbers: number[];
}

export interface ParseResult {
  questions: ParsedQuestion[];
  rawText: string;
  warnings: string[];
  /** Sections detected from headers; used to create exam parts and assign question types */
  sections: ParsedSection[];
  /** Reading passages that precede a group of questions */
  passages?: ParsedPassage[];
}

// ============ Text Extraction ============

async function extractTextFromWord(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// ============ Section Headers (Part Exams) ============

/**
 * Detects section headers that define "part exams" (e.g. "True or False (11-20)", "Grammar and Vocabulary (21-40)").
 * Returns sections with name, optional range, and typeHint derived from the title (e.g. "true or false" → true_false).
 */
function extractSectionHeaders(text: string): { name: string; range: [number, number]; typeHint?: ParsedSection["typeHint"] }[] {
  const sections: { name: string; range: [number, number]; typeHint?: ParsedSection["typeHint"] }[] = [];
  const lines = text.split("\n");

  // Match: "Title (11-20)" or "Title (11 - 20)" with optional dash variants
  const headerWithRange = /^\s*(.+?)\s*\(\s*(\d+)\s*[-–]\s*(\d+)\s*\)\s*$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(headerWithRange);
    if (match) {
      const name = match[1].trim();
      const start = parseInt(match[2], 10);
      const end = parseInt(match[3], 10);
      if (start <= end && name.length > 0 && name.length < 200) {
        const lower = name.toLowerCase();
        let typeHint: ParsedSection["typeHint"] | undefined;
        if (lower.includes("true") && lower.includes("false")) {
          typeHint = "true_false";
        } else if (lower.includes("multiple") && lower.includes("choice")) {
          typeHint = "multiple_choice";
        } else if (
          lower.includes("fill in the blank") ||
          lower.includes("identification") ||
          lower.includes("short answer")
        ) {
          typeHint = "identification";
        }
        sections.push({ name, range: [start, end], typeHint });
      }
    }
  }

  return sections;
}

// ============ Answer Key Parsing ============

/**
 * Extracts an answer key section from the text if present.
 * Supports: "ANSWER KEY", "Answer Key", "ANSWERS", etc.
 * Returns a map of question number -> answer letter, and the text without the answer key.
 */
function extractAnswerKey(
  text: string
): { answerMap: Map<number, string>; textWithoutKey: string } {
  const answerMap = new Map<number, string>();

  // Find the answer key section
  const keyPatterns = [
    /\n\s*ANSWER\s*KEY\s*\n/i,
    /\n\s*ANSWERS?\s*[:]\s*\n/i,
    /\n\s*KEY\s*[:]\s*\n/i,
    /\n\s*ANSWER\s*SHEET\s*\n/i,
  ];

  let keyStartIndex = -1;
  for (const pattern of keyPatterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      keyStartIndex = match.index;
      break;
    }
  }

  if (keyStartIndex === -1) {
    return { answerMap, textWithoutKey: text };
  }

  const textWithoutKey = text.substring(0, keyStartIndex).trim();
  const keySection = text.substring(keyStartIndex);

  // Parse answer key entries: "1. A", "1) A", "11. TRUE", "12. FALSE", etc.
  // Match TRUE/FALSE first (whole words), then single letters A–J for multiple choice
  const trueFalsePattern = /(\d{1,3})\s*[.):\-–]\s*(TRUE|FALSE)\b/gi;
  let match;
  while ((match = trueFalsePattern.exec(keySection)) !== null) {
    const num = parseInt(match[1], 10);
    const value = match[2].toLowerCase() === "true" ? "True" : "False";
    answerMap.set(num, value);
  }
  const letterPattern = /(\d{1,3})\s*[.):\-–]\s*([A-Za-z])\b/g;
  while ((match = letterPattern.exec(keySection)) !== null) {
    const num = parseInt(match[1], 10);
    if (!answerMap.has(num)) {
      answerMap.set(num, match[2].toUpperCase());
    }
  }

  return { answerMap, textWithoutKey };
}

// ============ Question Parsing ============

/**
 * Normalizes raw text by cleaning up whitespace issues
 */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ");
}

/** Pattern for "Read the passage/story and answer Questions 41-50" (mid-doc passage heading) */
const PASSAGE_HEADING_PATTERN =
  /^Read\s+(?:the\s+)?(?:story|passage|text)\s+.*?(?:answer\s+)?(?:questions?\s*)?(\d{1,3})\s*[-–]\s*(\d{1,3})/i;

/**
 * Splits text into blocks, each starting with a question number.
 * Returns blocks, preamble, and any mid-document passages (e.g. "Read the passage and answer Questions 41-50").
 * When a passage heading is seen, the current question block is closed so the passage is not merged into the previous question's options.
 */
function splitIntoQuestionBlocks(
  text: string
): {
  blocks: { questionNumber: number; block: string }[];
  preamble: string;
  midDocPassages: ParsedPassage[];
} {
  const lines = text.split("\n");
  const blocks: { questionNumber: number; block: string }[] = [];
  const midDocPassages: ParsedPassage[] = [];
  let currentBlock: string[] = [];
  let currentNumber = 0;
  let preambleLines: string[] = [];
  let seenFirstQuestion = false;

  const questionStartPattern =
    /^(?:(\d{1,3})[.)]\s|Q(\d{1,3})[.)]\s|Question\s+(\d{1,3})[.:]\s|#(\d{1,3})[.):\s]|(\d{1,3})\s*[-–]\s)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBlock.length > 0) currentBlock.push("");
      else if (!seenFirstQuestion) preambleLines.push("");
      continue;
    }

    const qMatch = trimmed.match(questionStartPattern);
    const passageMatch = trimmed.match(PASSAGE_HEADING_PATTERN);

    if (passageMatch && seenFirstQuestion && currentBlock.length > 0 && currentNumber > 0) {
      // End current block (e.g. Q40) so passage text is not merged into its options
      blocks.push({
        questionNumber: currentNumber,
        block: currentBlock.join("\n").trim(),
      });
      currentBlock = [];
      currentNumber = 0;
      const rangeStart = parseInt(passageMatch[1], 10);
      const rangeEnd = parseInt(passageMatch[2], 10);
      const passageBodyLines: string[] = [];
      const title = trimmed;
      i++;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (!t) {
          passageBodyLines.push("");
          i++;
          continue;
        }
        const nextQ = t.match(questionStartPattern);
        if (nextQ) {
          midDocPassages.push({
            title,
            body: passageBodyLines.join("\n").trim(),
            questionNumbers: Array.from({ length: rangeEnd - rangeStart + 1 }, (_, j) => rangeStart + j),
          });
          currentNumber = parseInt(nextQ[1] || nextQ[2] || nextQ[3] || nextQ[4] || nextQ[5]);
          currentBlock = [t];
          i--; // so next for-iteration re-processes this question line
          break;
        }
        passageBodyLines.push(t);
        i++;
      }
      if (currentBlock.length === 0 && passageBodyLines.length > 0) {
        midDocPassages.push({
          title,
          body: passageBodyLines.join("\n").trim(),
          questionNumbers: Array.from({ length: rangeEnd - rangeStart + 1 }, (_, j) => rangeStart + j),
        });
      }
      continue;
    }

    if (qMatch) {
      if (!seenFirstQuestion) seenFirstQuestion = true;
      if (currentBlock.length > 0 && currentNumber > 0) {
        blocks.push({
          questionNumber: currentNumber,
          block: currentBlock.join("\n").trim(),
        });
      }
      currentNumber = parseInt(
        qMatch[1] || qMatch[2] || qMatch[3] || qMatch[4] || qMatch[5]
      );
      currentBlock = [trimmed];
    } else {
      if (seenFirstQuestion) currentBlock.push(trimmed);
      else preambleLines.push(trimmed);
    }
  }

  if (currentBlock.length > 0 && currentNumber > 0) {
    blocks.push({
      questionNumber: currentNumber,
      block: currentBlock.join("\n").trim(),
    });
  }

  const preamble = preambleLines.join("\n").trim();
  return { blocks, preamble, midDocPassages };
}

/**
 * Extracts a reading passage from the preamble (text before the first question).
 * Looks for headings like "Read the story below and answer Questions 1-10" and the following paragraph(s).
 */
function extractPassageFromPreamble(
  preamble: string,
  firstQuestionNumber: number
): ParsedPassage | null {
  if (!preamble || preamble.length < 50) return null;

  const lines = preamble.split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length === 0) return null;

  const rangePattern =
    /(?:answer\s+)?(?:questions?\s*)?(\d{1,3})\s*[-–]\s*(\d{1,3})/i;
  const readStoryPattern =
    /read\s+(?:the\s+)?(?:story|passage|text)\s+(?:below|above)?/i;

  let title: string | undefined;
  let rangeStart = firstQuestionNumber;
  let rangeEnd = firstQuestionNumber;
  let passageStartIndex = -1; // index in lines where passage body starts (after heading)

  for (let i = 0; i < nonEmpty.length; i++) {
    const line = nonEmpty[i];
    const rangeMatch = line.match(rangePattern);
    const hasReadStory = readStoryPattern.test(line);
    if (rangeMatch) {
      rangeStart = parseInt(rangeMatch[1], 10);
      rangeEnd = parseInt(rangeMatch[2], 10);
      if (hasReadStory) {
        title = line;
        passageStartIndex = i + 1;
      }
      break;
    }
    if (hasReadStory) {
      title = line;
      passageStartIndex = i + 1;
      break;
    }
  }

  const bodyLines =
    passageStartIndex >= 0 && passageStartIndex < nonEmpty.length
      ? nonEmpty.slice(passageStartIndex)
      : nonEmpty;
  const body = bodyLines.join("\n").trim();
  if (!body || body.length < 20) return null;

  const questionNumbers = Array.from(
    { length: rangeEnd - rangeStart + 1 },
    (_, i) => rangeStart + i
  );
  return { title, body, questionNumbers };
}

/**
 * Removes the question number prefix from a block.
 */
function stripQuestionPrefix(block: string): string {
  return block
    .replace(
      /^(?:\d{1,3}[.)]\s*|Q\d{1,3}[.)]\s*|Question\s+\d{1,3}[.:]\s*|#\d{1,3}[.):\s]*|\d{1,3}\s*[-–]\s*)/i,
      ""
    )
    .trim();
}

/**
 * Extracts options from text. Handles two formats:
 *
 * FORMAT 1 - Separate lines:
 *   A. Option one
 *   B. Option two
 *
 * FORMAT 2 - Inline (all on same line):
 *   What is 2+2?A. 4B. 5C. 6D. 3
 *   or: What is 2+2? A. 4 B. 5 C. 6 D. 3
 */
function extractOptionsFromText(text: string): {
  questionText: string;
  options: { letter: string; text: string }[];
  correctIndex: number;
} {
  // Try to split options that may be inline or on separate lines.
  // We look for patterns like "A." "B." "C." "D." (up to J for flexibility)
  // The key insight: options follow a letter pattern and we need to capture
  // both the letter and the text that follows until the next option letter.

  // First, join all text into a single string for inline parsing
  let fullText = text.replace(/\n/g, " ").trim();

  // Normalize so option markers are detected when they run right after a word
  // (e.g. "bookB." or "wetC." from Word export). Insert space before A.–J. when
  // preceded by an alphanumeric so the negative lookbehind can see a non-letter.
  fullText = fullText
    .replace(/([a-zA-Z0-9])([A-Ja-j])[.)]\s*/g, "$1 $2. ")
    .replace(/ {2,}/g, " ");

  // Find all option positions using a pattern that matches letter markers.
  // Uses a negative lookbehind to ensure the letter is NOT preceded by
  // another letter (avoids matching mid-word), but allows digits, punctuation,
  // spaces, etc. before it. This handles inline formats like "19B. 18A. 17"
  const optionMarkerPattern =
    /(?<![A-Za-z])([A-Ja-j])[.)]\s*/g;

  const markers: { letter: string; index: number; matchLength: number }[] = [];
  let markerMatch;

  while ((markerMatch = optionMarkerPattern.exec(fullText)) !== null) {
    const letter = markerMatch[1].toUpperCase();
    markers.push({
      letter,
      index: markerMatch.index,
      matchLength: markerMatch[0].length,
    });
  }

  // Filter to only keep markers that form a reasonable sequence (e.g., A, B, C, D)
  const validMarkers = filterValidOptionSequence(markers);

  if (validMarkers.length < 2) {
    return { questionText: text.trim(), options: [], correctIndex: -1 };
  }

  // Extract question text (everything before the first option marker)
  const questionText = fullText.substring(0, validMarkers[0].index).trim();

  // Extract each option text
  const options: { letter: string; text: string }[] = [];
  let correctIndex = -1;

  for (let i = 0; i < validMarkers.length; i++) {
    const start = validMarkers[i].index + validMarkers[i].matchLength;
    const end =
      i + 1 < validMarkers.length ? validMarkers[i + 1].index : fullText.length;
    let optionText = fullText.substring(start, end).trim();

    // Check for correct answer markers
    const correctMarkers =
      /[\s]*(?:\*{1,2}|✓|✔|←|<-|<<|\(correct\)|\[correct\]|\(answer\)|\[answer\])[\s]*/gi;
    if (correctMarkers.test(optionText) || optionText.includes("*")) {
      correctIndex = i;
      optionText = optionText.replace(correctMarkers, "").trim();
      optionText = optionText.replace(/^\*+|\*+$/g, "").trim();
    }

    options.push({ letter: validMarkers[i].letter, text: optionText });
  }

  return { questionText, options, correctIndex };
}

/**
 * Filters marker positions to find a valid set of options.
 * Options may appear in any order (e.g., D, B, A, C) — this is common
 * in scrambled exam formats. We look for a complete set of consecutive
 * letters (like {A,B,C,D}) appearing anywhere in the markers list.
 */
function filterValidOptionSequence(
  markers: { letter: string; index: number; matchLength: number }[]
): { letter: string; index: number; matchLength: number }[] {
  if (markers.length < 2) return [];

  // Strategy: Find the largest complete set of consecutive letters
  // (A-B, A-B-C, A-B-C-D, etc.) present in any order among the markers.
  // When multiple sets exist, prefer the one that starts latest in the text
  // (to skip any letter matches in the question text itself).

  // Collect all unique letters and their last occurrence
  const letterMap = new Map<
    string,
    { letter: string; index: number; matchLength: number }
  >();

  // Use the LAST occurrence of each letter (most likely the option, not question text)
  for (const marker of markers) {
    letterMap.set(marker.letter, marker);
  }

  // Find the longest consecutive letter set starting from A
  let bestSet: { letter: string; index: number; matchLength: number }[] = [];

  for (let startLetter = 0; startLetter <= 9; startLetter++) {
    // A=0, B=1, ... J=9
    const set: typeof bestSet = [];
    for (
      let l = startLetter;
      l <= 9; // up to J
      l++
    ) {
      const letter = String.fromCharCode(65 + l);
      const marker = letterMap.get(letter);
      if (marker) {
        set.push(marker);
      } else {
        break; // Gap in sequence, stop
      }
    }
    if (set.length > bestSet.length) {
      bestSet = set;
    }
  }

  // If we found a valid set with 2+ options, return sorted by text position
  if (bestSet.length >= 2) {
    return bestSet.sort((a, b) => a.index - b.index);
  }

  return [];
}

/**
 * Resolves the correct answer for a question using:
 * 1. Inline markers (*, ✓, etc.)
 * 2. Answer key (if available)
 * 3. Answer line in the text block
 */
function resolveCorrectAnswer(
  options: { letter: string; text: string }[],
  correctIndex: number,
  questionNumber: number,
  answerMap: Map<number, string>,
  blockText: string
): string {
  // 1. Inline marker
  if (correctIndex >= 0 && correctIndex < options.length) {
    return options[correctIndex].text;
  }

  // 2. Answer key
  const keyValue = answerMap.get(questionNumber);
  if (keyValue) {
    const byLetter = options.find((o) => o.letter === keyValue.toUpperCase());
    if (byLetter) return byLetter.text;
    const byText = options.find(
      (o) => o.text.trim().toLowerCase() === keyValue.trim().toLowerCase()
    );
    if (byText) return byText.text;
  }

  // 3. Answer line in the block text
  const answerPatterns = [
    /(?:correct\s+)?answer\s*[:=]\s*\(?([A-Ja-j])\)?\s*[.)]?\s*/i,
    /\bans\s*[:=]\s*\(?([A-Ja-j])\)?\b/i,
    /\bkey\s*[:=]\s*\(?([A-Ja-j])\)?\b/i,
  ];

  for (const pattern of answerPatterns) {
    const match = blockText.match(pattern);
    if (match) {
      const letter = match[1].toUpperCase();
      const matched = options.find((o) => o.letter === letter);
      if (matched) return matched.text;
    }
  }

  // 4. Try matching full text answer
  const fullAnswerPattern = /(?:correct\s+)?answer\s*[:=]\s*(.+)/i;
  const fullMatch = blockText.match(fullAnswerPattern);
  if (fullMatch) {
    const answerText = fullMatch[1].trim();
    const idx = options.findIndex(
      (o) => o.text.toLowerCase() === answerText.toLowerCase()
    );
    if (idx >= 0) return options[idx].text;
  }

  return "";
}

/**
 * Resolves correct answer for fill-in-the-blank (free text) when there are no options.
 * Looks for "Answer: X", "Correct answer: X", or answer key line with text.
 */
function resolveFillInCorrectAnswer(
  questionNumber: number,
  answerMap: Map<number, string>,
  blockText: string
): string {
  const patterns = [
    /(?:correct\s+)?answer\s*[:=]\s*(.+?)(?:\n|$)/i,
    /\bans(?:wer)?\s*[:=]\s*(.+?)(?:\n|$)/i,
    /\bkey\s*[:=]\s*(.+?)(?:\n|$)/i,
  ];
  for (const pattern of patterns) {
    const match = blockText.match(pattern);
    if (match) {
      const text = match[1].trim();
      if (text.length > 0 && text.length < 500) return text;
    }
  }
  const keyLetter = answerMap.get(questionNumber);
  if (keyLetter) return keyLetter;
  return "";
}

// ============ Main Parse Function ============

export async function parseExamFile(file: File): Promise<ParseResult> {
  const warnings: string[] = [];
  let rawText = "";

  // Extract text based on file type
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".pdf")) {
    rawText = await extractPdfText(file);
  } else if (fileName.endsWith(".docx")) {
    rawText = await extractTextFromWord(file);
  } else if (fileName.endsWith(".doc")) {
    throw new Error(
      "Legacy Word (.doc) files aren't supported. Open the file in Word and save it as .docx."
    );
  } else {
    throw new Error(
      "Unsupported file type. Please upload a PDF or Word document (.pdf, .docx)."
    );
  }

  if (!rawText.trim()) {
    throw new Error(
      "Could not extract any text from the file. It looks like a scanned document — use \"Generate with AI\" to read scanned pages and photos."
    );
  }

  // Normalize text
  const normalized = normalizeText(rawText);

  // Extract answer key (if present) before parsing questions
  const { answerMap, textWithoutKey } = extractAnswerKey(normalized);

  if (answerMap.size > 0) {
    // Answer key found - not a warning, just informational
  }

  // Detect section headers for part exams (e.g. "True or False (11-20)")
  const headerSections = extractSectionHeaders(textWithoutKey);

  // Split into question blocks, preamble, and any mid-document passages
  const { blocks, preamble, midDocPassages } = splitIntoQuestionBlocks(textWithoutKey);

  if (blocks.length === 0) {
    throw new Error(
      "Could not identify any questions in the file. Make sure questions are numbered (e.g., 1., 2., Q1, etc.)."
    );
  }

  // Build sections with question numbers: each section gets questions whose number is in its range
  const sections: ParsedSection[] = headerSections.map((h) => ({
    name: h.name,
    questionNumbers: blocks
      .filter((b) => b.questionNumber >= h.range[0] && b.questionNumber <= h.range[1])
      .map((b) => b.questionNumber),
    typeHint: h.typeHint,
  }));

  // Extract reading passage from preamble (e.g. "Read the story below and answer Questions 1-10")
  const passages: ParsedPassage[] = [];
  const firstQuestionNum = blocks[0]?.questionNumber ?? 1;
  const preamblePassage = extractPassageFromPreamble(preamble, firstQuestionNum);
  if (preamblePassage) passages.push(preamblePassage);
  passages.push(...midDocPassages);

  const questions: ParsedQuestion[] = [];
  let skippedCount = 0;

  for (const { questionNumber, block } of blocks) {
    const body = stripQuestionPrefix(block);
    if (!body) {
      skippedCount++;
      continue;
    }

    const { questionText, options, correctIndex } =
      extractOptionsFromText(body);

    if (!questionText) {
      skippedCount++;
      continue;
    }

    const trimmedQuestionText = questionText.trim();
    // Skip "ghost" questions where the stem is only blanks/whitespace (real stem was lost during parse)
    if (/^[\s_]+$/.test(trimmedQuestionText)) {
      skippedCount++;
      continue;
    }

    const isFillInTheBlank = hasBlanks(trimmedQuestionText);

    // Fill-in-the-blank free text: no options or single "option" (answer); question has _____
    if (options.length < 2 && isFillInTheBlank) {
      const correctAnswer =
        options.length === 1
          ? options[0].text
          : resolveFillInCorrectAnswer(questionNumber, answerMap, block);
      const sectionIndex = sections.findIndex((s) =>
        s.questionNumbers.includes(questionNumber)
      );
      questions.push({
        questionText: trimmedQuestionText,
        options: [], // free-text fill-in: render as text input(s), not dropdown
        correctAnswer,
        points: 1,
        questionNumber,
        ...(sectionIndex >= 0 && { sectionIndex }),
      });
      continue;
    }

    // Need at least 2 options for a valid MC/choice question
    if (options.length < 2) {
      skippedCount++;
      continue;
    }

    // Sort options alphabetically by letter (A, B, C, D)
    const sortedOptions = [...options].sort((a, b) =>
      a.letter.localeCompare(b.letter)
    );

    // Resolve correct answer
    let resolvedCorrectIndex = correctIndex;
    if (correctIndex >= 0) {
      const correctLetter = options[correctIndex].letter;
      resolvedCorrectIndex = sortedOptions.findIndex(
        (o) => o.letter === correctLetter
      );
    }

    const correctAnswer = resolveCorrectAnswer(
      sortedOptions,
      resolvedCorrectIndex,
      questionNumber,
      answerMap,
      block
    );

    const sectionIndex = sections.findIndex((s) =>
      s.questionNumbers.includes(questionNumber)
    );
    questions.push({
      questionText: trimmedQuestionText,
      options: sortedOptions.map((o) => o.text),
      correctAnswer,
      points: 1,
      questionNumber,
      ...(sectionIndex >= 0 && { sectionIndex }),
    });
  }

  if (skippedCount > 0) {
    warnings.push(
      `${skippedCount} block(s) were skipped because they could not be parsed as valid questions.`
    );
  }

  const noAnswerCount = questions.filter((q) => !q.correctAnswer).length;
  if (noAnswerCount > 0) {
    warnings.push(
      `${noAnswerCount} question(s) do not have a correct answer identified. Please set them manually.`
    );
  }

  if (questions.length === 0) {
    throw new Error(
      "No valid questions could be parsed from the file. Make sure each question has numbered text and lettered options (A, B, C, D)."
    );
  }

  return { questions, rawText, warnings, sections, passages: passages.length > 0 ? passages : undefined };
}

/**
 * Detects the best question type for a parsed question based on its content and optional section type hint.
 */
function detectQuestionType(
  question: ParsedQuestion,
  types: { id: string; name: string }[],
  sectionTypeHint?: ParsedSection["typeHint"]
): string {
  if (types.length === 0) return "";

  // Section header says "True or False" → use True/False type for questions in that section
  if (sectionTypeHint === "true_false") {
    const tf = types.find((t) => {
      const n = t.name.toLowerCase();
      return n.includes("true") && n.includes("false");
    });
    if (tf) return tf.id;
  }

  if (sectionTypeHint === "identification") {
    const fillIn = types.find((t) => {
      const n = t.name.toLowerCase();
      return (
        n.includes("fill in the blank") ||
        n.includes("identification") ||
        n.includes("fill") ||
        n.includes("blank") ||
        n.includes("short answer")
      );
    });
    if (fillIn) return fillIn.id;
  }

  if (sectionTypeHint === "multiple_choice") {
    const mc = types.find((t) => {
      const n = t.name.toLowerCase();
      return n.includes("multiple") && n.includes("choice");
    });
    if (mc) return mc.id;
  }

  // Prefer "Fill in the blanks" (or similar) type when question has blanks and no options
  if (question.options.length === 0 && hasBlanks(question.questionText)) {
    const fillIn = types.find((t) => {
      const n = t.name.toLowerCase();
      return (
        n.includes("fill in the blank") ||
        n.includes("identification") ||
        n.includes("fill") ||
        n.includes("blank") ||
        n.includes("short answer")
      );
    });
    if (fillIn) return fillIn.id;
  }

  const opts = question.options.map((o) => o.toLowerCase().trim());

  // True/False detection: exactly 2 options that are "true" and "false"
  const isTrueFalse =
    opts.length === 2 &&
    ((opts[0] === "true" && opts[1] === "false") ||
      (opts[0] === "false" && opts[1] === "true"));

  if (isTrueFalse) {
    const tf = types.find((t) => {
      const n = t.name.toLowerCase();
      return n.includes("true") && n.includes("false");
    });
    if (tf) return tf.id;
  }

  // Multiple choice detection: has options (most common case)
  if (question.options.length >= 2) {
    const mc = types.find((t) => {
      const n = t.name.toLowerCase();
      return n.includes("multiple") && n.includes("choice");
    });
    if (mc) return mc.id;
  }

  // Fallback: return the first type
  return types[0].id;
}

/**
 * Converts parsed questions to the CreateExamQuestionPayload format.
 * Automatically detects the best question type for each question; uses section type hint when present (e.g. "True or False" header).
 */
export function parsedToPayload(
  parsed: ParsedQuestion[],
  defaultQuestionTypeId: string,
  availableTypes?: { id: string; name: string }[],
  sections?: ParsedSection[]
): CreateExamQuestionPayload[] {
  return parsed.map((q) => {
    const sectionTypeHint =
      sections &&
      q.sectionIndex !== undefined &&
      q.sectionIndex >= 0 &&
      sections[q.sectionIndex]
        ? sections[q.sectionIndex].typeHint
        : undefined;
    return {
      questionTypeId:
        availableTypes && availableTypes.length > 0
          ? detectQuestionType(q, availableTypes, sectionTypeHint)
          : defaultQuestionTypeId,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      points: q.points,
      numberOfChoices: q.options.length,
      examId: "", // Will be set server-side
    };
  });
}
