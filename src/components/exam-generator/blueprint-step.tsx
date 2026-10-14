"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Info, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  COGNITIVE_LEVEL_LABELS,
  EDUCATION_LEVEL_LABELS,
  EXAM_PURPOSES,
  LARGE_POOL_WARNING,
  LAYOUT_LABELS,
  MAX_POOL_PER_LAYOUT,
  PURPOSE_PRESETS,
  QUESTION_LAYOUTS,
  applyPurpose,
  effectiveTimeLimit,
  estimateTimeLimit,
  itemsPerSession,
  passageQuestionTotal,
  setPoolEnabled,
  totalQuestions,
  type CognitiveLevel,
  type Difficulty,
  type EducationLevel,
  type ExamBlueprint,
  type ExamPurpose,
} from "@/lib/exam-blueprint";
import type { MaterialAnalysis } from "@/lib/exam-generator";
import type { QuestionLayout } from "@/lib/question-layout";

const CONTENT_TYPE_LABELS: Record<MaterialAnalysis["contentType"], string> = {
  lecture_notes: "Lecture notes",
  textbook: "Textbook",
  slides: "Slides",
  existing_exam: "Existing exam",
  reading_material: "Reading material",
  mixed: "Mixed material",
  description: "From your description",
};

function toInt(value: string, min: number, max: number): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function BlueprintStep({
  analysis,
  blueprint: bp,
  onChange,
  missingLayouts,
  canCreateTypes,
  creatingTypes,
  onCreateMissingTypes,
  mode = "create",
  allowPool = true,
  appendSettings,
}: {
  analysis: MaterialAnalysis;
  blueprint: ExamBlueprint;
  onChange: (bp: ExamBlueprint) => void;
  missingLayouts: QuestionLayout[];
  canCreateTypes: boolean;
  creatingTypes: boolean;
  onCreateMissingTypes: () => void;
  /** "append" adds questions to an existing exam, so exam-wide settings are hidden */
  mode?: "create" | "append";
  allowPool?: boolean;
  /** Placement and timing controls shown instead of the exam settings in append mode */
  appendSettings?: ReactNode;
}) {
  const set = <K extends keyof ExamBlueprint>(key: K, value: ExamBlueprint[K]) => onChange({ ...bp, [key]: value });
  const difficultyTotal = bp.difficultyMix.easy + bp.difficultyMix.medium + bp.difficultyMix.hard;
  const pool = allowPool && bp.usePool;
  const poolTotal = totalQuestions(bp);
  const perSession = itemsPerSession(bp);
  const countMax = pool ? MAX_POOL_PER_LAYOUT : 100;
  const passageTotal = passageQuestionTotal(bp);
  const fromDescription = analysis.contentType === "description";

  return (
    <div className="space-y-6">
      {/* What the AI found */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{analysis.subject}</span>
          <Badge variant="secondary">{analysis.audience || EDUCATION_LEVEL_LABELS[analysis.educationLevel]}</Badge>
          <Badge variant="secondary">{CONTENT_TYPE_LABELS[analysis.contentType] ?? analysis.contentType}</Badge>
          <Badge variant="secondary">{analysis.language}</Badge>
        </div>
        {analysis.request && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Your request: </span>
            {analysis.request}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{analysis.summary}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Recommendation: </span>
          {PURPOSE_PRESETS[analysis.recommendedPurpose].label}, about {analysis.recommendedItemCount} items. {analysis.rationale}
        </p>
        {analysis.containsExistingQuestions && (
          <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            This material already contains exam questions. To import them as written, close this and use &quot;Upload file&quot; instead.
          </p>
        )}
      </div>

      {/* Exam type */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Exam type</Label>
          <Select value={bp.purpose} onValueChange={(v) => onChange(applyPurpose(bp, v as ExamPurpose))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXAM_PURPOSES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PURPOSE_PRESETS[p].label}
                  {p === analysis.recommendedPurpose ? " (Recommended)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {PURPOSE_PRESETS[bp.purpose].description} Changing the type resets the question mix and settings below to its defaults.
          </p>
        </div>
        {mode === "create" && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Exam title</Label>
            <Input value={bp.title} onChange={(e) => set("title", e.target.value)} />
          </div>
        )}
        <div className="space-y-2">
          <Label>Subject</Label>
          <Input value={bp.subject} onChange={(e) => set("subject", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Examinee level</Label>
          <Select value={bp.educationLevel} onValueChange={(v) => set("educationLevel", v as EducationLevel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(EDUCATION_LEVEL_LABELS) as EducationLevel[]).map((l) => (
                <SelectItem key={l} value={l}>{EDUCATION_LEVEL_LABELS[l]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Language</Label>
          <Input value={bp.language} onChange={(e) => set("language", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Choices per question</Label>
          <Select value={String(bp.choicesPerQuestion)} onValueChange={(v) => set("choicesPerQuestion", Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>{n} options</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Topics */}
      {analysis.topics.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Topics to cover</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                set("topics", bp.topics.length === analysis.topics.length ? [] : analysis.topics.map((t) => t.name))
              }
            >
              {bp.topics.length === analysis.topics.length ? "Clear" : "Select all"}
            </Button>
          </div>
          <div className={`grid gap-2 ${fromDescription ? "" : "sm:grid-cols-2"}`}>
            {analysis.topics.map((topic) => (
              <label key={topic.name} className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  className="mt-0.5"
                  checked={bp.topics.includes(topic.name)}
                  onCheckedChange={(checked) =>
                    set("topics", checked ? [...bp.topics, topic.name] : bp.topics.filter((t) => t !== topic.name))
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{topic.name}</span>
                  {topic.keyPoints && topic.keyPoints.length > 0 && (
                    <span className="block text-xs text-muted-foreground">{topic.keyPoints.join(" · ")}</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground" title="Importance">{"●".repeat(Math.max(1, Math.min(5, topic.importance)))}</span>
              </label>
            ))}
          </div>
          {bp.topics.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No topics selected: questions will cover {fromDescription ? "all the topics above" : "the whole material"}.
            </p>
          )}
          {fromDescription && (
            <p className="text-xs text-muted-foreground">
              Questions are written from these topics and key points. To add or narrow topics, go back and refine your
              description, or use the extra instructions below.
            </p>
          )}
        </div>
      )}

      <Separator />

      {/* Question mix */}
      <div className="space-y-3">
        {allowPool && (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label>Generate a larger question pool</Label>
              <p className="text-xs text-muted-foreground">
                Write more questions than each session uses. Every examinee gets a random set from the pool.
              </p>
            </div>
            <Switch checked={bp.usePool} onCheckedChange={(v) => onChange(setPoolEnabled(bp, v))} />
          </div>
        )}
        <div className="flex items-center justify-between">
          <Label>Question mix</Label>
          <span className="text-xs text-muted-foreground">
            {pool ? `${poolTotal} in pool · ${perSession} per session` : `${poolTotal} items total`}
          </span>
        </div>
        <div className="space-y-2">
          <div
            className={`grid gap-2 text-xs text-muted-foreground ${pool ? "grid-cols-[1fr_5rem_5rem_5rem]" : "grid-cols-[1fr_5rem_5rem]"}`}
          >
            <span>Type</span>
            <span>{pool ? "In pool" : "Items"}</span>
            {pool && <span>Per session</span>}
            <span>Points each</span>
          </div>
          {QUESTION_LAYOUTS.map((layout) => (
            <div
              key={layout}
              className={`grid items-center gap-2 ${pool ? "grid-cols-[1fr_5rem_5rem_5rem]" : "grid-cols-[1fr_5rem_5rem]"}`}
            >
              <span className="text-sm">{LAYOUT_LABELS[layout]}</span>
              <Input
                type="number"
                min={0}
                max={countMax}
                value={bp.questionCounts[layout]}
                onChange={(e) =>
                  set("questionCounts", { ...bp.questionCounts, [layout]: toInt(e.target.value, 0, countMax) })
                }
              />
              {pool && (
                <Input
                  type="number"
                  min={0}
                  max={bp.questionCounts[layout]}
                  value={Math.min(bp.sessionCounts[layout], bp.questionCounts[layout])}
                  disabled={bp.questionCounts[layout] === 0}
                  onChange={(e) =>
                    set("sessionCounts", {
                      ...bp.sessionCounts,
                      [layout]: toInt(e.target.value, 0, bp.questionCounts[layout]),
                    })
                  }
                />
              )}
              <Input
                type="number"
                min={1}
                max={100}
                value={bp.pointsPerLayout[layout]}
                onChange={(e) =>
                  set("pointsPerLayout", { ...bp.pointsPerLayout, [layout]: toInt(e.target.value, 1, 100) })
                }
              />
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Reading comprehension passages</Label>
              <p className="text-xs text-muted-foreground">
                {fromDescription
                  ? "The AI writes original passages that suit the examinees and topics."
                  : analysis.hasReadingPassages
                    ? "The material has prose that works well for passages."
                    : "The material doesn't appear to have much prose for passages."}
              </p>
            </div>
            <Switch
              checked={bp.includePassages}
              onCheckedChange={(v) =>
                onChange({ ...bp, includePassages: v, passageCount: v && bp.passageCount === 0 ? 1 : bp.passageCount })
              }
            />
          </div>
          {bp.includePassages && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Passages</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={bp.passageCount}
                  onChange={(e) => set("passageCount", toInt(e.target.value, 1, 5))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Questions per passage</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={bp.questionsPerPassage}
                  onChange={(e) => set("questionsPerPassage", toInt(e.target.value, 1, 10))}
                />
              </div>
              {pool && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Passage questions per session (of {passageTotal})</Label>
                  <Input
                    type="number"
                    min={0}
                    max={passageTotal}
                    value={Math.min(bp.sessionPassageQuestions, passageTotal)}
                    onChange={(e) => set("sessionPassageQuestions", toInt(e.target.value, 0, passageTotal))}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        {pool && (
          <div className="space-y-1 text-xs text-muted-foreground">
            {perSession >= poolTotal && (
              <p className="text-amber-600 dark:text-amber-400">
                Each session uses the whole pool, so nothing is randomized. Lower the per-session counts.
              </p>
            )}
            {mode === "create" && !bp.splitIntoParts && (
              <p>
                Without parts, each session draws {perSession} questions at random from the whole pool, so the mix of
                question types can vary between examinees. Turn on &quot;Organize into parts&quot; to keep the exact mix.
              </p>
            )}
            {mode === "create" && bp.splitIntoParts && (
              <p>Each part draws its per-session count at random, so every examinee gets the same mix.</p>
            )}
            {poolTotal > LARGE_POOL_WARNING && (
              <p className="text-amber-600 dark:text-amber-400">
                Large pools take several minutes to generate and use more AI quota.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Difficulty & thinking skills */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Difficulty mix (%)</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
              <div key={d} className="space-y-1">
                <span className="text-xs capitalize text-muted-foreground">{d}</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={bp.difficultyMix[d]}
                  onChange={(e) => set("difficultyMix", { ...bp.difficultyMix, [d]: toInt(e.target.value, 0, 100) })}
                />
              </div>
            ))}
          </div>
          {difficultyTotal !== 100 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Adds up to {difficultyTotal}%; it will be scaled proportionally.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Thinking skills to target</Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(COGNITIVE_LEVEL_LABELS) as CognitiveLevel[]).map((level) => (
              <label key={level} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={bp.cognitiveFocus.includes(level)}
                  onCheckedChange={(checked) =>
                    set(
                      "cognitiveFocus",
                      checked ? [...bp.cognitiveFocus, level] : bp.cognitiveFocus.filter((c) => c !== level)
                    )
                  }
                />
                {COGNITIVE_LEVEL_LABELS[level]}
              </label>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      {mode === "append" && appendSettings}

      {/* Exam settings */}
      <div className="grid gap-4 sm:grid-cols-2">
        {mode === "create" && <ExamSettingsFields blueprint={bp} onChange={onChange} />}
        <div className="space-y-2 sm:col-span-2">
          <Label>Extra instructions for the AI (optional)</Label>
          <Textarea
            value={bp.additionalInstructions}
            onChange={(e) => set("additionalInstructions", e.target.value)}
            placeholder="e.g. Focus on chapter 3, include computation problems, use Philippine examples…"
            rows={3}
          />
        </div>
      </div>

      {missingLayouts.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/50 p-3 dark:border-amber-700 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="flex-1 space-y-2">
            <p className="text-sm">
              Your workspace has no question type for: {missingLayouts.map((l) => LAYOUT_LABELS[l]).join(", ")}.
              {canCreateTypes
                ? " Create them, or set those item counts to 0."
                : " Ask an admin to add them under Question Types, or set those item counts to 0."}
            </p>
            {canCreateTypes && (
              <Button type="button" size="sm" variant="outline" onClick={onCreateMissingTypes} disabled={creatingTypes}>
                {creatingTypes && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Create missing question types
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Exam-wide settings, only shown when the generator creates a new exam. */
function ExamSettingsFields({
  blueprint: bp,
  onChange,
}: {
  blueprint: ExamBlueprint;
  onChange: (bp: ExamBlueprint) => void;
}) {
  const set = <K extends keyof ExamBlueprint>(key: K, value: ExamBlueprint[K]) => onChange({ ...bp, [key]: value });
  const estimate = estimateTimeLimit(bp);

  return (
    <>
      <div className="flex items-center justify-between gap-4 sm:col-span-2">
        <div>
          <Label>Organize into parts by question type</Label>
          <p className="text-xs text-muted-foreground">Creates &quot;Part I: Multiple Choice&quot;, &quot;Part II: True or False&quot;, and so on.</p>
        </div>
        <Switch
          checked={bp.splitIntoParts}
          onCheckedChange={(v) => onChange({ ...bp, splitIntoParts: v, timeType: v ? bp.timeType : "per_exam" })}
        />
      </div>
      <div className="space-y-2">
        <Label>Timing</Label>
        <Select
          value={bp.timeType}
          onValueChange={(v) => set("timeType", v as ExamBlueprint["timeType"])}
          disabled={!bp.splitIntoParts}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="per_exam">One time limit for the whole exam</SelectItem>
            <SelectItem value="per_part">Separate time limit per part</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Time limit (minutes)</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            value={effectiveTimeLimit(bp)}
            disabled={bp.timeType === "per_part"}
            onChange={(e) => set("timeLimitOverride", toInt(e.target.value, 1, 600))}
          />
          {bp.timeLimitOverride !== null && bp.timeLimitOverride !== estimate && (
            <Button type="button" variant="outline" size="sm" onClick={() => set("timeLimitOverride", null)}>
              Use {estimate}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {bp.timeType === "per_part"
            ? "Each part gets its own estimated time; the total is their sum."
            : `Estimated from the items in one session: ${estimate} minutes.`}
        </p>
      </div>
      <div className="space-y-2">
        <Label>Passing score (%)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={bp.passingPercentage}
          onChange={(e) => set("passingPercentage", toInt(e.target.value, 0, 100))}
        />
      </div>
      <div className="space-y-2">
        <Label>Question order</Label>
        <Select value={bp.questionOrder} onValueChange={(v) => set("questionOrder", v as "random" | "fixed")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Fixed</SelectItem>
            <SelectItem value="random">Random</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-4 sm:col-span-2">
        <div>
          <Label>Let examinees review answers after submitting</Label>
          <p className="text-xs text-muted-foreground">Recommended for quizzes and practice exams.</p>
        </div>
        <Switch checked={bp.reviewableByExaminee} onCheckedChange={(v) => set("reviewableByExaminee", v)} />
      </div>
    </>
  );
}
