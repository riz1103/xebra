"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  questionTypeSchema,
  questionTypeCreateSchema,
  type QuestionTypeFormValues,
  type QuestionTypeCreateFormValues,
} from "@/lib/validations";
import {
  ALL_QUESTION_LAYOUTS,
  resolveQuestionLayout,
  type QuestionLayout,
} from "@/lib/question-layout";
import { LAYOUT_DESCRIPTIONS, LAYOUT_LABELS } from "@/lib/exam-blueprint";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { Plus, Pencil, Trash2, Loader2, HelpCircle, Layers } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { QuestionType } from "@/types";

export default function QuestionTypesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [enableOpen, setEnableOpen] = useState(false);
  const [editingType, setEditingType] = useState<QuestionType | null>(null);
  const [deleteType, setDeleteType] = useState<QuestionType | null>(null);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (user !== undefined && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, isAdmin, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["question-types", page],
    queryFn: () => api.getQuestionTypes({ page, size: DEFAULT_PAGE_SIZE }),
  });

  const { data: allTypesData } = useQuery({
    queryKey: ["question-types", "all"],
    queryFn: () => api.getQuestionTypes({ page: 1, size: 100 }),
    enabled: isAdmin,
  });

  const questionTypes = data?.data || [];
  const pagination = data?.pagination;
  const allTypes = allTypesData?.data || questionTypes;

  const enabledLayouts = useMemo(() => {
    const set = new Set<QuestionLayout>();
    for (const qt of allTypes) {
      set.add(resolveQuestionLayout(qt));
    }
    return set;
  }, [allTypes]);

  const missingLayouts = useMemo(
    () => ALL_QUESTION_LAYOUTS.filter((l) => !enabledLayouts.has(l)),
    [enabledLayouts]
  );

  const editForm = useForm<QuestionTypeFormValues>({
    resolver: zodResolver(questionTypeSchema),
    defaultValues: { name: "", description: "" },
  });

  const enableForm = useForm<QuestionTypeCreateFormValues>({
    resolver: zodResolver(questionTypeCreateSchema),
    defaultValues: {
      layout: missingLayouts[0] ?? "multiple_choice",
      name: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: QuestionTypeCreateFormValues) =>
      api.createQuestionType({
        layout: values.layout,
        name: values.name,
        description: values.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-types"] });
      toast.success("Layout enabled");
      closeEnable();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: QuestionTypeFormValues }) =>
      api.updateQuestionType(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-types"] });
      toast.success("Question type updated");
      closeEdit();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteQuestionType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-types"] });
      toast.success("Question type removed");
      setDeleteType(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const enableAllMutation = useMutation({
    mutationFn: async () => {
      for (const layout of missingLayouts) {
        await api.createQuestionType({
          layout,
          name: LAYOUT_LABELS[layout],
          description: LAYOUT_DESCRIPTIONS[layout],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-types"] });
      toast.success(
        missingLayouts.length === 1
          ? "Enabled 1 layout"
          : `Enabled ${missingLayouts.length} layouts`
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEnable = () => {
    const layout = missingLayouts[0] ?? "multiple_choice";
    enableForm.reset({
      layout,
      name: LAYOUT_LABELS[layout],
      description: LAYOUT_DESCRIPTIONS[layout],
    });
    setEnableOpen(true);
  };

  const closeEnable = () => {
    setEnableOpen(false);
    enableForm.reset();
  };

  const openEdit = (qt: QuestionType) => {
    setEditingType(qt);
    editForm.reset({ name: qt.name, description: qt.description });
  };

  const closeEdit = () => {
    setEditingType(null);
    editForm.reset();
  };

  const onSelectLayout = (layout: QuestionLayout) => {
    enableForm.setValue("layout", layout);
    enableForm.setValue("name", LAYOUT_LABELS[layout]);
    enableForm.setValue("description", LAYOUT_DESCRIPTIONS[layout]);
  };

  if (user !== undefined && !isAdmin) {
    return <DataTableSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Question Types</h1>
          <p className="text-muted-foreground">
            Enable the coded question formats your exams can use. Behavior is built into the product — you choose which layouts are available and how they are labeled.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {missingLayouts.length > 0 && (
            <Button
              variant="outline"
              onClick={() => enableAllMutation.mutate()}
              disabled={enableAllMutation.isPending}
              className="w-full sm:w-auto"
            >
              {enableAllMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Layers className="mr-2 h-4 w-4" />
              )}
              Enable all supported
            </Button>
          )}
          <Button
            onClick={openEnable}
            disabled={missingLayouts.length === 0}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" /> Enable layout
          </Button>
        </div>
      </div>

      {isLoading ? (
        <DataTableSkeleton rows={4} />
      ) : questionTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HelpCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No layouts enabled</h3>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
              Enable supported formats such as Multiple Choice or Essay. New formats cannot be invented here — they must be coded first.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button onClick={openEnable}>
                <Plus className="mr-2 h-4 w-4" /> Enable layout
              </Button>
              <Button
                variant="outline"
                onClick={() => enableAllMutation.mutate()}
                disabled={enableAllMutation.isPending}
              >
                {enableAllMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Layers className="mr-2 h-4 w-4" />
                )}
                Enable all supported
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {questionTypes.map((qt) => {
            const layout = resolveQuestionLayout(qt);
            return (
              <Card key={qt.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{qt.name}</CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                      {LAYOUT_LABELS[layout]}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">{qt.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">Created {formatDate(qt.createdAt)}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(qt)}>
                      <Pencil className="mr-1 h-3 w-3" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteType(qt)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pagination && (
        <Pagination pagination={pagination} onPageChange={setPage} />
      )}

      {/* Enable layout */}
      <Dialog open={enableOpen} onOpenChange={(open) => !open && closeEnable()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable layout</DialogTitle>
            <DialogDescription>
              Choose a supported question format. Only layouts that are not already enabled are listed.
            </DialogDescription>
          </DialogHeader>
          {missingLayouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">All supported layouts are already enabled.</p>
          ) : (
            <form onSubmit={enableForm.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <div className="space-y-2">
                <Label>Layout *</Label>
                <Select
                  value={enableForm.watch("layout")}
                  onValueChange={(v) => onSelectLayout(v as QuestionLayout)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a layout" />
                  </SelectTrigger>
                  <SelectContent>
                    {missingLayouts.map((layout) => (
                      <SelectItem key={layout} value={layout}>
                        {LAYOUT_LABELS[layout]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {enableForm.formState.errors.layout && (
                  <p className="text-xs text-destructive">{enableForm.formState.errors.layout.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Display name *</Label>
                <Input placeholder="e.g., Multiple Choice" {...enableForm.register("name")} />
                {enableForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{enableForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea placeholder="Describe this question type..." {...enableForm.register("description")} />
                {enableForm.formState.errors.description && (
                  <p className="text-xs text-destructive">{enableForm.formState.errors.description.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEnable}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enable
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit name / description */}
      <Dialog open={!!editingType} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit question type</DialogTitle>
            <DialogDescription>
              Change the display name or description. The coded layout cannot be changed.
            </DialogDescription>
          </DialogHeader>
          {editingType && (
            <form
              onSubmit={editForm.handleSubmit((values) =>
                updateMutation.mutate({ id: editingType.id, values })
              )}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Layout</Label>
                <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                  {LAYOUT_LABELS[resolveQuestionLayout(editingType)]}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Display name *</Label>
                <Input placeholder="e.g., Multiple Choice" {...editForm.register("name")} />
                {editForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{editForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea placeholder="Describe this question type..." {...editForm.register("description")} />
                {editForm.formState.errors.description && (
                  <p className="text-xs text-destructive">{editForm.formState.errors.description.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEdit}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteType} onOpenChange={() => setDeleteType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove question type</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &quot;{deleteType?.name}&quot; from the catalog? This cannot be undone. Types in use by exam questions cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteType && deleteMutation.mutate(deleteType.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
