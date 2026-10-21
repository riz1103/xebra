export type ExamLink =
  | { kind: "start"; examId: string; invitationId?: string; raw: string }
  | { kind: "session"; sessionId: string; raw: string };

export type AppLink = ExamLink | { kind: "verify"; code: string; raw: string };

const SITE_HOSTS = new Set(["xevra.concepcion-digital-solutions.com", "localhost", "127.0.0.1"]);

function verifyCode(parsed: URL): string | null {
  if (parsed.protocol === "xevra:" && parsed.hostname === "verify") {
    const code = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] || "");
    return code || null;
  }
  if ((parsed.protocol === "https:" || parsed.protocol === "http:") && SITE_HOSTS.has(parsed.hostname)) {
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "verify" && parts[1]) return decodeURIComponent(parts[1]);
  }
  return null;
}

/** xevra://exams/:id?invitation=, xevra://sessions/:id, and certificate verify links. */
export function parseAppLink(url: string): AppLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const code = verifyCode(parsed);
  if (code) return { kind: "verify", code, raw: url };
  return parseExamLink(url);
}

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
