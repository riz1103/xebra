"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { questionTypeSchema, type QuestionTypeFormValues } from "@/lib/validations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Plus, Pencil, Trash2, Loader2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { QuestionType } from "@/types";

export default function QuestionTypesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<QuestionType | null>(null);
  const [deleteType, setDeleteType] = useState<QuestionType | null>(null);
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (user !== undefined && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, isAdmin, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["question-types"],
    queryFn: () => api.getQuestionTypes(),
  });

  const form = useForm<QuestionTypeFormValues>({
    resolver: zodResolver(questionTypeSchema),
    defaultValues: { name: "", description: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: QuestionTypeFormValues) => api.createQuestionType(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-types"] });
      toast.success("Question type created");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: QuestionTypeFormValues }) =>
      api.updateQuestionType(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-types"] });
      toast.success("Question type updated");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteQuestionType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-types"] });
      toast.success("Question type deleted");
      setDeleteType(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingType(null);
    form.reset({ name: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (qt: QuestionType) => {
    setEditingType(qt);
    form.reset({ name: qt.name, description: qt.description });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingType(null);
    form.reset();
  };

  const onSubmit = (values: QuestionTypeFormValues) => {
    if (editingType) {
      updateMutation.mutate({ id: editingType.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const questionTypes = data?.data || [];

  if (user !== undefined && !isAdmin) {
    return <DataTableSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Question Types</h1>
          <p className="text-muted-foreground">Manage question categories for your exams.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Type
        </Button>
      </div>

      {isLoading ? (
        <DataTableSkeleton rows={4} />
      ) : questionTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HelpCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No question types</h3>
            <p className="text-sm text-muted-foreground mt-1">Create question types like &quot;Multiple Choice&quot;, &quot;True/False&quot;, etc.</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Type</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {questionTypes.map((qt) => (
            <Card key={qt.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{qt.name}</CardTitle>
                <CardDescription className="line-clamp-2">{qt.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Created {formatDate(qt.createdAt)}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(qt)}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleteType(qt)} className="text-destructive hover:text-destructive">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Question Type" : "Create Question Type"}</DialogTitle>
            <DialogDescription>
              {editingType ? "Update the question type details." : "Add a new question type for your exams."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input placeholder="e.g., Multiple Choice" {...form.register("name")} />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea placeholder="Describe this question type..." {...form.register("description")} />
              {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingType ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteType} onOpenChange={() => setDeleteType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteType?.name}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteType && deleteMutation.mutate(deleteType.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
