"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import {
  examInvitationSchema, groupInvitationSchema,
  bundleInvitationSchema, bundleGroupInvitationSchema,
  type ExamInvitationFormValues, type GroupInvitationFormValues,
  type BundleInvitationFormValues,
} from "@/lib/validations";
import type { CreateBundleGroupInvitationPayload, CreateExamInvitationPayload, CreateGroupInvitationPayload, CreateBundleInvitationPayload } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, Mail, XCircle, Search, Package, FileText, FileUp, Timer, Accessibility } from "lucide-react";
import { BulkInviteDialog } from "@/components/invitations/bulk-invite-dialog";
import { AccommodationsDialog } from "@/components/invitations/accommodations-dialog";
import { formatMultiplier } from "@/components/invitations/time-multiplier-select";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { ExamInvitation } from "@/types";

function AllowRetakeAfterPassField({ control }: { control: Control<any> }) {
  return (
    <Controller
      control={control}
      name="allowRetakeAfterPass"
      render={({ field }) => (
        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <Checkbox
            checked={field.value === true}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Allow retakes after a pass</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              The examinee can use every remaining attempt even after they pass. Without this, passing ends the invitation.
            </span>
          </span>
        </label>
      )}
    />
  );
}

type InviteTarget = "exam" | "bundle";
type InviteRecipient = "individual" | "group";

const CANCELLABLE_STATUSES = ["pending", "accepted", "active"];

export default function InvitationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [accommodationsTarget, setAccommodationsTarget] = useState<ExamInvitation | null>(null);
  const [inviteTarget, setInviteTarget] = useState<InviteTarget>("exam");
  const [inviteRecipient, setInviteRecipient] = useState<InviteRecipient>("individual");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<ExamInvitation | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["invitations", page, statusFilter],
    queryFn: () =>
      api.getExamInvitations({
        page,
        size: DEFAULT_PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const { data: examsData } = useQuery({ queryKey: ["exams"], queryFn: () => api.getExams() });
  const { data: groupsData } = useQuery({ queryKey: ["groups"], queryFn: () => api.getExamineeGroups() });
  const { data: bundlesData } = useQuery({ queryKey: ["bundles"], queryFn: () => api.getExamBundles() });

  // Default expiry: 7 days from now
  const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  // Helper function to convert datetime-local to ISO string
  const toISOString = (datetimeLocal?: string): string | undefined => {
    if (!datetimeLocal) return undefined;
    return new Date(datetimeLocal).toISOString();
  };

  // --- Forms ---
  const examIndividualForm = useForm<ExamInvitationFormValues>({
    resolver: zodResolver(examInvitationSchema),
    defaultValues: { examId: "", examineeEmail: "", expiresAt: defaultExpiry, maxAttempts: 1, allowRetakeAfterPass: false, scheduledStartTime: "", scheduledEndTime: "" },
  });

  const examGroupForm = useForm<GroupInvitationFormValues>({
    resolver: zodResolver(groupInvitationSchema),
    defaultValues: { examId: "", groupId: "", expiresAt: defaultExpiry, maxAttempts: 1, allowRetakeAfterPass: false, scheduledStartTime: "", scheduledEndTime: "" },
  });

  const bundleIndividualForm = useForm<BundleInvitationFormValues>({
    resolver: zodResolver(bundleInvitationSchema),
    defaultValues: { bundleId: "", examineeEmail: "", expiresAt: defaultExpiry, maxAttempts: 1, allowRetakeAfterPass: false, scheduledStartTime: "", scheduledEndTime: "" },
  });

  const bundleGroupForm = useForm({
    resolver: zodResolver(bundleGroupInvitationSchema),
    defaultValues: { bundleId: "", groupId: "", expiresAt: defaultExpiry, maxAttempts: 1, allowRetakeAfterPass: false, scheduledStartTime: "", scheduledEndTime: "" },
  });

  // --- Mutations ---
  const examIndividualMutation = useMutation({
    mutationFn: (v: ExamInvitationFormValues) => {
      // If scheduledEndTime is provided, use it as expiresAt
      const expiresAt = v.scheduledEndTime ? new Date(v.scheduledEndTime).toISOString() : new Date(v.expiresAt).toISOString();
      const payload: CreateExamInvitationPayload = {
        examId: v.examId,
        examineeEmail: v.examineeEmail,
        expiresAt,
        maxAttempts: v.maxAttempts,
        allowRetakeAfterPass: v.allowRetakeAfterPass === true,
        scheduledStartTime: toISOString(v.scheduledStartTime),
        scheduledEndTime: toISOString(v.scheduledEndTime),
      };
      return api.createExamInvitation(payload);
    },
    onSuccess: () => { onMutationSuccess("Invitation sent"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const examGroupMutation = useMutation({
    mutationFn: (v: GroupInvitationFormValues) => {
      // If scheduledEndTime is provided, use it as expiresAt
      const expiresAt = v.scheduledEndTime ? new Date(v.scheduledEndTime).toISOString() : new Date(v.expiresAt).toISOString();
      const payload: CreateGroupInvitationPayload = {
        examId: v.examId,
        groupId: v.groupId,
        expiresAt,
        maxAttempts: v.maxAttempts,
        allowRetakeAfterPass: v.allowRetakeAfterPass === true,
        scheduledStartTime: toISOString(v.scheduledStartTime),
        scheduledEndTime: toISOString(v.scheduledEndTime),
      };
      return api.createGroupInvitation(payload);
    },
    onSuccess: () => { onMutationSuccess("Group invitations sent"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const bundleIndividualMutation = useMutation({
    mutationFn: (v: BundleInvitationFormValues) => {
      // If scheduledEndTime is provided, use it as expiresAt
      const expiresAt = v.scheduledEndTime ? new Date(v.scheduledEndTime).toISOString() : new Date(v.expiresAt).toISOString();
      const payload: CreateBundleInvitationPayload = {
        bundleId: v.bundleId,
        examineeEmail: v.examineeEmail,
        expiresAt,
        maxAttempts: v.maxAttempts,
        allowRetakeAfterPass: v.allowRetakeAfterPass === true,
        scheduledStartTime: toISOString(v.scheduledStartTime),
        scheduledEndTime: toISOString(v.scheduledEndTime),
      };
      return api.createBundleInvitation(payload);
    },
    onSuccess: () => { onMutationSuccess("Bundle invitations sent"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const bundleGroupMutation = useMutation({
    mutationFn: (v: CreateBundleGroupInvitationPayload) => {
      // If scheduledEndTime is provided, use it as expiresAt
      const expiresAt = v.scheduledEndTime ? new Date(v.scheduledEndTime).toISOString() : new Date(v.expiresAt).toISOString();
      const payload: CreateBundleGroupInvitationPayload = {
        bundleId: v.bundleId,
        groupId: v.groupId,
        expiresAt,
        maxAttempts: v.maxAttempts,
        allowRetakeAfterPass: v.allowRetakeAfterPass === true,
        scheduledStartTime: toISOString(v.scheduledStartTime),
        scheduledEndTime: toISOString(v.scheduledEndTime),
      };
      return api.createBundleGroupInvitation(payload);
    },
    onSuccess: () => { onMutationSuccess("Bundle group invitations sent"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelExamInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Invitation cancelled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onMutationSuccess(message: string) {
    queryClient.invalidateQueries({ queryKey: ["invitations"] });
    toast.success(message);
    setDialogOpen(false);
    examIndividualForm.reset({ examId: "", examineeEmail: "", expiresAt: defaultExpiry, maxAttempts: 1, allowRetakeAfterPass: false, scheduledStartTime: "", scheduledEndTime: "" });
    examGroupForm.reset({ examId: "", groupId: "", expiresAt: defaultExpiry, maxAttempts: 1, allowRetakeAfterPass: false, scheduledStartTime: "", scheduledEndTime: "" });
    bundleIndividualForm.reset({ bundleId: "", examineeEmail: "", expiresAt: defaultExpiry, maxAttempts: 1, allowRetakeAfterPass: false, scheduledStartTime: "", scheduledEndTime: "" });
    bundleGroupForm.reset({ bundleId: "", groupId: "", expiresAt: defaultExpiry, maxAttempts: 1, allowRetakeAfterPass: false, scheduledStartTime: "", scheduledEndTime: "" });
  }

  const isPending =
    examIndividualMutation.isPending || examGroupMutation.isPending ||
    bundleIndividualMutation.isPending || bundleGroupMutation.isPending;

  const items = data?.data || [];
  const pagination = data?.pagination;
  const invitations = items.filter((inv) => {
    const matchesSearch =
      (inv.examineeEmail || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.examTitle || "").toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const exams = examsData?.data || [];
  const groups = groupsData?.data || [];
  const bundles = bundlesData?.data || [];

  const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
    pending: "warning",
    accepted: "default",
    active: "success",
    used: "success",
    expired: "secondary",
    revoked: "destructive",
  };

  const canCancel = (inv: ExamInvitation) => CANCELLABLE_STATUSES.includes(inv.status);

  const handleConfirmCancel = () => {
    if (cancelTarget) {
      cancelMutation.mutate(cancelTarget.id);
      setCancelTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Invitations</h1>
          <p className="text-muted-foreground">Invite examinees to take exams or exam bundles.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="w-full sm:w-auto">
            <FileUp className="mr-2 h-4 w-4" /> Bulk invite (CSV)
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Send Invitation
          </Button>
        </div>
      </div>

      <BulkInviteDialog open={bulkOpen} onOpenChange={setBulkOpen} exams={exams} bundles={bundles} />
      <AccommodationsDialog invitation={accommodationsTarget} onOpenChange={(open) => !open && setAccommodationsTarget(null)} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search invitations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="used">Used</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <DataTableSkeleton rows={6} />
      ) : invitations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No invitations</h3>
            <p className="text-sm text-muted-foreground mt-1">Send invitations to allow examinees to take exams.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invitations.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-sm break-all">{inv.examineeEmail}</p>
                    <Badge variant={statusColors[inv.status] || "outline"} className="text-xs">{inv.status}</Badge>
                    {inv.bundleId && (
                      <Badge variant="outline" className="text-xs">
                        <Package className="mr-1 h-3 w-3" /> Bundle
                      </Badge>
                    )}
                    {inv.allowRetakeAfterPass && (
                      <Badge variant="secondary" className="text-xs">Retake after pass</Badge>
                    )}
                    {inv.accommodations && inv.accommodations.timeMultiplier > 1 && (
                      <Badge variant="secondary" className="text-xs" title={inv.accommodations.note || undefined}>
                        <Timer className="mr-1 h-3 w-3" /> {formatMultiplier(inv.accommodations.timeMultiplier)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Exam: {inv.examTitle || inv.examId} &middot; Attempts: {inv.currentAttempts ?? inv.attemptsUsed ?? 0}/{inv.maxAttempts} &middot; Expires: {formatDate(inv.expiresAt)}
                    {inv.scheduledStartTime && (
                      <> &middot; Starts: {formatDate(inv.scheduledStartTime)}</>
                    )}
                    {inv.scheduledEndTime && (
                      <> &middot; Ends: {formatDate(inv.scheduledEndTime)}</>
                    )}
                  </p>
                </div>
                {canCancel(inv) && (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setAccommodationsTarget(inv)}>
                    <Accessibility className="mr-1 h-3 w-3" /> Accommodations
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCancelTarget(inv)}
                    disabled={cancelMutation.isPending}
                    className="w-full shrink-0 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                  >
                    {cancelMutation.isPending && cancelTarget?.id === inv.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <XCircle className="mr-1 h-3 w-3" />
                    )}
                    Cancel invitation
                  </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination && (
        <Pagination pagination={pagination} onPageChange={setPage} />
      )}

      {/* Cancel invitation confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke the invitation for <strong>{cancelTarget?.examineeEmail}</strong> to take{" "}
              {cancelTarget?.examTitle || "the exam"}. They will no longer be able to use this invitation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep invitation</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Send Invitation Dialog ===== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Invitation</DialogTitle>
            <DialogDescription>Invite examinees to take an exam or all exams in a bundle.</DialogDescription>
          </DialogHeader>

          {/* Step 1: What to invite for */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Invite for</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInviteTarget("exam")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all sm:p-4 ${
                  inviteTarget === "exam"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <FileText className={`h-6 w-6 ${inviteTarget === "exam" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Single Exam</span>
              </button>
              <button
                type="button"
                onClick={() => setInviteTarget("bundle")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all sm:p-4 ${
                  inviteTarget === "bundle"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Package className={`h-6 w-6 ${inviteTarget === "bundle" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Exam Bundle</span>
              </button>
            </div>
          </div>

          {/* Step 2: Who to invite */}
          <Tabs value={inviteRecipient} onValueChange={(v) => setInviteRecipient(v as InviteRecipient)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="individual">Individual</TabsTrigger>
              <TabsTrigger value="group">Group</TabsTrigger>
            </TabsList>

            {/* ---- Exam + Individual ---- */}
            {inviteTarget === "exam" && (
              <>
                <TabsContent value="individual">
                  <form onSubmit={examIndividualForm.handleSubmit((v) => examIndividualMutation.mutate(v))} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Exam *</Label>
                      <Select value={examIndividualForm.watch("examId")} onValueChange={(v) => examIndividualForm.setValue("examId", v)}>
                        <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                        <SelectContent>
                          {exams.map((e) => (<SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      {examIndividualForm.formState.errors.examId && <p className="text-xs text-destructive">{examIndividualForm.formState.errors.examId.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Examinee Email *</Label>
                      <Input type="email" placeholder="user@example.com" {...examIndividualForm.register("examineeEmail")} />
                      {examIndividualForm.formState.errors.examineeEmail && <p className="text-xs text-destructive">{examIndividualForm.formState.errors.examineeEmail.message}</p>}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Expires At *</Label>
                        <Input type="datetime-local" {...examIndividualForm.register("expiresAt")} />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Attempts</Label>
                        <Input type="number" min={1} {...examIndividualForm.register("maxAttempts")} />
                      </div>
                    </div>
                    <AllowRetakeAfterPassField control={examIndividualForm.control} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          Scheduled Start Time (Optional)
                          <small className="text-xs text-muted-foreground block mt-1">Exam cannot be started before this time</small>
                        </Label>
                        <Input
                          type="datetime-local"
                          {...examIndividualForm.register("scheduledStartTime")}
                          min={new Date().toISOString().slice(0, 16)}
                        />
                        {examIndividualForm.formState.errors.scheduledStartTime && (
                          <p className="text-xs text-destructive">{examIndividualForm.formState.errors.scheduledStartTime.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Scheduled End Time (Optional)
                          <small className="text-xs text-muted-foreground block mt-1">Overrides exam duration if set</small>
                        </Label>
                        <Input
                          type="datetime-local"
                          {...examIndividualForm.register("scheduledEndTime")}
                          min={examIndividualForm.watch("scheduledStartTime") || new Date().toISOString().slice(0, 16)}
                        />
                        {examIndividualForm.formState.errors.scheduledEndTime && (
                          <p className="text-xs text-destructive">{examIndividualForm.formState.errors.scheduledEndTime.message}</p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Invitation
                      </Button>
                    </DialogFooter>
                  </form>
                </TabsContent>

                <TabsContent value="group">
                  <form onSubmit={examGroupForm.handleSubmit((v) => examGroupMutation.mutate(v))} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Exam *</Label>
                      <Select value={examGroupForm.watch("examId")} onValueChange={(v) => examGroupForm.setValue("examId", v)}>
                        <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                        <SelectContent>
                          {exams.map((e) => (<SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Examinee Group *</Label>
                      <Select value={examGroupForm.watch("groupId")} onValueChange={(v) => examGroupForm.setValue("groupId", v)}>
                        <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                        <SelectContent>
                          {groups.map((g) => (<SelectItem key={g.id} value={g.id}>{g.name} ({g.memberIds?.length || 0} members)</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Expires At *</Label>
                        <Input type="datetime-local" {...examGroupForm.register("expiresAt")} />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Attempts</Label>
                        <Input type="number" min={1} {...examGroupForm.register("maxAttempts")} />
                      </div>
                    </div>
                    <AllowRetakeAfterPassField control={examGroupForm.control} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          Scheduled Start Time (Optional)
                          <small className="text-xs text-muted-foreground block mt-1">Exam cannot be started before this time</small>
                        </Label>
                        <Input
                          type="datetime-local"
                          {...examGroupForm.register("scheduledStartTime")}
                          min={new Date().toISOString().slice(0, 16)}
                        />
                        {examGroupForm.formState.errors.scheduledStartTime && (
                          <p className="text-xs text-destructive">{examGroupForm.formState.errors.scheduledStartTime.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Scheduled End Time (Optional)
                          <small className="text-xs text-muted-foreground block mt-1">Overrides exam duration if set</small>
                        </Label>
                        <Input
                          type="datetime-local"
                          {...examGroupForm.register("scheduledEndTime")}
                          min={examGroupForm.watch("scheduledStartTime") || new Date().toISOString().slice(0, 16)}
                        />
                        {examGroupForm.formState.errors.scheduledEndTime && (
                          <p className="text-xs text-destructive">{examGroupForm.formState.errors.scheduledEndTime.message}</p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send to Group
                      </Button>
                    </DialogFooter>
                  </form>
                </TabsContent>
              </>
            )}

            {/* ---- Bundle + Individual ---- */}
            {inviteTarget === "bundle" && (
              <>
                <TabsContent value="individual">
                  <form onSubmit={bundleIndividualForm.handleSubmit((v) => bundleIndividualMutation.mutate(v))} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Exam Bundle *</Label>
                      <Select value={bundleIndividualForm.watch("bundleId")} onValueChange={(v) => bundleIndividualForm.setValue("bundleId", v)}>
                        <SelectTrigger><SelectValue placeholder="Select bundle" /></SelectTrigger>
                        <SelectContent>
                          {bundles.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name} ({b.examIds?.length || 0} exams)</SelectItem>))}
                        </SelectContent>
                      </Select>
                      {bundleIndividualForm.formState.errors.bundleId && <p className="text-xs text-destructive">{bundleIndividualForm.formState.errors.bundleId.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Examinee Email *</Label>
                      <Input type="email" placeholder="user@example.com" {...bundleIndividualForm.register("examineeEmail")} />
                      {bundleIndividualForm.formState.errors.examineeEmail && <p className="text-xs text-destructive">{bundleIndividualForm.formState.errors.examineeEmail.message}</p>}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Expires At *</Label>
                        <Input type="datetime-local" {...bundleIndividualForm.register("expiresAt")} />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Attempts</Label>
                        <Input type="number" min={1} {...bundleIndividualForm.register("maxAttempts")} />
                      </div>
                    </div>
                    <AllowRetakeAfterPassField control={bundleIndividualForm.control} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          Scheduled Start Time (Optional)
                          <small className="text-xs text-muted-foreground block mt-1">Exam cannot be started before this time</small>
                        </Label>
                        <Input
                          type="datetime-local"
                          {...bundleIndividualForm.register("scheduledStartTime")}
                          min={new Date().toISOString().slice(0, 16)}
                        />
                        {bundleIndividualForm.formState.errors.scheduledStartTime && (
                          <p className="text-xs text-destructive">{bundleIndividualForm.formState.errors.scheduledStartTime.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Scheduled End Time (Optional)
                          <small className="text-xs text-muted-foreground block mt-1">Overrides exam duration if set</small>
                        </Label>
                        <Input
                          type="datetime-local"
                          {...bundleIndividualForm.register("scheduledEndTime")}
                          min={bundleIndividualForm.watch("scheduledStartTime") || new Date().toISOString().slice(0, 16)}
                        />
                        {bundleIndividualForm.formState.errors.scheduledEndTime && (
                          <p className="text-xs text-destructive">{bundleIndividualForm.formState.errors.scheduledEndTime.message}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted rounded-md p-2">
                      This will create one invitation per exam in the bundle. Exams that already have active invitations for this user will be skipped.
                    </p>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Bundle Invitation
                      </Button>
                    </DialogFooter>
                  </form>
                </TabsContent>

                <TabsContent value="group">
                  <form onSubmit={bundleGroupForm.handleSubmit((v) => bundleGroupMutation.mutate(v as CreateBundleGroupInvitationPayload))} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Exam Bundle *</Label>
                      <Select value={bundleGroupForm.watch("bundleId")} onValueChange={(v) => bundleGroupForm.setValue("bundleId", v)}>
                        <SelectTrigger><SelectValue placeholder="Select bundle" /></SelectTrigger>
                        <SelectContent>
                          {bundles.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name} ({b.examIds?.length || 0} exams)</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Examinee Group *</Label>
                      <Select value={bundleGroupForm.watch("groupId")} onValueChange={(v) => bundleGroupForm.setValue("groupId", v)}>
                        <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                        <SelectContent>
                          {groups.map((g) => (<SelectItem key={g.id} value={g.id}>{g.name} ({g.memberIds?.length || 0} members)</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Expires At *</Label>
                        <Input type="datetime-local" {...bundleGroupForm.register("expiresAt")} />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Attempts</Label>
                        <Input type="number" min={1} {...bundleGroupForm.register("maxAttempts")} />
                      </div>
                    </div>
                    <AllowRetakeAfterPassField control={bundleGroupForm.control} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          Scheduled Start Time (Optional)
                          <small className="text-xs text-muted-foreground block mt-1">Exam cannot be started before this time</small>
                        </Label>
                        <Input
                          type="datetime-local"
                          {...bundleGroupForm.register("scheduledStartTime")}
                          min={new Date().toISOString().slice(0, 16)}
                        />
                        {bundleGroupForm.formState.errors.scheduledStartTime && (
                          <p className="text-xs text-destructive">{bundleGroupForm.formState.errors.scheduledStartTime.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Scheduled End Time (Optional)
                          <small className="text-xs text-muted-foreground block mt-1">Overrides exam duration if set</small>
                        </Label>
                        <Input
                          type="datetime-local"
                          {...bundleGroupForm.register("scheduledEndTime")}
                          min={bundleGroupForm.watch("scheduledStartTime") || new Date().toISOString().slice(0, 16)}
                        />
                        {bundleGroupForm.formState.errors.scheduledEndTime && (
                          <p className="text-xs text-destructive">{bundleGroupForm.formState.errors.scheduledEndTime.message}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted rounded-md p-2">
                      This will create invitations for all group members for every exam in the bundle. Members with existing active invitations will be skipped.
                    </p>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send to Group
                      </Button>
                    </DialogFooter>
                  </form>
                </TabsContent>
              </>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
