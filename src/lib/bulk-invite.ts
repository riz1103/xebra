const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export interface ParsedInviteList {
  /** Unique, lower-cased emails in file order */
  emails: string[];
  /** Rows that had text but no valid email */
  invalid: { line: number; text: string }[];
  duplicates: number;
}

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && (ch === "," || ch === ";" || ch === "\t")) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Reads emails from CSV text or a pasted list. With a header row, the column named like "email" is used;
 * otherwise the first cell that looks like an email in each row.
 */
export function parseInviteList(text: string): ParsedInviteList {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const rows = lines.map((line, i) => ({ line: i + 1, cells: splitRow(line) })).filter((r) => r.cells.some(Boolean));

  let emailColumn = -1;
  if (rows.length > 0 && !rows[0].cells.some((c) => EMAIL_RE.test(c))) {
    emailColumn = rows[0].cells.findIndex((c) => /e-?mail/i.test(c));
    if (emailColumn >= 0) rows.shift();
  }

  const seen = new Set<string>();
  const emails: string[] = [];
  const invalid: ParsedInviteList["invalid"] = [];
  let duplicates = 0;

  for (const row of rows) {
    // Without a header, a row may hold several emails, e.g. a pasted "a@x.com b@y.com"
    const fromColumn = emailColumn >= 0 ? (row.cells[emailColumn] ?? "").trim().toLowerCase() : "";
    const valid = EMAIL_RE.test(fromColumn)
      ? [fromColumn]
      : row.cells
          .flatMap((c) => c.split(/\s+/))
          .map((c) => c.trim().toLowerCase())
          .filter((c) => EMAIL_RE.test(c))
          .slice(0, emailColumn >= 0 ? 1 : undefined);
    if (valid.length === 0) {
      invalid.push({ line: row.line, text: row.cells.filter(Boolean).join(", ") });
      continue;
    }
    for (const email of valid) {
      if (seen.has(email)) {
        duplicates++;
        continue;
      }
      seen.add(email);
      emails.push(email);
    }
  }

  return { emails, invalid, duplicates };
}

/** Runs tasks with a fixed number in flight; stops starting new ones once shouldStop() is true. */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>,
  shouldStop: () => boolean = () => false
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length && !shouldStop()) {
      const index = next++;
      await task(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
