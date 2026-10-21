const BLANK_PLACEHOLDER = /_{2,}/g;

export function parseBlanks(questionText: string): { segments: string[]; blankCount: number } {
  if (!questionText) return { segments: [""], blankCount: 0 };
  const segments = questionText.split(BLANK_PLACEHOLDER);
  return { segments, blankCount: Math.max(0, segments.length - 1) };
}
