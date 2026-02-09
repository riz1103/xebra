"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import {
  examInvitationSchema, groupInvitationSchema,
  bundleInvitationSchema, bundleGroupInvitationSchema,
  type ExamInvitationFormValues, type GroupInvitationFormValues,
  type BundleInvitationFormValues,
} from "@/lib/validations";
import type { CreateBundleGroupInvitationPayload } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Plus, Loader2, Mail, XCircle, Search, Package, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

type InviteTarget = "exam" | "bundle";
type InviteRecipient = "individual" | "group";

export default function InvitationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<InviteTarget>("exam");
  const [inviteRecipient, setInviteRecipient] = useState<InviteRecipient>("individual");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["invitations"],
    queryFn: () => api.getExamInvitations(),
  });

  const { data: examsData } = useQuery({ queryKey: ["exams"], queryFn: () => api.getExams() });
  const { data: groupsData } = useQuery({ queryKey: ["groups"], queryFn: () => api.getExamineeGroups() });
  const { data: bundlesData } = useQuery({ queryKey: ["bundles"], queryFn: () => api.getExamBundles() });

  // Default expiry: 7 days from now
  const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  // --- Forms ---
  const examIndividualForm = useForm<ExamInvitationFormValues>({
    resolver: zodResolver(examInvitationSchema),
    defaultValues: { examId: "", examineeEmail: "", expiresAt: defaultExpiry, maxAttempts: 1 },
  });

  const examGroupForm = useForm<GroupInvitationFormValues>({
    resolver: zodResolver(groupInvitationSchema),
    defaultValues: { examId: "", groupId: "", expiresAt: defaultExpiry, maxAttempts: 1 },
  });

  const bundleIndividualForm = useForm<BundleInvitationFormValues>({
    resolver: zodResolver(bundleInvitationSchema),
    defaultValues: { bundleId: "", examineeEmail: "", expiresAt: defaultExpiry, maxAttempts: 1 },
  });

  const bundleGroupForm = useForm({
    resolver: zodResolver(bundleGroupInvitationSchema),
    defaultValues: { bundleId: "", groupId: "", expiresAt: defaultExpiry, maxAttempts: 1 },
  });

  // --- Mutations ---
  const examIndividualMutation = useMutation({
    mutationFn: (v: ExamInvitationFormValues) => api.createExamInvitation(v),
    onSuccess: () => { onMutationSuccess("Invitation sent"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const examGroupMutation = useMutation({
    mutationFn: (v: GroupInvitationFormValues) => api.createGroupInvitation(v),
    onSuccess: () => { onMutationSuccess("Group invitations sent"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const bundleIndividualMutation = useMutation({
    mutationFn: (v: BundleInvitationFormValues) => api.createBundleInvitation(v),
    onSuccess: () => { onMutationSuccess("Bundle invitations sent"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const bundleGroupMutation = useMutation({
    mutationFn: (v: CreateBundleGroupInvitationPayload) => api.createBundleGroupInvitation(v),
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
    examIndividualForm.reset({ examId: "", examineeEmail: "", expiresAt: defaultExpiry, maxAttempts: 1 });
    examGroupForm.reset({ examId: "", groupId: "", expiresAt: defaultExpiry, maxAttempts: 1 });
    bundleIndividualForm.reset({ bundleId: "", examineeEmail: "", expiresAt: defaultExpiry, maxAttempts: 1 });
    bundleGroupForm.reset({ bundleId: "", groupId: "", expiresAt: defaultExpiry, maxAttempts: 1 });
  }

  const isPending =
    examIndividualMutation.isPending || examGroupMutation.isPending ||
    bundleIndividualMutation.isPending || bundleGroupMutation.isPending;

  const invitations = (data?.data || []).filter((inv) => {
    const matchesSearch =
      (inv.examineeEmail || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.examTitle || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const exams = examsData?.data || [];
  const groups = groupsData?.data || [];
  const bundles = bundlesData?.data || [];

  const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
    pending: "warning",
    accepted: "default",
    used: "success",
    expired: "secondary",
    revoked: "destructive",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invitations</h1>
          <p className="text-muted-foreground">Invite examinees to take exams or exam bundles.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Send Invitation
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search invitations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
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
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{inv.examineeEmail}</p>
                    <Badge variant={statusColors[inv.status] || "outline"} className="text-xs">{inv.status}</Badge>
                    {inv.bundleId && (
                      <Badge variant="outline" className="text-xs">
                        <Package className="mr-1 h-3 w-3" /> Bundle
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Exam: {inv.examTitle || inv.examId} &middot; Attempts: {inv.currentAttempts}/{inv.maxAttempts} &middot; Expires: {formatDate(inv.expiresAt)}
                  </p>
                </div>
                {inv.status === "pending" && (
                  <Button variant="ghost" size="sm" onClick={() => cancelMutation.mutate(inv.id)} className="text-destructive">
                    <XCircle className="mr-1 h-3 w-3" /> Cancel
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
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
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
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
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label>Expires At *</Label>
                        <Input type="datetime-local" {...examIndividualForm.register("expiresAt")} />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Attempts</Label>
                        <Input type="number" min={1} {...examIndividualForm.register("maxAttempts")} />
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
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label>Expires At *</Label>
                        <Input type="datetime-local" {...examGroupForm.register("expiresAt")} />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Attempts</Label>
                        <Input type="number" min={1} {...examGroupForm.register("maxAttempts")} />
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
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label>Expires At *</Label>
                        <Input type="datetime-local" {...bundleIndividualForm.register("expiresAt")} />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Attempts</Label>
                        <Input type="number" min={1} {...bundleIndividualForm.register("maxAttempts")} />
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
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label>Expires At *</Label>
                        <Input type="datetime-local" {...bundleGroupForm.register("expiresAt")} />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Attempts</Label>
                        <Input type="number" min={1} {...bundleGroupForm.register("maxAttempts")} />
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
