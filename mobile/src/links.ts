export type ExamLink =
  | { kind: "start"; examId: string; invitationId?: string; raw: string }
  | { kind: "session"; sessionId: string; raw: string };

/** xevra://exams/:id?invitation= and xevra://sessions/:id, the links the website offers. */
export function parseExamLink(url: string): ExamLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "xevra:") return null;
  const id = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] || "");
  if (!id) return null;
  if (parsed.hostname === "exams") {
    const invitationId = parsed.searchParams.get("invitation") || undefined;
    return { kind: "start", examId: id, invitationId, raw: url };
  }
  if (parsed.hostname === "sessions") return { kind: "session", sessionId: id, raw: url };
  return null;
}
