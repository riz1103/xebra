"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { examBundleSchema, type ExamBundleFormValues } from "@/lib/validations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Plus, Trash2, Loader2, Package, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { ExamBundle } from "@/types";

export default function BundlesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<ExamBundle | null>(null);
  const [deleteBundle, setDeleteBundle] = useState<ExamBundle | null>(null);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["bundles"],
    queryFn: () => api.getExamBundles(),
  });

  const { data: examsData } = useQuery({
    queryKey: ["exams"],
    queryFn: () => api.getExams(),
  });

  const form = useForm<ExamBundleFormValues>({
    resolver: zodResolver(examBundleSchema),
    defaultValues: { name: "", description: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: ExamBundleFormValues) =>
      api.createExamBundle({ ...values, examIds: selectedExamIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      toast.success("Bundle created");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ExamBundleFormValues }) =>
      api.updateExamBundle(id, { ...values, examIds: selectedExamIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      toast.success("Bundle updated");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteExamBundle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      toast.success("Bundle deleted");
      setDeleteBundle(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingBundle(null);
    form.reset({ name: "", description: "" });
    setSelectedExamIds([]);
    setDialogOpen(true);
  };

  const openEdit = (bundle: ExamBundle) => {
    setEditingBundle(bundle);
    form.reset({ name: bundle.name, description: bundle.description });
    setSelectedExamIds(bundle.examIds || []);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingBundle(null);
    form.reset();
    setSelectedExamIds([]);
  };

  const onSubmit = (values: ExamBundleFormValues) => {
    if (editingBundle) {
      updateMutation.mutate({ id: editingBundle.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const toggleExam = (examId: string) => {
    setSelectedExamIds((prev) =>
      prev.includes(examId) ? prev.filter((id) => id !== examId) : [...prev, examId]
    );
  };

  const bundles = data?.data || [];
  const exams = examsData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exam Bundles</h1>
          <p className="text-muted-foreground">Group multiple exams into bundles for batch invitations.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create Bundle
        </Button>
      </div>

      {isLoading ? (
        <DataTableSkeleton rows={4} />
      ) : bundles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No bundles yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create a bundle to group related exams together.</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Create Bundle</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => (
            <Card key={bundle.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  {bundle.name}
                </CardTitle>
                <CardDescription className="line-clamp-2">{bundle.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">
                    <FileText className="mr-1 h-3 w-3" />
                    {bundle.examIds?.length || 0} exams
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(bundle.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(bundle)} className="flex-1">
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleteBundle(bundle)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBundle ? "Edit Bundle" : "Create Bundle"}</DialogTitle>
            <DialogDescription>
              {editingBundle ? "Update bundle details and exams." : "Group exams together for batch management."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input placeholder="e.g., Final Exams Bundle" {...form.register("name")} />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea placeholder="Describe this bundle..." {...form.register("description")} />
              {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
            </div>
            {exams.length > 0 && (
              <div className="space-y-2">
                <Label>Include Exams</Label>
                <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
                  {exams.map((exam) => (
                    <label key={exam.id} className="flex items-center gap-2 cursor-pointer rounded p-1.5 hover:bg-muted/50">
                      <Checkbox checked={selectedExamIds.includes(exam.id)} onCheckedChange={() => toggleExam(exam.id)} />
                      <span className="text-sm">{exam.title}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">{exam.status}</Badge>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{selectedExamIds.length} exam(s) selected</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingBundle ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteBundle} onOpenChange={() => setDeleteBundle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bundle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This only removes the bundle grouping, not the exams themselves.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteBundle && deleteMutation.mutate(deleteBundle.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
