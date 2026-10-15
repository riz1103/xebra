"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TextField = HTMLInputElement | HTMLTextAreaElement;

interface MathKey {
  label: ReactNode;
  name: string;
  /** Inserted before the caret (or before the selection, which it wraps) */
  before: string;
  after?: string;
}

const FractionIcon = () => (
  <span className="inline-flex flex-col items-center text-[0.7em] leading-none">
    <span>a</span>
    <span className="w-full border-t border-current" />
    <span>b</span>
  </span>
);

const sym = (char: string, name: string): MathKey => ({ label: char, name, before: char });

const KEY_TABS: { id: string; label: string; groups: MathKey[][] }[] = [
  {
    id: "basic",
    label: "Basic",
    groups: [
      [
        sym("×", "Multiply"),
        sym("÷", "Divide"),
        { label: <FractionIcon />, name: "Fraction (type the top number, then this, then the bottom number)", before: "/" },
        sym("±", "Plus or minus"),
      ],
      [
        { label: <>x<sup>2</sup></>, name: "Squared", before: "²" },
        { label: <>x<sup>3</sup></>, name: "Cubed", before: "³" },
        { label: <>x<sup>n</sup></>, name: "Exponent", before: "^(", after: ")" },
        { label: "√", name: "Square root", before: "√(", after: ")" },
        { label: "∛", name: "Cube root", before: "∛(", after: ")" },
      ],
      [
        sym("<", "Less than"),
        sym(">", "Greater than"),
        sym("≤", "Less than or equal to"),
        sym("≥", "Greater than or equal to"),
        sym("≠", "Not equal to"),
      ],
      [sym("π", "Pi"), sym("°", "Degrees"), sym("(", "Open parenthesis"), sym(")", "Close parenthesis")],
    ],
  },
  {
    id: "algebra",
    label: "Algebra",
    groups: [
      [
        { label: <>x<sub>n</sub></>, name: "Subscript", before: "_(", after: ")" },
        { label: "|x|", name: "Absolute value", before: "|", after: "|" },
        sym("≈", "Approximately equal to"),
        sym("≡", "Identical to"),
        sym("∝", "Proportional to"),
        sym("∞", "Infinity"),
      ],
      [sym("∑", "Sum"), sym("∏", "Product"), sym("∫", "Integral"), sym("∂", "Partial derivative"), sym("Δ", "Delta (change)"), sym("′", "Prime")],
      [sym("→", "Approaches / maps to"), sym("⇒", "Implies"), sym("⇔", "If and only if"), sym("∴", "Therefore"), sym("∵", "Because")],
    ],
  },
  {
    id: "geometry",
    label: "Geometry",
    groups: [
      [sym("∠", "Angle"), sym("△", "Triangle"), sym("⊥", "Perpendicular"), sym("∥", "Parallel"), sym("≅", "Congruent"), sym("∼", "Similar")],
      [sym("°", "Degrees"), sym("′", "Minutes / feet"), sym("″", "Seconds / inches"), sym("π", "Pi"), sym("θ", "Theta")],
    ],
  },
  {
    id: "sets",
    label: "Sets & logic",
    groups: [
      [sym("∈", "Element of"), sym("∉", "Not an element of"), sym("⊂", "Proper subset"), sym("⊆", "Subset"), sym("∪", "Union"), sym("∩", "Intersection"), sym("∅", "Empty set")],
      [sym("ℕ", "Natural numbers"), sym("ℤ", "Integers"), sym("ℚ", "Rational numbers"), sym("ℝ", "Real numbers")],
      [sym("∀", "For all"), sym("∃", "There exists"), sym("¬", "Not"), sym("∧", "And"), sym("∨", "Or")],
    ],
  },
  {
    id: "greek",
    label: "Greek",
    groups: [
      [
        sym("α", "Alpha"), sym("β", "Beta"), sym("γ", "Gamma"), sym("δ", "Delta"), sym("ε", "Epsilon"), sym("θ", "Theta"),
        sym("λ", "Lambda"), sym("μ", "Mu"), sym("ρ", "Rho"), sym("σ", "Sigma"), sym("τ", "Tau"), sym("φ", "Phi"), sym("ω", "Omega"),
      ],
      [sym("Δ", "Capital delta"), sym("Σ", "Capital sigma"), sym("Φ", "Capital phi"), sym("Ω", "Capital omega")],
    ],
  },
  {
    id: "science",
    label: "Science",
    groups: [
      [sym("₂", "Subscript 2"), sym("₃", "Subscript 3"), sym("₄", "Subscript 4"), sym("⁺", "Superscript plus (ion)"), sym("⁻", "Superscript minus (ion)"), sym("·", "Middle dot")],
      [sym("→", "Yields"), sym("⇌", "Reversible reaction"), sym("↑", "Gas released"), sym("↓", "Precipitate"), sym("Δ", "Heat / change")],
      [sym("℃", "Degrees Celsius"), sym("℉", "Degrees Fahrenheit"), sym("Å", "Angstrom"), sym("μ", "Micro"), sym("Ω", "Ohm"), sym("λ", "Wavelength")],
    ],
  },
];

const FIELD_SELECTOR = 'textarea, input:not([type]), input[type="text"]';

function isTextField(el: EventTarget | null): el is TextField {
  return el instanceof HTMLElement && el.matches(FIELD_SELECTOR) && !(el as TextField).readOnly && !(el as TextField).disabled;
}

/** Types into a React-controlled field by going through the native setter so onChange fires. */
function insertIntoField(el: TextField, before: string, after = "") {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const selected = el.value.slice(start, end);
  const next = el.value.slice(0, start) + before + selected + after + el.value.slice(end);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const caret = start + before.length + selected.length + (selected ? after.length : 0);
  el.focus({ preventScroll: true });
  el.setSelectionRange(caret, caret);
}

/**
 * Buttons for symbols missing from the keyboard (×, ÷, fractions, exponents, roots).
 * Types into whichever text field inside `scopeRef` was focused last.
 */
export function MathKeypad({
  scopeRef,
  open,
  onOpenChange,
  showNotationHint = false,
  className,
}: {
  scopeRef: RefObject<HTMLElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Explains the keyboard shortcuts for authors typing questions */
  showNotationHint?: boolean;
  className?: string;
}) {
  const lastField = useRef<TextField | null>(null);
  const [tabId, setTabId] = useState(KEY_TABS[0].id);
  const tab = KEY_TABS.find((t) => t.id === tabId) ?? KEY_TABS[0];

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (isTextField(e.target) && scopeRef.current?.contains(e.target)) lastField.current = e.target;
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [scopeRef]);

  const press = (key: MathKey) => {
    const scope = scopeRef.current;
    if (!scope) return;
    const remembered = lastField.current;
    const field =
      remembered && scope.contains(remembered) && isTextField(remembered)
        ? remembered
        : scope.querySelector<TextField>(FIELD_SELECTOR);
    if (field) insertIntoField(field, key.before, key.after);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        <Sigma className="h-3.5 w-3.5" />
        {open ? "Hide math symbols" : "Math symbols"}
      </Button>
      {open && (
        <div className="rounded-lg border bg-muted/30 p-2">
          <div className="no-scrollbar -mx-2 mb-2 flex gap-1 overflow-x-auto px-2" aria-label="Symbol categories">
            {KEY_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={t.id === tab.id}
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setTabId(t.id)}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3 text-xs font-medium transition-colors",
                  t.id === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="toolbar" aria-label={`${tab.label} symbols`} className="flex flex-wrap gap-x-3 gap-y-1.5">
            {tab.groups.map((group, gi) => (
              <div key={gi} className="flex flex-wrap gap-1">
                {group.map((key) => (
                  <button
                    key={key.name}
                    type="button"
                    title={key.name}
                    aria-label={key.name}
                    // Keep focus (and the phone keyboard) on the answer field
                    onPointerDown={(e) => e.preventDefault()}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => press(key)}
                    className="flex h-10 min-w-10 items-center justify-center rounded-md border bg-background px-2 text-base font-medium shadow-sm transition-colors hover:bg-accent active:bg-accent sm:h-9 sm:min-w-9"
                  >
                    {key.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {open && showNotationHint && (
        <p className="text-xs text-muted-foreground">
          You can also type these from the keyboard: <code>3/4</code> for a stacked fraction, <code>1 1/2</code> for a mixed
          number, <code>12 / 4</code> (spaces around the slash) for ÷, <code>3 * 4</code> or <code>3 x 4</code> for ×,{" "}
          <code>x^2</code> or <code>2^(n+1)</code> for exponents, <code>x_1</code> for subscripts, <code>sqrt(16)</code> for √,
          and <code>-&gt;</code> for →. The top of a fraction is everything joined to the slash (<code>5y^2/3</code>); put a
          longer bottom in parentheses: <code>(2x+1)/(3y)</code>. Examinees see the printed symbols.
        </p>
      )}
    </div>
  );
}

/** Wrapper for forms rendered in a loop: owns the keypad's scope and open state, and hands back the keypad to place. */
export function MathKeypadScope({
  defaultOpen,
  showNotationHint,
  className,
  children,
}: {
  defaultOpen: boolean;
  showNotationHint?: boolean;
  className?: string;
  children: (keypad: ReactNode) => ReactNode;
}) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const [openPref, setOpenPref] = useState<boolean | null>(null);
  const keypad = (
    <MathKeypad
      scopeRef={scopeRef}
      open={openPref ?? defaultOpen}
      onOpenChange={setOpenPref}
      showNotationHint={showNotationHint}
    />
  );
  return (
    <div ref={scopeRef} className={className}>
      {children(keypad)}
    </div>
  );
}
