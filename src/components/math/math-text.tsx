import { Fragment, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { hasMathFormatting, mathToPlainText, normalizeAnswer, parseMath, type MathNode } from "@/lib/math-notation";

function renderNodes(nodes: MathNode[]): ReactNode {
  return nodes.map((node, i) => <Fragment key={i}>{renderNode(node)}</Fragment>);
}

function renderNode(node: MathNode): ReactNode {
  switch (node.kind) {
    case "text":
      return node.text;
    case "group":
      return (
        <>
          {node.open ?? "("}
          {renderNodes(node.content)}
          {node.close ?? ")"}
        </>
      );
    case "frac":
      return (
        <span className="math-frac">
          <span className="math-frac-num">{renderNodes(node.num)}</span>
          <span className="math-frac-den">{renderNodes(node.den)}</span>
        </span>
      );
    case "sup":
      return (
        <>
          {node.base && renderNode(node.base)}
          <sup className="math-sup">{renderNodes(node.exp)}</sup>
        </>
      );
    case "sub":
      return (
        <>
          {renderNode(node.base)}
          <sub className="math-sub">{renderNodes(node.sub)}</sub>
        </>
      );
    case "root":
      return (
        <span className="math-root">
          {node.index && <span className="math-root-index">{node.index}</span>}
          <svg className="math-radical" viewBox="0 0 10 20" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0.5 12 L2.5 10.5 L5 19 L9.5 0.6 L10 0.6" />
          </svg>
          <span className="math-radicand">{renderNodes(node.content)}</span>
        </span>
      );
  }
}

/**
 * Shows question and answer text the way it would look printed: stacked fractions, superscript
 * exponents, radicals, and ×/÷ signs. Plain text without math passes through unchanged.
 */
export function MathText({ text, className }: { text: string | null | undefined; className?: string }) {
  const nodes = useMemo(() => (text ? parseMath(text) : []), [text]);
  if (!text) return null;
  const unchanged = nodes.length === 1 && nodes[0].kind === "text" && nodes[0].text === text;
  if (unchanged) return className ? <span className={className}>{text}</span> : <>{text}</>;
  return (
    <span className={className}>
      <span aria-hidden="true">{renderNodes(nodes)}</span>
      <span className="sr-only">{mathToPlainText(nodes)}</span>
    </span>
  );
}

/**
 * Several answers in one line. Separators are words in muted text so they can't be mistaken for math
 * (a "·" or "/" between 15x²y² and 3/4 reads as multiplication or division).
 */
export function MathAnswerList({
  answers,
  joiner = "or",
  className,
}: {
  answers: string[];
  /** "or" for accepted variants (notation-only duplicates are hidden), "and" for answers that all apply or one per blank */
  joiner?: "or" | "and";
  className?: string;
}) {
  const shown =
    joiner === "or"
      ? answers.filter((a, i) => a && answers.findIndex((b) => normalizeAnswer(b) === normalizeAnswer(a)) === i)
      : answers;
  return (
    <span className={className}>
      {shown.map((answer, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="mx-1.5 text-xs font-normal text-muted-foreground">{joiner}</span>}
          <MathText text={answer} />
        </Fragment>
      ))}
    </span>
  );
}

/** "Shows as" line under a math field; hidden until the typed text renders differently. */
export function MathPreview({ value, label = "Shows as", className }: { value: string | null | undefined; label?: string; className?: string }) {
  if (!value || !hasMathFormatting(value)) return null;
  return (
    <p className={cn("rounded-md bg-muted/50 px-3 py-2 text-sm", className)} aria-live="polite">
      <span className="mr-2 text-xs text-muted-foreground">{label}:</span>
      <MathText text={value} className="text-base" />
    </p>
  );
}
