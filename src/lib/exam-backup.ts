type Answer = string | string[] | null;

export interface ExamBackup {
  answers: Record<string, Answer>;
  /** Question IDs whose latest answer hasn't been confirmed by the server */
  unsynced: string[];
  currentIndex: number;
  currentPart: string | null;
  savedAt: number;
}

const keyFor = (sessionId: string) => `xebra:exam-backup:${sessionId}`;

/** Local copy of in-progress answers so a dropped connection or closed tab doesn't lose work. */
export function readExamBackup(sessionId: string): ExamBackup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExamBackup>;
    if (!parsed || typeof parsed.answers !== "object" || parsed.answers === null) return null;
    return {
      answers: parsed.answers,
      unsynced: Array.isArray(parsed.unsynced) ? parsed.unsynced : [],
      currentIndex: typeof parsed.currentIndex === "number" ? parsed.currentIndex : 0,
      currentPart: typeof parsed.currentPart === "string" ? parsed.currentPart : null,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function writeExamBackup(sessionId: string, backup: Omit<ExamBackup, "savedAt">) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(sessionId), JSON.stringify({ ...backup, savedAt: Date.now() }));
  } catch {
    // Storage full or disabled (private mode); the server copy is still the source of truth
  }
}

export function clearExamBackup(sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(sessionId));
  } catch {
    // ignore
  }
}

/**
 * Server answers, with any answers the server never confirmed taken from the local backup.
 */
export function mergeWithBackup(
  serverAnswers: Record<string, Answer>,
  backup: ExamBackup | null
): { answers: Record<string, Answer>; unsynced: string[] } {
  if (!backup || backup.unsynced.length === 0) return { answers: { ...serverAnswers }, unsynced: [] };
  const answers = { ...serverAnswers };
  const unsynced: string[] = [];
  for (const questionId of backup.unsynced) {
    if (!(questionId in backup.answers)) continue;
    const local = backup.answers[questionId];
    if (JSON.stringify(local) !== JSON.stringify(serverAnswers[questionId] ?? null)) {
      answers[questionId] = local;
      unsynced.push(questionId);
    }
  }
  return { answers, unsynced };
}
