import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { QuestionMetadata } from "@/types";
import { MathText } from "@/components/math/math-text";
import { QuestionSource } from "./question-source";

/** Proctor-facing answer explanation, essay rubric, and AI-generation tags for a question. */
export function QuestionInsights({
  explanation,
  metadata,
  className = "",
}: {
  explanation?: string;
  metadata?: QuestionMetadata;
  className?: string;
}) {
  const ai = metadata?.ai;
  const rubric = ai?.rubric || metadata?.rubric;
  if (!explanation?.trim() && !ai && !rubric) return null;

  return (
    <div className={`space-y-1.5 rounded-md bg-muted/40 p-2.5 text-xs ${className}`}>
      {ai && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Sparkles className="h-2.5 w-2.5" /> AI generated
          </Badge>
          {ai.difficulty && <Badge variant="outline" className="text-[10px] capitalize">{ai.difficulty}</Badge>}
          {ai.cognitiveLevel && <Badge variant="outline" className="text-[10px] capitalize">{ai.cognitiveLevel}</Badge>}
          {ai.topic && <Badge variant="outline" className="text-[10px]">{ai.topic}</Badge>}
        </div>
      )}
      {explanation?.trim() && (
        <p>
          <span className="font-medium">Explanation: </span>
          <MathText text={explanation} className="text-muted-foreground" />
        </p>
      )}
      {rubric && (
        <p className="whitespace-pre-wrap">
          <span className="font-medium">Rubric: </span>
          <span className="text-muted-foreground">{rubric}</span>
        </p>
      )}
      {ai && <QuestionSource source={ai} />}
    </div>
  );
}
