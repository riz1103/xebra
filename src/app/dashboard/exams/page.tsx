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
import type { Exam } from "@/types";

export default function ExamsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
  const exams = items.filter((exam) =>
    exam.title.toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, "success" | "secondary" | "outline"> = {
    active: "success",
    draft: "secondary",
    archived: "outline",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exams</h1>
          <p className="text-muted-foreground">Create and manage your examinations.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/exams/create">
            <Plus className="mr-2 h-4 w-4" /> Create Exam
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search exams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
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
              {search || statusFilter !== "all" ? "Try adjusting your filters." : "Create your first exam to get started."}
            </p>
            {!search && statusFilter === "all" && (
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
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base line-clamp-1">{exam.title}</CardTitle>
                  <Badge variant={statusColors[exam.status] || "outline"}>{exam.status}</Badge>
                </div>
                {exam.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{exam.description}</p>
                )}
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
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/dashboard/exams/${exam.id}`}>
                      <Eye className="mr-1 h-3 w-3" /> View
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/exams/${exam.id}/edit`}>
                      <Pencil className="h-3 w-3" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteExam(exam)}
                    className="text-destructive hover:text-destructive"
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
