"use client";

import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { resultOutcomeLabel } from "@/lib/results-export";
import type { ExamResult } from "@/types";

function passingRequirement(condition: ExamResult["passingCondition"] | null | undefined) {
  if (!condition) return null;
  if (condition.type === "percentage") return `${condition.value}%`;
  if (condition.type === "points") return `${condition.value} points`;
  return `${condition.value} correct answers`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed py-1.5 last:border-0">
      <dt className="text-muted-foreground print:text-neutral-600">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default function ResultSlipPage({ params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = use(params);
  const { user } = useAuthStore();
  const isStaff = user?.role === "proctor" || user?.role === "admin";
  const backHref = isStaff ? "/dashboard/results" : `/dashboard/my-results/${resultId}`;

  const { data, isLoading } = useQuery({
    queryKey: ["exam-result", resultId],
    queryFn: () => api.getExamResult(resultId),
  });
  const result = data?.data;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg font-medium">Result not found</p>
        <Button asChild className="mt-4"><Link href={backHref}>Back</Link></Button>
      </div>
    );
  }

  const outcome = resultOutcomeLabel(result);
  const awaiting = outcome === "Awaiting grading";
  const parts = Object.values(result.partResults || {});
  const requirement = passingRequirement(result.passingCondition);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print or save as PDF
        </Button>
      </div>

      <article className="rounded-lg border bg-card p-6 text-sm shadow-sm sm:p-8 print:rounded-none print:border-0 print:p-0 print:text-black print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <Image src="/xevra-logo.png" alt="Xevra" width={40} height={40} className="rounded-lg" />
            <div>
              <p className="text-lg font-bold tracking-tight">XEVRA</p>
              <p className="text-xs text-muted-foreground print:text-neutral-600">Examination Result Slip</p>
            </div>
          </div>
          <div
            className={`rounded-md border-2 px-3 py-1 text-sm font-bold uppercase ${
              awaiting
                ? "border-amber-500 text-amber-700"
                : result.passed
                  ? "border-emerald-600 text-emerald-700"
                  : "border-red-600 text-red-700"
            }`}
          >
            {outcome}
          </div>
        </header>

        <section className="mt-4">
          <h1 className="text-xl font-bold break-words">{result.examTitle || "Exam"}</h1>
          <dl className="mt-3">
            <Row label="Examinee" value={result.examineeName || "N/A"} />
            {result.examineeEmail && <Row label="Email" value={<span className="break-all">{result.examineeEmail}</span>} />}
            {result.startedAt && <Row label="Started" value={formatDate(result.startedAt)} />}
            <Row label="Submitted" value={formatDate(result.submittedAt || result.createdAt)} />
            {result.timeSpentMinutes != null && result.timeSpentMinutes >= 0 && (
              <Row
                label="Time spent"
                value={`${result.timeSpentMinutes} min${result.timeLimitMinutes ? ` of ${result.timeLimitMinutes} min` : ""}`}
              />
            )}
          </dl>
        </section>

        <section className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md border p-3">
            <p className="text-2xl font-bold">{result.percentage}%</p>
            <p className="text-xs text-muted-foreground print:text-neutral-600">Percentage</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-2xl font-bold">{result.score}/{result.totalPoints}</p>
            <p className="text-xs text-muted-foreground print:text-neutral-600">Points</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-2xl font-bold">{result.correctCount ?? result.correctAnswers ?? 0}/{result.totalQuestions}</p>
            <p className="text-xs text-muted-foreground print:text-neutral-600">Correct</p>
          </div>
        </section>

        {requirement && (
          <p className="mt-3 text-xs text-muted-foreground print:text-neutral-600">Passing requirement: {requirement}</p>
        )}
        {awaiting && (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 print:bg-transparent">
            {result.pendingReviewCount === 1 ? "1 written answer is" : `${result.pendingReviewCount ?? "Some"} written answers are`} still
            being graded. The score shown is provisional.
          </p>
        )}

        {parts.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-semibold">Results by part</h2>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b text-xs text-muted-foreground print:text-neutral-600">
                  <th className="py-1.5 font-medium">Part</th>
                  <th className="py-1.5 text-right font-medium">Score</th>
                  <th className="py-1.5 text-right font-medium">%</th>
                  <th className="py-1.5 text-right font-medium">Correct</th>
                  <th className="py-1.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => (
                  <tr key={part.partId} className="border-b border-dashed last:border-0">
                    <td className="py-1.5 pr-2">{part.partName}</td>
                    <td className="py-1.5 text-right">{part.score}/{part.totalPoints}</td>
                    <td className="py-1.5 text-right">{part.percentage}%</td>
                    <td className="py-1.5 text-right">{part.correctCount}/{part.totalQuestions}</td>
                    <td className="py-1.5 text-right font-medium">
                      {awaiting ? "—" : part.passed ? "Passed" : "Failed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {result.feedback && (
          <section className="mt-6">
            <h2 className="mb-1 font-semibold">Proctor feedback</h2>
            <p className="whitespace-pre-wrap">{result.feedback}</p>
          </section>
        )}

        <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t pt-3 text-[11px] text-muted-foreground print:text-neutral-500">
          <span>Result ID: {result.id}</span>
          <span>Printed {formatDate(new Date())}</span>
        </footer>
      </article>
    </div>
  );
}
