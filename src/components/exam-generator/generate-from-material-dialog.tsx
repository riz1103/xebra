"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { aiErrorDetail, describeAiError } from "@/lib/ai";
import { useAuthStore } from "@/stores/auth-store";
import {
  LAYOUT_DESCRIPTIONS,
  LAYOUT_LABELS,
  QUESTION_LAYOUTS,
  buildBlueprint,
  totalQuestions,
  type ExamBlueprint,
} from "@/lib/exam-blueprint";
import {
  analyzeMaterial,
  generateExam,
  generatedToSections,
  missingLayouts,
  transcribeSources,
  type AppliedExam,
  type GenerationResult,
  type MaterialAnalysis,
} from "@/lib/exam-generator";
import { extractSource, sourceFromText, type ExtractedSource } from "@/lib/source-extract";
import {
  defaultPlacement,
  placedBlueprint,
  targetPart,
  type AppendPlacement,
  type ExistingExamContext,
} from "@/lib/exam-append";
import type { QuestionLayout } from "@/lib/question-layout";
import type { QuestionType } from "@/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SourceStep } from "./source-step";
import { BlueprintStep } from "./blueprint-step";
import { ReviewStep } from "./review-step";
import { AppendSettings } from "./append-settings";

type Step = "sources" | "analyzing" | "blueprint" | "generating" | "review" | "saving";

function stepLabels(append: boolean): { steps: Step[]; label: string }[] {
  return [
    { steps: ["sources", "analyzing"], label: "Material" },
    { steps: ["blueprint", "generating"], label: append ? "Question settings" : "Exam settings" },
    { steps: ["review", "saving"], label: "Review" },
  ];
}

export interface GeneratedExamApplication {
  applied: AppliedExam;
  /** Blueprint the questions were generated from (placement applied in append mode) */
  blueprint: ExamBlueprint;
  analysis: MaterialAnalysis;
  /** Set in append mode */
  placement?: AppendPlacement;
}

function layoutsInUse(bp: ExamBlueprint): QuestionLayout[] {
  const layouts = QUESTION_LAYOUTS.filter((l) => bp.questionCounts[l] > 0);
  if (bp.includePassages && bp.passageCount > 0) layouts.push("multiple_choice");
  return layouts;
}

export function GenerateFromMaterialDialog({
  open,
  onOpenChange,
  questionTypes,
  onApply,
  existingExam,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionTypes: QuestionType[];
  /** May return a promise (e.g. saving to an existing exam); the dialog stays open until it settles */
  onApply: (
    application: GeneratedExamApplication,
    onProgress: (done: number, total: number) => void
  ) => void | Promise<void>;
  /** Adds questions to this exam instead of building a new one */
  existingExam?: ExistingExamContext;
}) {
  const append = !!existingExam;
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");
  const [step, setStep] = useState<Step>("sources");
  const [sources, setSources] = useState<ExtractedSource[]>([]);
  const [pendingFiles, setPendingFiles] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 1, label: "" });
  const [analysis, setAnalysis] = useState<MaterialAnalysis | null>(null);
  const [blueprint, setBlueprint] = useState<ExamBlueprint | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<{ message: string; detail: string } | null>(null);
  const [creatingTypes, setCreatingTypes] = useState(false);
  const [placement, setPlacement] = useState<AppendPlacement | null>(null);

  const showAiError = (err: unknown) => {
    console.error("AI exam generation failed:", err);
    const message = describeAiError(err);
    const detail = aiErrorDetail(err);
    setError({ message, detail: detail !== message ? detail : "" });
  };

  const busy = step === "analyzing" || step === "generating" || step === "saving";
  const activePlacement = existingExam ? (placement ?? defaultPlacement(existingExam)) : null;
  const effectiveBlueprint =
    blueprint && existingExam && activePlacement ? placedBlueprint(blueprint, existingExam, activePlacement) : blueprint;
  const missing = effectiveBlueprint ? missingLayouts(layoutsInUse(effectiveBlueprint), questionTypes) : [];

  const reset = () => {
    setStep("sources");
    setSources([]);
    setAnalysis(null);
    setBlueprint(null);
    setResult(null);
    setSelectedIds(new Set());
    setWarnings([]);
    setError(null);
    setPlacement(null);
  };

  const addFiles = async (files: File[]) => {
    setPendingFiles((n) => n + files.length);
    for (const file of files) {
      try {
        const source = await extractSource(file);
        setSources((prev) => [...prev, source]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Couldn't read ${file.name}`);
      } finally {
        setPendingFiles((n) => n - 1);
      }
    }
  };

  const analyze = async () => {
    setError(null);
    setStep("analyzing");
    try {
      const transcribed = await transcribeSources(sources, (done, total, label) => setProgress({ done, total, label }));
      setSources(transcribed.sources);
      setProgress({ done: 0, total: 1, label: "Analyzing subject, topics, and level…" });
      const { analysis: a, warnings: analysisWarnings } = await analyzeMaterial(transcribed.sources);
      setAnalysis(a);
      setWarnings([...transcribed.warnings, ...analysisWarnings]);
      setBlueprint(
        buildBlueprint({
          purpose: a.recommendedPurpose,
          title: a.title,
          subject: a.subject,
          educationLevel: a.educationLevel,
          language: a.language || "English",
          topics: a.topics.map((t) => t.name),
          recommendedItemCount: a.recommendedItemCount,
          recommendedLayouts: a.recommendedLayouts,
          hasReadingPassages: a.hasReadingPassages,
        })
      );
      setStep("blueprint");
    } catch (err) {
      showAiError(err);
      setStep("sources");
    }
  };

  const generate = async () => {
    if (!analysis || !effectiveBlueprint) return;
    setError(null);
    setStep("generating");
    try {
      const res = await generateExam(
        sources,
        analysis,
        effectiveBlueprint,
        (done, total, label) => setProgress({ done, total, label }),
        { existingQuestions: existingExam?.questions.map((q) => q.questionText) }
      );
      setResult(res);
      setSelectedIds(new Set(res.questions.map((q) => q.id)));
      setStep("review");
    } catch (err) {
      showAiError(err);
      setStep("blueprint");
    }
  };

  const createMissingTypes = async () => {
    setCreatingTypes(true);
    try {
      for (const layout of missing) {
        await api.createQuestionType({ name: LAYOUT_LABELS[layout], description: LAYOUT_DESCRIPTIONS[layout] });
      }
      await queryClient.invalidateQueries({ queryKey: ["question-types"] });
      toast.success("Question types created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create question types");
    } finally {
      setCreatingTypes(false);
    }
  };

  const apply = async () => {
    if (!result || !effectiveBlueprint || !analysis) return;
    const selected = { ...result, questions: result.questions.filter((q) => selectedIds.has(q.id)) };
    const applied = generatedToSections(
      selected,
      effectiveBlueprint,
      questionTypes,
      existingExam && activePlacement
        ? { existingPartCount: existingExam.parts.length, targetPart: targetPart(existingExam, activePlacement) }
        : {}
    );
    setError(null);
    setStep("saving");
    setProgress({ done: 0, total: 1, label: "Adding questions…" });
    try {
      await onApply(
        { applied, blueprint: effectiveBlueprint, analysis, placement: activePlacement ?? undefined },
        (done, total) => setProgress({ done, total, label: `Saving question ${done} of ${total}…` })
      );
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error("Adding generated questions failed:", err);
      setError({ message: err instanceof Error ? err.message : "Couldn't add the questions.", detail: "" });
      setStep("review");
    }
  };

  const requestedCount = effectiveBlueprint ? totalQuestions(effectiveBlueprint) : 0;
  const STEP_LABELS = stepLabels(append);
  const activeStepIndex = STEP_LABELS.findIndex((s) => s.steps.includes(step));

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> {append ? "Add questions from material" : "Generate exam from material"}
          </DialogTitle>
          <DialogDescription>
            {append
              ? "Upload lectures, book pages, or slides. The AI writes new questions from them and avoids repeating the exam's existing questions."
              : "Upload lectures, book pages, or slides. The AI reads them, recommends the exam type and settings, then writes the questions."}
          </DialogDescription>
          <ol className="flex items-center gap-2 pt-2 text-xs">
            {STEP_LABELS.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                    i <= activeStepIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={i === activeStepIndex ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
                {i < STEP_LABELS.length - 1 && <span className="text-muted-foreground">›</span>}
              </li>
            ))}
          </ol>
        </DialogHeader>

        <div className="-mx-6 min-h-0 flex-1 space-y-4 overflow-y-auto px-6">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 space-y-1">
                <p>{error.message}</p>
                {error.detail && (
                  <p className="break-words font-mono text-[11px] text-destructive/80">{error.detail}</p>
                )}
              </div>
            </div>
          )}

          {step === "sources" && (
            <SourceStep
              sources={sources}
              extracting={pendingFiles > 0}
              onAddFiles={addFiles}
              onAddText={(text) => setSources((prev) => [...prev, sourceFromText(text)])}
              onRemove={(id) => setSources((prev) => prev.filter((s) => s.id !== id))}
            />
          )}

          {busy && (
            <div className="space-y-3 py-10 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">{progress.label}</p>
              {progress.total > 1 && (
                <>
                  <Progress value={(progress.done / progress.total) * 100} className="mx-auto max-w-sm" />
                  {step !== "saving" && (
                    <p className="text-xs text-muted-foreground">
                      {progress.done} of {progress.total} batches
                    </p>
                  )}
                </>
              )}
              {step !== "saving" && <p className="text-xs text-muted-foreground">This can take a minute for large material.</p>}
            </div>
          )}

          {step === "blueprint" && analysis && blueprint && (
            <>
              {warnings.map((w) => (
                <p key={w} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                </p>
              ))}
              <BlueprintStep
                analysis={analysis}
                blueprint={blueprint}
                onChange={setBlueprint}
                missingLayouts={missing}
                canCreateTypes={isAdmin}
                creatingTypes={creatingTypes}
                onCreateMissingTypes={createMissingTypes}
                mode={append ? "append" : "create"}
                allowPool={!activePlacement || activePlacement.target.kind === "new_parts"}
                appendSettings={
                  existingExam && activePlacement && effectiveBlueprint ? (
                    <AppendSettings
                      exam={existingExam}
                      blueprint={effectiveBlueprint}
                      placement={activePlacement}
                      onChange={setPlacement}
                    />
                  ) : undefined
                }
              />
            </>
          )}

          {step === "review" && result && (
            <ReviewStep result={result} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} />
          )}
        </div>

        {!busy && (
          <DialogFooter className="gap-2 sm:gap-2">
            {step === "sources" && (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={analyze} disabled={sources.length === 0 || pendingFiles > 0}>
                  <Sparkles className="mr-1.5 h-4 w-4" /> Analyze material
                </Button>
              </>
            )}
            {step === "blueprint" && (
              <>
                <Button type="button" variant="outline" onClick={() => setStep("sources")}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Material
                </Button>
                <Button type="button" onClick={generate} disabled={requestedCount === 0 || missing.length > 0}>
                  <Sparkles className="mr-1.5 h-4 w-4" /> Generate {requestedCount} questions
                </Button>
              </>
            )}
            {step === "review" && (
              <>
                <Button type="button" variant="outline" onClick={() => setStep("blueprint")}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Settings
                </Button>
                <Button type="button" onClick={apply} disabled={selectedIds.size === 0}>
                  {append ? `Save ${selectedIds.size} questions to exam` : `Add ${selectedIds.size} questions to exam`}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
