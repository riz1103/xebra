"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { describeAiError } from "@/lib/ai";
import { suggestEssayGrade } from "@/lib/essay-grading";
import type { ExamQuestion, GradeQuestionPayload, ManualGrade, QuestionResult } from "@/types";
import { Loader2, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface GradingPanelProps {
  question: ExamQuestion;
  answer: string | string[] | null | undefined;
  questionResult: QuestionResult | undefined;
  manualGrade: ManualGrade | undefined;
  saving: boolean;
  onSave: (grade: GradeQuestionPayload) => void;
}

function answerText(answer: GradingPanelProps["answer"]): string {
  if (Array.isArray(answer)) return answer.filter(Boolean).join("\n");
  return typeof answer === "string" ? answer.trim() : "";
}

export function GradingPanel({ question, answer, questionResult, manualGrade, saving, onSave }: GradingPanelProps) {
  const points = Number(questionResult?.points ?? question.points) || 0;
  const initialScore = manualGrade?.score ?? (questionResult?.pendingReview ? null : questionResult?.score ?? null);
  const [score, setScore] = useState(initialScore == null ? "" : String(initialScore));
  const [feedback, setFeedback] = useState(manualGrade?.feedback ?? "");
  const [aiReasoning, setAiReasoning] = useState("");
  const [aiSuggested, setAiSuggested] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    setScore(initialScore == null ? "" : String(initialScore));
    setFeedback(manualGrade?.feedback ?? "");
    setAiReasoning("");
    setAiSuggested(false);
    // Reset when moving to another question or after the saved grade comes back
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, manualGrade?.score, manualGrade?.feedback, questionResult?.pendingReview]);

  const text = answerText(answer);
  const canSuggest = text.length > 0 && (question.options?.length ?? 0) === 0;
  const parsedScore = score.trim() === "" ? NaN : Number(score);
  const scoreValid = Number.isFinite(parsedScore) && parsedScore >= 0 && parsedScore <= points;

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const suggestion = await suggestEssayGrade({
        questionText: question.questionText,
        answer: text,
        points,
        rubric: question.metadata?.ai?.rubric || question.metadata?.rubric,
        referenceAnswer: Array.isArray(question.correctAnswer)
          ? question.correctAnswer.join("; ")
          : question.correctAnswer || undefined,
        explanation: question.explanation,
      });
      setScore(String(suggestion.score));
      setFeedback(suggestion.feedback);
      setAiReasoning(suggestion.reasoning);
      setAiSuggested(true);
    } catch (err) {
      toast.error(describeAiError(err));
    } finally {
      setSuggesting(false);
    }
  };

  const save = (value: number) =>
    onSave({ questionId: question.id, score: value, feedback: feedback.trim() || undefined, aiSuggested });

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-dashed p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Grade this answer</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {questionResult?.pendingReview && (
            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 text-xs">
              Needs grading
            </Badge>
          )}
          {manualGrade && (
            <Badge variant="secondary" className="text-xs">
              Graded {manualGrade.score}/{points}
              {manualGrade.aiSuggested ? " (AI-assisted)" : ""}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`score-${question.id}`} className="text-xs">
            Score (0–{points})
          </Label>
          <Input
            id={`score-${question.id}`}
            type="number"
            inputMode="decimal"
            min={0}
            max={points}
            step={0.5}
            value={score}
            onChange={(e) => {
              setScore(e.target.value);
              setAiSuggested(false);
            }}
            className="h-9 w-24"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setScore(String(points))}>
          Full credit
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setScore("0")}>
          No credit
        </Button>
        {canSuggest && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleSuggest} disabled={suggesting}>
            {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI suggest
          </Button>
        )}
      </div>

      {aiReasoning && (
        <p className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">AI reasoning: </span>
          {aiReasoning} Review the score before saving.
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor={`feedback-${question.id}`} className="text-xs">
          Feedback for the examinee (optional)
        </Label>
        <Textarea
          id={`feedback-${question.id}`}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          maxLength={5000}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => save(parsedScore)} disabled={!scoreValid || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save grade
        </Button>
        {manualGrade && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            disabled={saving}
            onClick={() => onSave({ questionId: question.id, score: null })}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Remove manual grade
          </Button>
        )}
        {!scoreValid && score.trim() !== "" && (
          <span className="text-xs text-destructive">Enter a score between 0 and {points}.</span>
        )}
      </div>
    </div>
  );
}
