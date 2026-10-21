export type QuestionLayout =
  | "multiple_choice"
  | "true_false"
  | "multiple_answer"
  | "identification"
  | "essay"
  | "ordering"
  | "matching"
  | "audio"
  | "hotspot";

const ALL: readonly string[] = [
  "multiple_choice",
  "true_false",
  "multiple_answer",
  "identification",
  "essay",
  "ordering",
  "matching",
  "audio",
  "hotspot",
];

export function getQuestionLayout(typeName: string): QuestionLayout {
  const name = typeName.toLowerCase().trim();
  if (name.includes("matching") || name.includes("match the") || name.includes("pairing")) return "matching";
  if (
    name.includes("ordering") ||
    name.includes("sequenc") ||
    name.includes("arrange") ||
    name.includes("put in order") ||
    name.includes("ranking")
  ) {
    return "ordering";
  }
  if (name.includes("audio") || name.includes("listening") || name.includes("hear")) return "audio";
  if (
    name.includes("hotspot") ||
    name.includes("image map") ||
    name.includes("click the") ||
    name.includes("point on") ||
    name.includes("click on image")
  ) {
    return "hotspot";
  }
  if (name.includes("true") && name.includes("false")) return "true_false";
  if (
    (name.includes("multiple") && (name.includes("answer") || name.includes("select") || name.includes("response"))) ||
    name.includes("checkbox") ||
    name.includes("multi-select") ||
    name.includes("check all")
  ) {
    return "multiple_answer";
  }
  if (
    name.includes("essay") ||
    name.includes("long answer") ||
    name.includes("open-ended") ||
    name.includes("free response") ||
    name.includes("open ended")
  ) {
    return "essay";
  }
  if (
    name.includes("identification") ||
    name.includes("fill in") ||
    name.includes("fill-in") ||
    name.includes("short answer") ||
    name.includes("enumeration") ||
    name.includes("type the answer") ||
    name.includes("blank")
  ) {
    return "identification";
  }
  return "multiple_choice";
}

export function resolveQuestionLayout(type: { name?: string | null; layout?: string | null } | undefined): QuestionLayout {
  if (!type) return "multiple_choice";
  if (type.layout && ALL.includes(type.layout)) return type.layout as QuestionLayout;
  return getQuestionLayout(type.name ?? "");
}
