"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { describeAiError } from "@/lib/ai";
import { explainMistake, type MistakeExplanation } from "@/lib/study-ai";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/math/math-text";

const cacheKey = (resultId: string, questionId: string) => `xebra:explain:${resultId}:${questionId}`;

function readCache(key: string): MistakeExplanation | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as MistakeExplanation) : null;
  } catch {
    return null;
  }
}

/**
 * AI tutor explanation of a wrong answer. Only render once the correct answer has been revealed
 * to the examinee (the exam's review and answer reveal settings already allow it).
 * Cached per result and question so reopening the review doesn't spend AI budget again.
 */
export function ExplainMistake({
  resultId,
  questionId,
  questionText,
  options,
  userAnswer,
  correctAnswers,
  explanation,
}: {
  resultId: string;
  questionId: string;
  questionText: string;
  options: string[];
  userAnswer: string[];
  correctAnswers: string[];
  explanation?: string;
}) {
  const key = cacheKey(resultId, questionId);
  const [result, setResult] = useState<MistakeExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResult(readCache(key));
    setError(null);
  }, [key]);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await explainMistake({ questionText, options, userAnswer, correctAnswers, explanation });
      setResult(res);
      try {
        localStorage.setItem(key, JSON.stringify(res));
      } catch {
        // Storage full or blocked: the explanation still shows for this visit
      }
    } catch (err) {
      setError(describeAiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="mt-3 space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm" aria-live="polite">
        <p className="flex items-center gap-1.5 font-medium"><Sparkles className="h-3.5 w-3.5 text-primary" /> AI tutor</p>
        {result.whyWrong && <p><span className="font-medium">What went wrong: </span><MathText text={result.whyWrong} /></p>}
        {result.whyCorrect && <p><span className="font-medium">Why the answer is right: </span><MathText text={result.whyCorrect} /></p>}
        {result.tip && <p className="text-muted-foreground"><span className="font-medium text-foreground">Tip: </span><MathText text={result.tip} /></p>}
        <p className="text-[11px] text-muted-foreground">AI explanations can be wrong. Your proctor&apos;s answer key is what counts.</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <Button variant="outline" size="sm" onClick={run} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
        Explain my mistake
      </Button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
