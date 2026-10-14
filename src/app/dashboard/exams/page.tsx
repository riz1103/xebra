"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { Plus, Search, Pencil, Trash2, Eye, Clock, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { EXAM_ORIGIN_LABELS, ExamOriginBadge, examOrigin } from "@/components/exam-generator/exam-origin-badge";
import type { Exam, ExamOrigin } from "@/types";

export default function ExamsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState<ExamOrigin | "all">("all");
  const [page, setPage] = useState(1);
  const [deleteExam, setDeleteExam] = useState<Exam | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["exams", page, statusFilter],
    queryFn: () =>
      api.getExams({
        page,
        size: DEFAULT_PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteExam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam deleted successfully");
      setDeleteExam(null);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete exam"),
  });

  const items = data?.data || [];
  const pagination = data?.pagination;
  const exams = items.filter(
    (exam) =>
      exam.title.toLowerCase().includes(search.toLowerCase()) &&
      (originFilter === "all" || examOrigin(exam.origin) === originFilter)
  );

  const statusColors: Record<string, "success" | "secondary" | "outline"> = {
    active: "success",
    draft: "secondary",
    archived: "outline",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Exams</h1>
          <p className="text-muted-foreground">Create and manage your examinations.</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/exams/create">
            <Plus className="mr-2 h-4 w-4" /> Create Exam
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-4">
        <div className="relative col-span-2 sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search exams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={originFilter} onValueChange={(v) => setOriginFilter(v as ExamOrigin | "all")}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {(Object.keys(EXAM_ORIGIN_LABELS) as ExamOrigin[]).map((o) => (
              <SelectItem key={o} value={o}>{EXAM_ORIGIN_LABELS[o]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Exam List */}
      {isLoading ? (
        <DataTableSkeleton rows={6} />
      ) : exams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No exams found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search || statusFilter !== "all" || originFilter !== "all" ? "Try adjusting your filters." : "Create your first exam to get started."}
            </p>
            {!search && statusFilter === "all" && originFilter === "all" && (
              <Button asChild className="mt-4">
                <Link href="/dashboard/exams/create"><Plus className="mr-2 h-4 w-4" /> Create Exam</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <Card key={exam.id} className="group transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base line-clamp-2 leading-snug">{exam.title}</CardTitle>
                  <Badge variant={statusColors[exam.status] || "outline"} className="shrink-0">{exam.status}</Badge>
                </div>
                {exam.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{exam.description}</p>
                )}
                <div>
                  <ExamOriginBadge origin={exam.origin} className="text-[10px]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {exam.questionCount || 0} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {exam.timeLimit} min
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    Pass: {exam.passingCondition?.value || exam.passingScore || 0}
                    {exam.passingCondition?.type === "percentage" ? "%" : ` ${exam.passingCondition?.type || "points"}`}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild className="h-9 flex-1 sm:h-8">
                    <Link href={`/dashboard/exams/${exam.id}`}>
                      <Eye className="mr-1 h-3 w-3" /> View
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="h-9 sm:h-8" aria-label="Edit exam">
                    <Link href={`/dashboard/exams/${exam.id}/edit`}>
                      <Pencil className="h-3 w-3" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteExam(exam)}
                    className="h-9 text-destructive hover:text-destructive sm:h-8"
                    aria-label="Delete exam"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination && (
        <Pagination pagination={pagination} onPageChange={setPage} />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteExam} onOpenChange={() => setDeleteExam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteExam?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExam && deleteMutation.mutate(deleteExam.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
