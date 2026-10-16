"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { CheckCircle, Download, Library, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import { ANY, DIFFICULTIES, DIFFICULTY_BADGE } from "@/lib/question-bank";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { MathAnswerList, MathText } from "@/components/math/math-text";
import { BankQuestionDialog } from "@/components/question-bank/bank-question-dialog";
import { ImportToBankDialog } from "@/components/question-bank/import-to-bank-dialog";
import type { BankQuestion, QuestionDifficulty } from "@/types";
import { useT } from "@/lib/i18n";

function QuestionBankPageContent() {
  const t = useT();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("organizationId") || undefined;
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState(ANY);
  const [difficulty, setDifficulty] = useState(ANY);
  const [tag, setTag] = useState(ANY);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<BankQuestion | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = {
    search: search || undefined,
    topic: topic === ANY ? undefined : topic,
    difficulty: difficulty === ANY ? undefined : (difficulty as QuestionDifficulty),
    tag: tag === ANY ? undefined : tag,
    organizationId,
    page,
    size: DEFAULT_PAGE_SIZE,
  };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["question-bank", "list", params],
    queryFn: () => api.getBankQuestions(params),
    placeholderData: keepPreviousData,
  });
  const questions = data?.data ?? [];
  const facets = data?.facets;

  const { data: typesData } = useQuery({
    queryKey: ["question-types", "all"],
    queryFn: () => api.getQuestionTypes({ size: 100 }),
  });
  const typeName = (id: string) => typesData?.data?.find((t) => t.id === id)?.name;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBankQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-bank"] });
      toast.success("Removed from the bank");
      setDeleting(null);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not delete")),
  });

  const filterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  const hasFilters = !!search || topic !== ANY || difficulty !== ANY || tag !== ANY;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {organizationId ? t("bank.orgTitle") : t("bank.title")}
          </h1>
          <p className="text-muted-foreground">
            {organizationId ? t("bank.orgSubtitle") : t("bank.subtitle")}
          </p>
        </div>
        <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="mr-2 h-4 w-4" /> Import from exam
          </Button>
          <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New question
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_180px_140px_160px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search questions, options, topics or tags"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            aria-label="Search the question bank"
          />
        </div>
        <Select value={topic} onValueChange={filterChange(setTopic)}>
          <SelectTrigger aria-label="Filter by topic"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All topics</SelectItem>
            {facets?.topics.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.value} ({t.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={difficulty} onValueChange={filterChange(setDifficulty)}>
          <SelectTrigger aria-label="Filter by difficulty"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any difficulty</SelectItem>
            {DIFFICULTIES.map((d) => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tag} onValueChange={filterChange(setTag)}>
          <SelectTrigger aria-label="Filter by tag"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All tags</SelectItem>
            {facets?.tags.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.value} ({t.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <DataTableSkeleton rows={4} />
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Library className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">{hasFilters ? "No questions match" : "Your question bank is empty"}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {hasFilters
                ? "Try a different search or clear the filters."
                : "Import the questions of an exam you've already written, or add questions one by one."}
            </p>
            {!hasFilters && (
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => setImportOpen(true)}><Download className="mr-2 h-4 w-4" /> Import from exam</Button>
                <Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus className="mr-2 h-4 w-4" /> New question</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={`space-y-3 ${isFetching ? "opacity-70 transition-opacity" : ""}`}>
          <p className="text-sm text-muted-foreground">
            {data?.pagination?.total ?? questions.length} of {facets?.total ?? 0} question(s)
          </p>
          {questions.map((q) => {
            const answers = [q.correctAnswer].flat().filter(Boolean);
            return (
              <Card key={q.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <MathText text={q.questionText} className="min-w-0 break-words text-sm font-medium" />
                    <div className="-mr-2 -mt-1 flex shrink-0 items-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit question" onClick={() => { setEditing(q); setEditorOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Delete question" onClick={() => setDeleting(q)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {q.options.length > 0 ? (
                    <div className="grid gap-1 sm:grid-cols-2">
                      {q.options.map((opt, oi) => {
                        const correct = answers.includes(opt);
                        return (
                          <div key={oi} className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${correct ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : ""}`}>
                            <span className="w-5 shrink-0 text-xs text-muted-foreground">{String.fromCharCode(65 + oi)}.</span>
                            <MathText text={opt} className="min-w-0 break-words" />
                            {correct && <CheckCircle className="ml-auto h-3 w-3 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  ) : answers.length > 0 ? (
                    <p className="text-sm">
                      <span className="text-xs text-muted-foreground">Answer: </span>
                      <MathAnswerList answers={answers} className="font-medium text-emerald-700 dark:text-emerald-400" />
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {typeName(q.questionTypeId) && <Badge variant="secondary" className="text-xs">{typeName(q.questionTypeId)}</Badge>}
                    {q.topic && <Badge variant="outline" className="text-xs">{q.topic}</Badge>}
                    {q.difficulty && (
                      <Badge variant="outline" className={`text-xs capitalize ${DIFFICULTY_BADGE[q.difficulty]}`}>{q.difficulty}</Badge>
                    )}
                    {q.cognitiveLevel && <Badge variant="outline" className="text-xs capitalize">{q.cognitiveLevel}</Badge>}
                    {q.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs text-muted-foreground">#{t}</Badge>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {q.points} pt{q.points === 1 ? "" : "s"} · used in {q.usageCount} exam{q.usageCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {data?.pagination && <Pagination pagination={data.pagination} onPageChange={setPage} />}

      <BankQuestionDialog open={editorOpen} onOpenChange={setEditorOpen} question={editing} organizationId={organizationId} />
      <ImportToBankDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bank question</AlertDialogTitle>
            <AlertDialogDescription>
              It will no longer be available for new exams. Exams that already use it keep their copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleting) deleteMutation.mutate(deleting.id); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function QuestionBankPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <QuestionBankPageContent />
    </Suspense>
  );
}
