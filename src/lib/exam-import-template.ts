/**
 * Builds a Word (.docx) template for proctors to fill in and import exams.
 * Covers all question types and combinations supported by the exam parser.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  type FileChild,
} from "docx";

function heading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
  });
}

function subheading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
  });
}

function body(text: string): Paragraph {
  return new Paragraph({ text, spacing: { after: 80 } });
}

function tip(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: "Tip: ", bold: true }),
      new TextRun(text),
    ],
    spacing: { after: 80 },
    shading: { fill: "F5F5F5" },
  });
}

function blank(): Paragraph {
  return new Paragraph({ text: "", spacing: { after: 60 } });
}

export async function buildExamImportTemplateDocx(): Promise<Buffer> {
  const children: FileChild[] = [
    new Paragraph({
      text: "XEVRA Exam Import Template — Proctor Guide",
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: "Use this document as a guide to prepare your exam in Word (.docx) or PDF. Upload the file in the app when creating an exam. Replace the example content with your own questions.",
      spacing: { after: 200 },
    }),

    heading("1. File format & numbering"),
    body("Supported formats: Word (.docx) or PDF with selectable text. For photos, scanned pages, or slides, use \"Generate with AI\" instead."),
    body(
      "Number every question. Supported patterns: 1. or 1) or Q1. or Question 1: or #1 or 1 -"
    ),
    tip("Keep numbering consistent (e.g. 1., 2., 3.) so the importer can split questions correctly."),
    blank(),

    heading("2. Section headers (exam parts)"),
    body(
      "To split your exam into parts (e.g. \"Part 1: True or False\", \"Part 2: Multiple Choice\"), add a section header line with the part name and question range in parentheses:"
    ),
    new Paragraph({
      text: "True or False (1-10)",
      heading: HeadingLevel.HEADING_4,
      spacing: { before: 100, after: 60 },
    }),
    new Paragraph({
      text: "Grammar and Vocabulary (11-25)",
      heading: HeadingLevel.HEADING_4,
      spacing: { after: 60 },
    }),
    body("The app will create one exam part per such header and assign questions to parts by their number. Including \"True or False\" in the header name sets the question type for that section to True/False."),
    tip('Section header format: "Part Name (start-end)" e.g. "Multiple Choice (1-20)".'),
    blank(),

    heading("3. Multiple choice"),
    body("Write the question, then list options with letters A., B., C., D. (up to J.). Option text can be on the same line or on new lines."),
    body("Example:"),
    body("1. What is the capital of France?"),
    body("A. London  B. Berlin  C. Paris  D. Madrid"),
    tip("Correct answer can be marked with * or ✓ next to the option, or provided in an Answer Key at the end (see below)."),
    blank(),

    heading("4. True or False"),
    body("Use a section header \"True or False (N-M)\" so the app assigns the True/False type. Each question can be a statement; options are typically True and False. You can also use a single blank for the answer:"),
    body("11. The Earth is flat. _____"),
    body("A. True  B. False"),
    blank(),

    heading("5. Multiple answer (check all that apply)"),
    body("Same format as multiple choice (A., B., C., …). The app detects \"multiple answer\" from the question type name in your exam setup; use lettered options and mark all correct answers (e.g. with * or in the answer key)."),
    body("Example:"),
    body("12. Which are prime numbers? (Select all that apply)"),
    body("A. 2  B. 4  C. 5  D. 9"),
    blank(),

    heading("6. Fill in the blank(s) — free text"),
    body("Use two or more underscores _____ in the question text for each blank. Do not add A./B./C. options; the examinee types the answer."),
    body("Example:"),
    body("13. The capital of France is _____."),
    body("14. _____ is the largest planet. The Earth orbits the _____."),
    tip("Provide one correct answer per blank (in the app you will see \"Blank 1\", \"Blank 2\", etc.). You can add \"Answer: …\" in the document for reference; the importer may use it when no answer key is present."),
    blank(),

    heading("7. Fill in the blank(s) — with options (multiple choice per blank)"),
    body("Use _____ in the question and list options A., B., C., D. The app will show one dropdown per blank, each with the same choices (or you configure per-blank options in the app)."),
    body("Example:"),
    body("15. She _____ to school every day.  A. go  B. goes  C. went  D. going"),
    blank(),

    heading("8. Identification / short answer"),
    body("Question without lettered options. If the question has _____ blanks, the app treats it as fill-in-the-blank (see above). Without blanks, it is short answer; correct answer can be set in the app after import."),
    blank(),

    heading("9. Essay"),
    body("Essay questions have no options and no single correct answer; they are graded manually. Write the question text only (e.g. \"16. Discuss the causes of World War I.\"). The app may assign essay type by name or you can set it when editing the exam."),
    blank(),

    heading("10. Answer key (optional)"),
    body("At the end of the document you can add an answer key. Start a new line with one of: ANSWER KEY, Answer Key, ANSWERS:, KEY:, ANSWER SHEET. Then list question number and letter, e.g.:"),
    body("ANSWER KEY"),
    body("1. C"),
    body("2. A"),
    body("3. B"),
    body("11. B"),
    body("12. A, C"),
    tip("Format: number followed by . or ) or - then space then letter (A–J). One entry per line."),
    blank(),

    heading("Example full document (all types)"),
    body("Below is a minimal example you can copy and edit. It includes section headers, multiple choice, true/false, fill-in free text, fill-in with options, and an answer key."),
    blank(),

    new Paragraph({
      text: "Multiple Choice (1-2)",
      heading: HeadingLevel.HEADING_4,
      spacing: { before: 120, after: 60 },
    }),
    body("1. What is 2 + 2?"),
    body("A. 3  B. 4  C. 5  D. 6"),
    blank(),
    body("2. Which planet is known as the Red Planet?"),
    body("A. Venus  B. Mars  C. Jupiter  D. Saturn"),
    blank(),

    new Paragraph({
      text: "True or False (3-4)",
      heading: HeadingLevel.HEADING_4,
      spacing: { before: 120, after: 60 },
    }),
    body("3. The sun rises in the east. _____"),
    body("A. True  B. False"),
    blank(),
    body("4. Water boils at 100°C at sea level. _____"),
    body("A. True  B. False"),
    blank(),

    new Paragraph({
      text: "Fill in the blanks – free text (5-6)",
      heading: HeadingLevel.HEADING_4,
      spacing: { before: 120, after: 60 },
    }),
    body("5. The _____ is the largest ocean on Earth."),
    body("6. _____ invented the light bulb. The capital of Japan is _____."),
    blank(),

    new Paragraph({
      text: "Fill in the blank – with options (7)",
      heading: HeadingLevel.HEADING_4,
      spacing: { before: 120, after: 60 },
    }),
    body("7. She _____ to the market every Monday.  A. go  B. goes  C. went  D. going"),
    blank(),

    new Paragraph({
      text: "Essay (8)",
      heading: HeadingLevel.HEADING_4,
      spacing: { before: 120, after: 60 },
    }),
    body("8. In 200 words, explain why recycling is important for the environment."),
    blank(),

    new Paragraph({
      text: "ANSWER KEY",
      heading: HeadingLevel.HEADING_4,
      spacing: { before: 200, after: 80 },
    }),
    body("1. B"),
    body("2. B"),
    body("3. A"),
    body("4. A"),
    body("5. Pacific"),
    body("6. Edison / Tokyo"),
    body("7. B"),
  ];

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
