/**
 * Fill-in-the-blank: blank placeholder is 2+ consecutive underscores (e.g. _____).
 * Used to split questionText into segments and render one input/dropdown per blank.
 */

const BLANK_PLACEHOLDER = /_{2,}/g;

export interface ParsedBlanks {
  /** Text segments; length is blankCount + 1. Blanks go between segment[i] and segment[i+1]. */
  segments: string[];
  /** Number of blanks in the question text */
  blankCount: number;
}

/**
 * Parses questionText for blank placeholders (_____).
 * Returns segments (text between blanks) and the number of blanks.
 */
export function parseBlanks(questionText: string): ParsedBlanks {
  if (!questionText || typeof questionText !== "string") {
    return { segments: [""], blankCount: 0 };
  }
  const segments = questionText.split(BLANK_PLACEHOLDER);
  const blankCount = Math.max(0, segments.length - 1);
  return { segments, blankCount };
}

/**
 * Returns true if the text contains at least one blank placeholder.
 */
export function hasBlanks(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return (text.match(BLANK_PLACEHOLDER) ?? []).length > 0;
}
