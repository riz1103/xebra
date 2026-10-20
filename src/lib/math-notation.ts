/**
 * Plain-text math notation shared by question authors, the AI generator, and examinees.
 * Text is stored as typed; this module turns it into printed-style math for display:
 *
 *   3 * 4, 3 x 4      → 3 × 4         12 / 4, x / y (spaced) → ÷   (a spaced slash is always division)
 *   3/4, 5y²/(18xy)   → stacked fraction (no spaces; the top takes the whole product before the slash,
 *                       the bottom one number, letter, or parenthesized group; 1 1/2 is a mixed number)
 *   x^2, 2^(n+1), x²  → superscript    x_1, H₂O → subscript
 *   sqrt(16), √16     → radical with a bar over the radicand;  cbrt(8), ∛8 → cube root
 *   <= >= != ~= +/-   → ≤ ≥ ≠ ≈ ±      -> => <-> <=> → → ⇒ ↔ ⇔
 */

export type MathNode =
  | { kind: "text"; text: string; atom?: "number" | "letter" }
  | { kind: "group"; content: MathNode[]; open?: string; close?: string }
  | { kind: "frac"; num: MathNode[]; den: MathNode[] }
  | { kind: "sup"; base: MathNode | null; exp: MathNode[] }
  | { kind: "sub"; base: MathNode; sub: MathNode[] }
  | { kind: "root"; index?: string; content: MathNode[] };

const SUPERSCRIPT_MAP: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁻": "-", "⁺": "+", "ⁿ": "n",
};
const SUPERSCRIPT_CHARS = Object.keys(SUPERSCRIPT_MAP).join("");
const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

const OPERAND_END = `[\\w)\\]${SUPERSCRIPT_CHARS}]`;
const OPERAND_START = "[\\w(√∛∜]";
/** A digit, closing bracket, superscript, or a single letter that isn't the end of a word */
const SPACED_OPERATOR_LEFT = `(\\d|[)\\]${SUPERSCRIPT_CHARS}₀-₉]|(?:^|[^\\p{L}])\\p{L})`;
const SPACED_OPERATOR_RIGHT = "(?=\\s+(?:[\\d([√∛∜]|\\p{L}(?!\\p{L})))";

const SYMBOL_RULES: [RegExp, string][] = [
  [/<=>/g, "⇔"],
  [/<->/g, "↔"],
  [/-{1,2}>/g, "→"],
  [/=>/g, "⇒"],
  [/~=/g, "≈"],
  [/\+\/-/g, "±"],
  [/<=/g, "≤"],
  [/>=/g, "≥"],
  [/!=|=\/=/g, "≠"],
  [new RegExp(`(${OPERAND_END})(\\s*)\\*(?=\\s*(?:${OPERAND_START}|-))`, "g"), "$1$2×"],
  [/(\d)(\s+)[xX](?=\s+\d)/g, "$1$2×"],
  [new RegExp(`${SPACED_OPERATOR_LEFT}(\\s+)\\/${SPACED_OPERATOR_RIGHT}`, "gu"), "$1$2÷"],
  [new RegExp(`${SPACED_OPERATOR_LEFT}(\\s+)-${SPACED_OPERATOR_RIGHT}`, "gu"), "$1$2−"],
  [/(^|[\s(=+×÷≤≥<>≠±−])-(?=\d)/g, "$1−"],
];

/** Swaps keyboard stand-ins (*, spaced /, <=, ->, ...) for the symbols printed exams use. */
export function prettifySymbols(text: string): string {
  return SYMBOL_RULES.reduce((s, [re, to]) => s.replace(re, to), text);
}

// ⁿ is a Unicode letter, so letter runs exclude it to keep xⁿ as x + superscript
const TOKEN_RE = new RegExp(
  `(?:sqrt|cbrt)\\(|[√∛∜]|_{2,}|[${SUPERSCRIPT_CHARS}]+|\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|(?:(?!ⁿ)\\p{L})+|\\s+|[\\s\\S]`,
  "gu"
);
const SUPERSCRIPT_RUN = new RegExp(`^[${SUPERSCRIPT_CHARS}]+$`);
const ROOT_INDEX = new Map<string, string | undefined>([["√", undefined], ["∛", "3"], ["∜", "4"]]);
/** Brackets other than ( ) that group like parentheses and keep their own shape */
const CLOSERS = new Map([["[", "]"], ["{", "}"]]);
/** Rates like 5m/s and 60km/h stay inline instead of stacking */
const RATE_UNITS = new Set(["s", "h", "m", "g", "L"]);

const text = (t: string): MathNode => ({ kind: "text", text: t });
const atomFor = (t: string): MathNode => ({ kind: "text", text: t, atom: /^\d/.test(t) ? "number" : "letter" });

function isOperand(node: MathNode | undefined): boolean {
  if (!node) return false;
  if (node.kind === "text") return !!node.atom;
  return node.kind !== "frac";
}

const isLetter = (node: MathNode) => node.kind === "text" && node.atom === "letter";
/** Short letter runs (xy in 18xy, CO in CO₂) act as variables or element symbols next to other math */
const isShortWord = (node: MathNode) => node.kind === "text" && /^\p{L}{1,3}$/u.test(node.text);
/** Runs of element symbols (CaCO in CaCO_3, KMnO in KMnO_4), but not words like File in File_2 */
const isFormula = (node: MathNode) => node.kind === "text" && /^(?:\p{Lu}\p{Ll}?)+$/u.test(node.text);
/** ∑, ∏, and ∫ take limits as subscripts and superscripts */
const isBigOperator = (node: MathNode) => node.kind === "text" && /^[∑∏∫∮]$/.test(node.text);
const unwrapGroup = (node: MathNode): MathNode[] => (node.kind === "group" ? node.content : [node]);
const isRateUnit = (node: MathNode): boolean =>
  node.kind === "sup" ? !!node.base && isRateUnit(node.base) : node.kind === "text" && RATE_UNITS.has(node.text);

class Parser {
  private i = 0;
  private readonly toks: string[];

  constructor(toks: string[]) {
    this.toks = toks;
  }

  private peek(): string | undefined {
    return this.toks[this.i];
  }

  parseSeq(closer?: string): { nodes: MathNode[]; closed: boolean } {
    const out: MathNode[] = [];
    while (this.i < this.toks.length) {
      const t = this.toks[this.i];
      if (closer && t === closer) {
        this.i++;
        return { nodes: out, closed: true };
      }
      if (t === "^") {
        this.i++;
        const exp = this.parseScript();
        if (!exp) out.push(text("^"));
        else {
          const prev = out[out.length - 1];
          const base = isOperand(prev) || (prev && isBigOperator(prev)) ? out.pop()! : null;
          out.push({ kind: "sup", base, exp });
        }
      } else if (SUPERSCRIPT_RUN.test(t)) {
        this.i++;
        const exp = [...t].map((c) => SUPERSCRIPT_MAP[c]).join("").replace(/-/g, "−");
        const base = isOperand(out[out.length - 1]) ? out.pop()! : null;
        out.push({ kind: "sup", base, exp: [atomFor(exp)] });
      } else if (t === "_") {
        this.i++;
        const base = out[out.length - 1];
        const sub = base && (isOperand(base) || isShortWord(base) || isFormula(base) || isBigOperator(base)) ? this.parseScript() : null;
        if (sub) out.splice(out.length - 1, 1, { kind: "sub", base, sub });
        else out.push(text("_"));
      } else if (t === "/") {
        this.i++;
        const frac = this.tryFraction(out);
        if (frac) out.splice(out.length - frac.take, frac.take, frac.node);
        else out.push(text("/"));
      } else {
        const atom = this.parseAtom();
        if (atom) out.push(...atom);
      }
    }
    return { nodes: out, closed: false };
  }

  /** One token's worth of output; parentheses and roots consume their contents. */
  private parseAtom(): MathNode[] | null {
    const t = this.toks[this.i++];
    if (t === undefined) return null;
    if (t === "(" || t === "sqrt(" || t === "cbrt(" || CLOSERS.has(t)) {
      const close = CLOSERS.get(t) ?? ")";
      const inner = this.parseSeq(close);
      if (!inner.closed) return [text(t), ...inner.nodes];
      if (t === "(") return [{ kind: "group", content: inner.nodes }];
      if (CLOSERS.has(t)) return [{ kind: "group", content: inner.nodes, open: t, close }];
      return [{ kind: "root", index: t === "cbrt(" ? "3" : undefined, content: inner.nodes }];
    }
    if (ROOT_INDEX.has(t)) {
      const radicand = this.parseOperand();
      if (!radicand) return [text(t)];
      return [{ kind: "root", index: ROOT_INDEX.get(t), content: radicand.flatMap(unwrapGroup) }];
    }
    if (/^\d/.test(t) || /^\p{L}$/u.test(t)) return [atomFor(t)];
    return [text(t)];
  }

  /** A number, single letter, parenthesized group, or root, plus any exponents on it. */
  private parseOperand(): MathNode[] | null {
    const start = this.i;
    const t = this.peek();
    if (t === undefined) return null;
    const startsOperand =
      /^\d/.test(t) || /^\p{L}$/u.test(t) || t === "(" || t === "sqrt(" || t === "cbrt(" || CLOSERS.has(t) || ROOT_INDEX.has(t);
    if (!startsOperand) return null;
    const atom = this.parseAtom();
    if (!atom || atom.length !== 1 || !isOperand(atom[0])) {
      this.i = start;
      return null;
    }
    let node = atom[0];
    for (;;) {
      const next = this.peek();
      if (next !== undefined && SUPERSCRIPT_RUN.test(next)) {
        this.i++;
        node = { kind: "sup", base: node, exp: [atomFor([...next].map((c) => SUPERSCRIPT_MAP[c]).join("").replace(/-/g, "−"))] };
        continue;
      }
      if (next !== "^") break;
      this.i++;
      const exp = this.parseScript();
      if (!exp) {
        this.i--;
        break;
      }
      node = { kind: "sup", base: node, exp };
    }
    return [node];
  }

  /** Argument of ^ or _: a (group), {group}, or a signed number or single letter. */
  private parseScript(): MathNode[] | null {
    const start = this.i;
    const t = this.peek();
    if (t === "(" || t === "{") {
      this.i++;
      const inner = this.parseSeq(t === "(" ? ")" : "}");
      if (inner.closed) return inner.nodes;
      this.i = start;
      return null;
    }
    let sign: MathNode | null = null;
    if (t === "-" || t === "−" || t === "+") {
      sign = text(t === "-" ? "−" : t);
      this.i++;
    }
    const next = this.peek();
    if (next !== undefined && (/^\d/.test(next) || /^\p{L}$/u.test(next))) {
      this.i++;
      return sign ? [sign, atomFor(next)] : [atomFor(next)];
    }
    this.i = start;
    return null;
  }

  /**
   * Number of trailing nodes forming the numerator: the whole implicit product (2x³y, 5y², 3(x+1)),
   * which must contain at least one number, letter, group, power, or root.
   */
  private numeratorLength(out: MathNode[]): number {
    let n = 0;
    let hasOperand = false;
    for (let j = out.length - 1; j >= 0; j--) {
      const node = out[j];
      if (isOperand(node)) hasOperand = true;
      else if (!isShortWord(node)) break;
      n++;
    }
    return hasOperand ? n : 0;
  }

  /** Stacks a/b unless it looks like a date (1/2/2026), an abbreviation (w/o, I/O), or a rate (5m/s). */
  private tryFraction(out: MathNode[]): { take: number; node: MathNode } | null {
    const take = this.numeratorLength(out);
    if (take === 0) return null;
    const num = out.slice(out.length - take);
    const before = out[out.length - take - 1];
    if (before?.kind === "text" && before.text === "/") return null;
    const start = this.i;
    const den = this.parseOperand()?.[0];
    const last = num[num.length - 1];
    const reject =
      !den ||
      (take === 1 && isLetter(last) && isLetter(den)) ||
      (take > 1 && isShortWord(last) && isRateUnit(den));
    if (reject) {
      this.i = start;
      return null;
    }
    const denRest = den.kind === "group" ? [] : this.denominatorTail();
    if (this.peek() === "/") {
      this.i = start;
      return null;
    }
    const denNodes = denRest.length ? [den, ...denRest] : unwrapGroup(den);
    return { take, node: { kind: "frac", num: take === 1 ? unwrapGroup(last) : num, den: denNodes } };
  }

  /** Letters joined to a number or letter denominator (10x, 10x², 18xy), so 3x/10x² reads as 3x over 10x². */
  private denominatorTail(): MathNode[] {
    const tail: MathNode[] = [];
    for (;;) {
      const t = this.peek();
      if (t === undefined || !/^\p{L}{1,3}$/u.test(t)) return tail;
      if (t.length === 1) {
        tail.push(...this.parseOperand()!);
        continue;
      }
      this.i++;
      let node: MathNode = text(t);
      if (this.peek() === "^") {
        this.i++;
        const exp = this.parseScript();
        if (exp) node = { kind: "sup", base: node, exp };
        else this.i--;
      }
      tail.push(node);
    }
  }
}

export function parseMath(input: string): MathNode[] {
  const toks = prettifySymbols(input).match(TOKEN_RE) ?? [];
  return mergeText(new Parser(toks).parseSeq().nodes);
}

function mergeText(nodes: MathNode[]): MathNode[] {
  const out: MathNode[] = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (node.kind === "text" && last?.kind === "text") {
      out[out.length - 1] = { kind: "text", text: last.text + node.text };
    } else {
      out.push(node);
    }
  }
  return out;
}

function hasStructure(nodes: MathNode[]): boolean {
  return nodes.some((n) => (n.kind === "group" ? hasStructure(n.content) : n.kind !== "text"));
}

/** True when the text would display differently from how it was typed. */
export function hasMathFormatting(input: string): boolean {
  if (!input) return false;
  return prettifySymbols(input) !== input || hasStructure(parseMath(input));
}

/** Rough check for math or science content, used to open the symbol keypad by default. */
export function looksMathematical(input: string): boolean {
  return /[\d)]\s*[+×÷*/^=<>]\s*[\d(]|[√∛∜π²³×÷±≤≥≠≈∞∑∫Δ→⇌°₀-₉]|sqrt\(|\^/.test(input);
}

/** Linear reading of parsed math, for screen readers. */
export function mathToPlainText(nodes: MathNode[]): string {
  const wrap = (inner: MathNode[]) => {
    const s = mathToPlainText(inner);
    return inner.length === 1 && inner[0].kind === "text" && inner[0].atom ? s : `(${s})`;
  };
  return nodes
    .map((n) => {
      switch (n.kind) {
        case "text":
          return n.text;
        case "group":
          return `${n.open ?? "("}${mathToPlainText(n.content)}${n.close ?? ")"}`;
        case "frac":
          return `${wrap(n.num)} over ${wrap(n.den)}`;
        case "sup":
          return `${n.base ? mathToPlainText([n.base]) : ""} to the power of ${wrap(n.exp)}`;
        case "sub":
          return `${mathToPlainText([n.base])} sub ${wrap(n.sub)}`;
        case "root":
          return `${n.index === "3" ? "cube root" : n.index ? `root ${n.index}` : "square root"} of ${wrap(n.content)}`;
      }
    })
    .join("");
}

/** Wraps a fraction part or radicand in parentheses unless it is a single number or symbol. */
const asOperand = (s: string) => {
  const t = s.trim();
  return /^[\p{L}\d.]+$/u.test(t) ? t : `(${t})`;
};

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ",
  sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Upsilon: "Υ",
  Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};
const LATEX_COMMANDS = new Map<string, string>(Object.entries({
  times: "×", cdot: "·", ast: "×", div: "÷", pm: "±", mp: "∓",
  leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡", propto: "∝", sim: "∼", cong: "≅",
  infty: "∞", sum: "∑", prod: "∏", int: "∫", oint: "∮", partial: "∂", nabla: "∇", degree: "°",
  angle: "∠", triangle: "△", perp: "⊥", parallel: "∥", circ: "∘",
  in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇", cup: "∪", cap: "∩",
  emptyset: "∅", varnothing: "∅", forall: "∀", exists: "∃", neg: "¬", lnot: "¬", land: "∧", wedge: "∧",
  lor: "∨", vee: "∨", therefore: "∴", because: "∵",
  to: "→", rightarrow: "→", leftarrow: "←", leftrightarrow: "↔", Rightarrow: "⇒", implies: "⇒",
  Leftarrow: "⇐", Leftrightarrow: "⇔", iff: "⇔", rightleftharpoons: "⇌", uparrow: "↑", downarrow: "↓",
  ldots: "…", cdots: "⋯", prime: "′", ...GREEK,
}));
const BLACKBOARD: Record<string, string> = { N: "ℕ", Z: "ℤ", Q: "ℚ", R: "ℝ", C: "ℂ" };

/**
 * Rewrites LaTeX math (\frac{1}{2}, $x^{2}$, \times, \sqrt{x}, \alpha, \ce{H2O}) in the app's plain-text notation.
 * Generated text goes through this because models fall back to LaTeX for math despite instructions.
 */
export function latexToPlainMath(input: string): string {
  if (!/[\\$]/.test(input)) return input;
  let s = input
    .replace(/\$\$([^$]+)\$\$/g, "$1")
    .replace(/\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g, (_, a, b) => a ?? b)
    // Single $...$ only when the content is clearly math, so prices like "$5 and $10" survive
    .replace(/\$([^$\n]*[\\^_{}][^$\n]*)\$/g, "$1");
  s = s.replace(/\\ce\{([^{}]*)\}/g, (_, formula: string) =>
    formula
      .replace(/([A-Za-z)\]])(\d+)/g, (__, el, n: string) => el + [...n].map((d) => SUBSCRIPT_DIGITS[+d]).join(""))
      .replace(/<=>/g, "⇌")
      .replace(/->/g, "→")
  );
  s = s.replace(/\\(?:text|mathrm|mathbf|textbf|textit|mathit|operatorname)\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\mathbb\{([NZQRC])\}/g, (_, l) => BLACKBOARD[l]);
  let prev: string;
  do {
    prev = s;
    s = s
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a, b) => `${asOperand(a)}/${asOperand(b)}`)
      .replace(/\\sqrt\s*\[\s*3\s*\]\s*\{([^{}]*)\}/g, "cbrt($1)")
      .replace(/\\sqrt\s*\[\s*([^\]]+)\]\s*\{([^{}]*)\}/g, "($2)^(1/$1)")
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)")
      .replace(/([\^_])\s*\{([^{}]*)\}/g, (_, op, e) => (/^[\p{L}\d]$/u.test(e.trim()) ? `${op}${e.trim()}` : `${op}(${e.trim()})`));
  } while (s !== prev);
  s = s
    .replace(/\^\s*\\circ\b/g, "°")
    .replace(/\\(?:left|right)\s*([()[\]|.])/g, (_, b) => (b === "." ? "" : b))
    .replace(/\\%/g, "%")
    .replace(/\\(?:quad|qquad)\b|\\[,;:! ]/g, " ")
    .replace(/\\([A-Za-z]+)(?![A-Za-z])/g, (m, name) => LATEX_COMMANDS.get(name) ?? m);
  return s.replace(/\\sqrt\b\s*/g, "√");
}

const VULGAR_FRACTIONS: Record<string, string> = {
  "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅕": "1/5", "⅖": "2/5", "⅗": "3/5",
  "⅘": "4/5", "⅙": "1/6", "⅚": "5/6", "⅐": "1/7", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
  "⅑": "1/9", "⅒": "1/10",
};

/**
 * Comparison key for typed answers so equivalent notations match (3×4, 3*4, 3 x 4; x², x^2; √16, sqrt(16);
 * H₂O, H2O, H_2O; →, ->).
 * Keep in sync with norm in the backend's src/services/scoringService.js.
 */
export function normalizeAnswer(value: unknown): string {
  let s = String(value ?? "").trim().toLowerCase();
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ⁿ]+/g, (m) => "^" + [...m].map((c) => SUPERSCRIPT_MAP[c]).join(""));
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => String(SUBSCRIPT_DIGITS.indexOf(c)));
  s = s.replace(/_\(([\w.]+)\)|_\{([\w.]+)\}/g, (_, a, b) => a ?? b).replace(/(\w)_(?=\w)/g, "$1");
  s = s.replace(/(\d)?([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒])/g, (_, d, f) => (d ? `${d} ` : "") + VULGAR_FRACTIONS[f]);
  s = s.replace(/[×✕⋅·∙∗]/g, "*");
  s = s.replace(/(\d)\s*x\s*(?=\d)/g, "$1*");
  s = s.replace(/[÷∶⁄∕]/g, "/");
  s = s.replace(/[−–—‒]/g, "-");
  s = s.replace(/⇔/g, "<=>").replace(/↔/g, "<->").replace(/-{1,2}>|→/g, "->").replace(/⇒/g, "=>").replace(/≈/g, "~=");
  s = s.replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/≠|=\/=/g, "!=").replace(/\+\/-/g, "±");
  s = s.replace(/π/g, "pi");
  s = s.replace(/√/g, "sqrt").replace(/∛/g, "cbrt").replace(/∜/g, "root4");
  s = s.replace(/(sqrt|cbrt|root4)\s*([\w.]+)/g, "$1($2)").replace(/(sqrt|cbrt|root4)\s*\[([^[\]]*)\]/g, "$1($2)");
  s = s.replace(/\^\{([^{}]*)\}/g, "^($1)");
  s = s.replace(/\^\(\s*([-+]?[\w.]+)\s*\)/g, "^$1");
  s = s.replace(/\s*([-+*/^=<>!~(),±])\s*/g, "$1");
  s = s.replace(/(\d)\s+(?=[a-z(])/g, "$1");
  return s.replace(/\s+/g, " ");
}

/**
 * True when two answers are the same math with pieces moved, not a different value.
 * Addition and multiplication commute, so (x+8)(x-8) matches (x−8)(x+8), 8+x matches x+8,
 * and 3×4 matches 4*3. Subtraction, division, and powers do not: 8−x is not x−8, and a factored
 * answer is not the expanded polynomial. Words that are not expressions are left unchanged.
 * Keep in sync with mathAnswersMatch in the backend's src/services/mathAnswerMatch.js.
 */
const MATH_FUNCS = new Set(["sqrt", "cbrt", "root4", "sin", "cos", "tan", "log", "ln", "abs", "exp", "pi"]);

type Sign = 1 | -1;
type Expr =
  | { k: "atom"; v: string }
  | { k: "sum"; terms: { sign: Sign; e: Expr }[] }
  | { k: "prod"; sign: Sign; factors: Expr[] }
  | { k: "div"; a: Expr; b: Expr }
  | { k: "pow"; a: Expr; b: Expr }
  | { k: "rel"; op: "<" | ">" | "<=" | ">="; a: Expr; b: Expr }
  | { k: "eq"; op: "=" | "!=" | "~="; sides: Expr[] }
  | { k: "call"; name: string; args: Expr[] };

function negateExpr(e: Expr): Expr {
  if (e.k === "prod") return { ...e, sign: e.sign === 1 ? -1 : 1 };
  if (e.k === "sum") return { k: "sum", terms: e.terms.map((t) => ({ sign: (t.sign === 1 ? -1 : 1) as Sign, e: t.e })) };
  return { k: "prod", sign: -1, factors: [e] };
}

function flattenExpr(e: Expr): Expr {
  if (e.k === "sum") {
    const terms: { sign: Sign; e: Expr }[] = [];
    const walk = (sign: Sign, node: Expr) => {
      const n = flattenExpr(node);
      if (n.k === "sum") n.terms.forEach((t) => walk((sign * t.sign) as Sign, t.e));
      else if (n.k === "prod" && n.sign === 1 && n.factors.length === 1) walk(sign, n.factors[0]);
      else if (n.k === "prod" && n.sign === -1) walk((sign === 1 ? -1 : 1) as Sign, { ...n, sign: 1 });
      else terms.push({ sign, e: n });
    };
    e.terms.forEach((t) => walk(t.sign, t.e));
    return { k: "sum", terms };
  }
  if (e.k === "prod") {
    let sign: Sign = e.sign;
    const factors: Expr[] = [];
    const walk = (node: Expr) => {
      const n = flattenExpr(node);
      if (n.k === "prod") {
        if (n.sign === -1) sign = sign === 1 ? -1 : 1;
        n.factors.forEach(walk);
      } else factors.push(n);
    };
    e.factors.forEach(walk);
    return { k: "prod", sign, factors };
  }
  if (e.k === "div") return { k: "div", a: flattenExpr(e.a), b: flattenExpr(e.b) };
  if (e.k === "pow") return { k: "pow", a: flattenExpr(e.a), b: flattenExpr(e.b) };
  if (e.k === "rel") return { k: "rel", op: e.op, a: flattenExpr(e.a), b: flattenExpr(e.b) };
  if (e.k === "eq") return { k: "eq", op: e.op, sides: e.sides.map(flattenExpr) };
  if (e.k === "call") return { k: "call", name: e.name, args: e.args.map(flattenExpr) };
  return e;
}

function prepareMathInput(normalized: string): string | null {
  if (!normalized || !/[0-9+\-*/^=<>()!]/.test(normalized)) return null;
  if (/->|=>|<->|<=>/.test(normalized)) return null;
  let s = normalized;
  for (const name of MATH_FUNCS) {
    if (name === "pi") continue;
    s = s.split(`${name}(`).join(`\u0000${name}\u0000(`);
  }
  s = s.replace(/\)(?=[\da-z(])/g, ")*");
  s = s.replace(/(\d)(?=[a-z(])/g, "$1*");
  s = s.replace(/([a-z])(?=\()/g, "$1*");
  s = s.replace(/\u0000([a-z0-9]+)\u0000/g, "$1");
  return s;
}

class MathExprParser {
  private i = 0;
  private s: string;
  constructor(source: string) {
    this.s = source;
  }

  parse(): Expr {
    const expr = this.parseRel();
    if (this.i < this.s.length) throw new Error("math");
    return expr;
  }

  private peek() {
    return this.s[this.i] ?? "";
  }

  private starts(token: string) {
    return this.s.startsWith(token, this.i);
  }

  private parseRel(): Expr {
    const left = this.parseSum();
    const op = this.relation();
    if (!op) return left;
    this.i += op.length;
    const right = this.parseSum();
    if (this.relation()) throw new Error("math");
    if (op === "=" || op === "!=" || op === "~=") return { k: "eq", op, sides: [left, right] };
    return { k: "rel", op, a: left, b: right };
  }

  private relation(): "=" | "!=" | "~=" | "<=" | ">=" | "<" | ">" | null {
    if (this.starts("<=>") || this.starts("<->") || this.starts("->") || this.starts("=>")) throw new Error("math");
    if (this.starts("!=")) return "!=";
    if (this.starts("~=")) return "~=";
    if (this.starts("<=")) return "<=";
    if (this.starts(">=")) return ">=";
    if (this.peek() === "=") return "=";
    if (this.peek() === "<") return "<";
    if (this.peek() === ">") return ">";
    return null;
  }

  private parseSum(): Expr {
    const terms: { sign: Sign; e: Expr }[] = [];
    let sign: Sign = 1;
    if (this.peek() === "+") this.i += 1;
    else if (this.peek() === "-") {
      sign = -1;
      this.i += 1;
    }
    terms.push({ sign, e: this.parseProd() });
    while (this.peek() === "+" || this.peek() === "-") {
      const next: Sign = this.peek() === "+" ? 1 : -1;
      this.i += 1;
      terms.push({ sign: next, e: this.parseProd() });
    }
    if (terms.length === 1 && terms[0].sign === 1) return terms[0].e;
    return { k: "sum", terms };
  }

  private parseProd(): Expr {
    let expr = this.parsePow();
    for (;;) {
      if (this.peek() === "*") {
        this.i += 1;
        expr = { k: "prod", sign: 1, factors: [expr, this.parsePow()] };
      } else if (this.peek() === "/") {
        this.i += 1;
        expr = { k: "div", a: expr, b: this.parsePow() };
      } else break;
    }
    return expr;
  }

  private parsePow(): Expr {
    const base = this.parseUnary();
    if (this.peek() !== "^") return base;
    this.i += 1;
    return { k: "pow", a: base, b: this.parsePow() };
  }

  private parseUnary(): Expr {
    if (this.peek() === "+") {
      this.i += 1;
      return this.parseUnary();
    }
    if (this.peek() === "-") {
      this.i += 1;
      return negateExpr(this.parseUnary());
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    if (this.peek() === "(") {
      this.i += 1;
      const inner = this.parseRel();
      if (this.peek() !== ")") throw new Error("math");
      this.i += 1;
      return inner;
    }
    if (/[\d.]/.test(this.peek())) {
      const match = /^(\d*\.?\d+)/.exec(this.s.slice(this.i));
      if (!match || match[1] === "" || match[1] === ".") throw new Error("math");
      this.i += match[1].length;
      return { k: "atom", v: match[1] };
    }
    if (/[a-z]/.test(this.peek())) {
      const match = /^[a-z]+/.exec(this.s.slice(this.i));
      if (!match) throw new Error("math");
      const name = match[0];
      if (name.length > 1 && !MATH_FUNCS.has(name)) throw new Error("math");
      this.i += name.length;
      if (this.peek() === "(" && name !== "pi") {
        this.i += 1;
        const args = [this.parseRel()];
        while (this.peek() === ",") {
          this.i += 1;
          args.push(this.parseRel());
        }
        if (this.peek() !== ")") throw new Error("math");
        this.i += 1;
        return { k: "call", name, args };
      }
      return { k: "atom", v: name };
    }
    throw new Error("math");
  }
}

function parenExpr(e: Expr, slot: "factor" | "term" | "pow" | "exp" | "divl" | "divr"): string {
  const flat = flattenExpr(e);
  const text = canonicalExpr(flat);
  if (flat.k === "sum" || flat.k === "eq" || flat.k === "rel") return `(${text})`;
  if ((slot === "factor" || slot === "exp" || slot === "divr" || slot === "pow") && (flat.k === "div" || flat.k === "pow" || flat.k === "prod")) {
    return `(${text})`;
  }
  if (slot === "divl" && (flat.k === "div" || flat.k === "prod")) return `(${text})`;
  return text;
}

function canonicalExpr(e: Expr): string {
  e = flattenExpr(e);
  if (e.k === "atom") return /^-?\d+(\.\d+)?$/.test(e.v) && Number.isFinite(Number(e.v)) ? String(Number(e.v)) : e.v;
  if (e.k === "call") return `${e.name}(${e.args.map((arg) => canonicalExpr(arg)).join(",")})`;
  if (e.k === "pow") return `${parenExpr(e.a, "pow")}^${parenExpr(e.b, "exp")}`;
  if (e.k === "div") return `${parenExpr(e.a, "divl")}/${parenExpr(e.b, "divr")}`;
  if (e.k === "prod") {
    if (e.factors.length === 1 && e.sign === 1) return canonicalExpr(e.factors[0]);
    const parts = e.factors.map((factor) => parenExpr(factor, "factor"));
    if (e.sign === -1) parts.push("-1");
    parts.sort((a, b) => a.localeCompare(b));
    return parts.join("*");
  }
  if (e.k === "sum") {
    if (e.terms.length === 1 && e.terms[0].sign === 1) return canonicalExpr(e.terms[0].e);
    if (e.terms.length === 1) return canonicalExpr(negateExpr(e.terms[0].e));
    const parts = e.terms.map((term) => ({ sign: term.sign, s: parenExpr(term.e, "term") }));
    parts.sort((a, b) => a.s.localeCompare(b.s) || a.sign - b.sign);
    return parts
      .map((part, index) => (index === 0 ? (part.sign === -1 ? `-${part.s}` : part.s) : part.sign === -1 ? `-${part.s}` : `+${part.s}`))
      .join("");
  }
  if (e.k === "eq") return e.sides.map((side) => canonicalExpr(side)).sort((a, b) => a.localeCompare(b)).join(e.op);
  let op = e.op;
  let left = canonicalExpr(e.a);
  let right = canonicalExpr(e.b);
  if (left.localeCompare(right) > 0) {
    [left, right] = [right, left];
    op = op === "<" ? ">" : op === ">" ? "<" : op === "<=" ? ">=" : "<=";
  }
  return `${left}${op}${right}`;
}

function canonicalMath(normalized: string): string | null {
  const prepared = prepareMathInput(normalized);
  if (!prepared) return null;
  try {
    return canonicalExpr(new MathExprParser(prepared).parse());
  } catch {
    return null;
  }
}

export function mathAnswersMatch(a: unknown, b: unknown): boolean {
  const left = normalizeAnswer(a);
  const right = normalizeAnswer(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const canonicalLeft = canonicalMath(left);
  const canonicalRight = canonicalMath(right);
  return canonicalLeft != null && canonicalLeft === canonicalRight;
}
