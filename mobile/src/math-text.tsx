import { Fragment, useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { parseMath, type MathNode } from "./math-notation";

/**
 * Printed-style math for question and answer text. Same notation as the website:
 * stacked fractions, superscripts at 0.72em raised half an em, subscripts, and radicals.
 *
 * A smaller nested Text is not enough on Android: the parent font size wins, so a^2 draws as a2.
 * Exponents use superscript glyphs in the same text as the base, so the variable stays on the
 * line with the letters around it.
 */
export function MathText({ text, style }: { text: string | null | undefined; style?: StyleProp<TextStyle> }) {
  const nodes = useMemo(() => (text ? parseMath(text) : []), [text]);
  if (!text) return null;
  const unchanged = nodes.length === 1 && nodes[0].kind === "text" && nodes[0].text === text;
  if (unchanged) return <Text style={style}>{text}</Text>;
  const ctx = metrics(style);
  const flat = StyleSheet.flatten(style) ?? {};
  const lineHeight = Math.max(typeof flat.lineHeight === "number" ? flat.lineHeight : 0, Math.round(ctx.fontSize * 1.55));
  return <Text style={[style, { lineHeight }]}>{nodes.map((node, i) => renderNode(node, i, ctx, true))}</Text>;
}

type Ctx = { color: string; fontSize: number; fontWeight: TextStyle["fontWeight"] };

function metrics(style: StyleProp<TextStyle> | undefined): Ctx {
  const flat = StyleSheet.flatten(style) ?? {};
  return {
    color: typeof flat.color === "string" ? flat.color : "#1C1730",
    fontSize: typeof flat.fontSize === "number" ? flat.fontSize : 14,
    fontWeight: flat.fontWeight,
  };
}

function leaf(ctx: Ctx): TextStyle {
  return {
    color: ctx.color,
    fontSize: ctx.fontSize,
    lineHeight: Math.round(ctx.fontSize * 1.2),
    fontWeight: ctx.fontWeight,
    includeFontPadding: false,
  };
}

function renderNodes(nodes: MathNode[], ctx: Ctx, inherit: boolean): ReactNode[] {
  return nodes.map((node, i) => renderNode(node, i, ctx, inherit));
}

function renderNode(node: MathNode, key: number, ctx: Ctx, inherit: boolean): ReactNode {
  switch (node.kind) {
    case "text":
      return inherit ? <Text key={key}>{node.text}</Text> : <Text key={key} style={leaf(ctx)}>{node.text}</Text>;
    case "group":
      return (
        <Text key={key} style={inherit ? undefined : leaf(ctx)}>
          {node.open ?? "("}
          {renderNodes(node.content, ctx, inherit)}
          {node.close ?? ")"}
        </Text>
      );
    case "frac":
      return <Fraction key={key} node={node} ctx={ctx} />;
    case "sup":
      return <Script key={key} base={node.base} script={node.exp} ctx={ctx} rise={0.5} />;
    case "sub":
      return <Script key={key} base={node.base} script={node.sub} ctx={ctx} rise={-0.22} />;
    case "root":
      return <Radical key={key} node={node} ctx={ctx} />;
    default:
      return <Fragment key={key} />;
  }
}

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  "a": "ᵃ", "b": "ᵇ", "c": "ᶜ", "d": "ᵈ", "e": "ᵉ", "f": "ᶠ", "g": "ᵍ", "h": "ʰ", "i": "ⁱ", "j": "ʲ",
  "k": "ᵏ", "l": "ˡ", "m": "ᵐ", "n": "ⁿ", "o": "ᵒ", "p": "ᵖ", "r": "ʳ", "s": "ˢ", "t": "ᵗ", "u": "ᵘ",
  "v": "ᵛ", "w": "ʷ", "x": "ˣ", "y": "ʸ", "z": "ᶻ",
};
const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎",
  "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "j": "ⱼ", "k": "ₖ", "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ",
  "p": "ₚ", "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ", "v": "ᵥ", "x": "ₓ",
};

/** Script glyphs share the base's text run, so the variable stays on the line and the power cannot wrap away. */
function toScript(nodes: MathNode[], map: Record<string, string>): string | null {
  let out = "";
  for (const node of nodes) {
    if (node.kind === "text") {
      for (const ch of node.text) {
        if (ch === " ") {
          out += " ";
          continue;
        }
        const next = map[ch];
        if (!next) return null;
        out += next;
      }
    } else if (node.kind === "group") {
      const open = map[node.open ?? "("];
      const close = map[node.close ?? ")"];
      const inner = toScript(node.content, map);
      if (!open || !close || inner == null) return null;
      out += open + inner + close;
    } else {
      return null;
    }
  }
  return out;
}

function plainGroup(node: Extract<MathNode, { kind: "group" }>): string | null {
  let out = node.open ?? "(";
  for (const child of node.content) {
    if (child.kind !== "text") return null;
    out += child.text;
  }
  return out + (node.close ?? ")");
}

/** Website .math-sup / .math-sub. The base is ordinary text; the script is a superscript or subscript glyph. */
function Script({ base, script, ctx, rise }: { base: MathNode | null; script: MathNode[]; ctx: Ctx; rise: number }) {
  const pretty = toScript(script, rise > 0 ? SUPERSCRIPT : SUBSCRIPT);
  if (pretty != null) {
    const glued = `\u2060${pretty}`;
    if (base?.kind === "text") return <Text>{base.text + glued}</Text>;
    if (base?.kind === "group") {
      const flat = plainGroup(base);
      if (flat != null) return <Text>{flat + glued}</Text>;
      return (
        <Text>
          {base.open ?? "("}
          {renderNodes(base.content, ctx, true)}
          {(base.close ?? ")") + glued}
        </Text>
      );
    }
    return (
      <>
        {base ? renderNode(base, 0, ctx, true) : null}
        <Text>{glued}</Text>
      </>
    );
  }
  const size = Math.max(10, Math.round(ctx.fontSize * 0.72));
  const shift = Math.round(ctx.fontSize * rise);
  const scriptCtx = { ...ctx, fontSize: size };
  return (
    <>
      {base ? renderNode(base, 0, ctx, true) : null}
      <View style={{ marginBottom: shift, marginLeft: Math.max(1, Math.round(ctx.fontSize * 0.03)) }}>
        <Text style={leaf(scriptCtx)}>{renderNodes(script, scriptCtx, false)}</Text>
      </View>
    </>
  );
}

/** Website .math-frac: slightly smaller, bar between, centered on the line. */
function Fraction({ node, ctx }: { node: Extract<MathNode, { kind: "frac" }>; ctx: Ctx }) {
  const size = Math.max(11, Math.round(ctx.fontSize * 0.9));
  const small = { ...ctx, fontSize: size };
  const bar = Math.max(1, Math.round(ctx.fontSize * 0.06));
  return (
    <View style={[styles.frac, { marginHorizontal: Math.round(ctx.fontSize * 0.12), transform: [{ translateY: Math.round(ctx.fontSize * 0.08) }] }]}>
      <Text style={leaf(small)}>{renderNodes(node.num, small, false)}</Text>
      <View style={{ alignSelf: "stretch", height: bar, backgroundColor: ctx.color, marginVertical: 1 }} />
      <Text style={leaf(small)}>{renderNodes(node.den, small, false)}</Text>
    </View>
  );
}

/** Website .math-root: index, radical, and a bar over the radicand. */
function Radical({ node, ctx }: { node: Extract<MathNode, { kind: "root" }>; ctx: Ctx }) {
  const indexSize = Math.max(9, Math.round(ctx.fontSize * 0.6));
  const bar = Math.max(1, Math.round(ctx.fontSize * 0.06));
  return (
    <View style={styles.scriptRow}>
      {node.index ? (
        <Text style={[leaf({ ...ctx, fontSize: indexSize }), { marginRight: -Math.round(indexSize * 0.45), marginBottom: Math.round(ctx.fontSize * 0.45) }]}>
          {node.index}
        </Text>
      ) : null}
      <Text style={leaf(ctx)}>√</Text>
      <View style={{ borderTopWidth: bar, borderTopColor: ctx.color, paddingLeft: 1, paddingRight: Math.round(ctx.fontSize * 0.12), marginLeft: 1 }}>
        <Text style={leaf(ctx)}>{renderNodes(node.content, ctx, false)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scriptRow: { flexDirection: "row", alignItems: "flex-end" },
  frac: { alignItems: "center" },
});
