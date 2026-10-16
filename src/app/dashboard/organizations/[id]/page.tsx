"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Eye, Loader2, UserMinus, UserPlus } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import type { OrgDepartment, OrgRole } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n";

const ROLE_OPTIONS: OrgRole[] = ["admin", "member"];
const DEPT_OPTIONS: OrgDepartment[] = ["general", "math", "science", "english", "ict", "other"];

export default function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [department, setDepartment] = useState<OrgDepartment>("general");
  const [examId, setExamId] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["organization", id],
    queryFn: () => api.getOrganization(id),
  });
  const { data: examsData } = useQuery({
    queryKey: ["organization-exams", id],
    queryFn: () => api.getOrganizationExams(id),
  });

  const org = data?.data;
  const exams = examsData?.data ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["organization", id] });
    queryClient.invalidateQueries({ queryKey: ["organization-exams", id] });
    queryClient.invalidateQueries({ queryKey: ["organizations"] });
  };

  const addMember = useMutation({
    mutationFn: () => api.addOrganizationMember(id, { email: email.trim(), role, department }),
    onSuccess: () => {
      toast.success("Member added");
      setEmail("");
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not add member")),
  });

  const removeMember = useMutation({
    mutationFn: (uid: string) => api.removeOrganizationMember(id, uid),
    onSuccess: () => {
      toast.success("Member removed");
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not remove member")),
  });

  const updateMember = useMutation({
    mutationFn: ({ uid, role: r, department: d }: { uid: string; role?: OrgRole; department?: OrgDepartment }) =>
      api.updateOrganizationMember(id, uid, { role: r, department: d }),
    onSuccess: () => {
      toast.success("Member updated");
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not update member")),
  });

  const shareExam = useMutation({
    mutationFn: () => api.shareExamWithOrganization(id, examId.trim()),
    onSuccess: () => {
      toast.success("Exam shared with the organization");
      setExamId("");
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not share exam")),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !org) {
    return (
      <div className="flex flex-col items-center py-16">
        <p className="text-lg font-medium">Organization not found</p>
        <Button asChild className="mt-4"><Link href="/dashboard/organizations">Back</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link href="/dashboard/organizations"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{org.name}</h1>
          {org.description && <p className="text-muted-foreground">{org.description}</p>}
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant="outline" className="capitalize">{org.myRole}</Badge>
            {org.myDepartment && <Badge variant="secondary" className="capitalize">{org.myDepartment}</Badge>}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>Owners and admins manage the workspace; members can use shared exams and the org question bank.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y text-sm">
            {(org.members ?? []).map((m) => (
              <li key={m.uid} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.name || m.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {org.canManage && m.role !== "owner" ? (
                    <>
                      <Select
                        value={m.role}
                        onValueChange={(v) => updateMember.mutate({ uid: m.uid, role: v as OrgRole })}
                      >
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select
                        value={m.department}
                        onValueChange={(v) => updateMember.mutate({ uid: m.uid, department: v as OrgDepartment })}
                      >
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DEPT_OPTIONS.map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive"
                        onClick={() => removeMember.mutate(m.uid)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline" className="capitalize">{m.role}</Badge>
                      <Badge variant="secondary" className="capitalize">{m.department}</Badge>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {org.canManage && (
            <form
              className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) addMember.mutate();
              }}
            >
              <Input type="email" placeholder="proctor@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
                <SelectTrigger className="w-full sm:w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={department} onValueChange={(v) => setDepartment(v as OrgDepartment)}>
                <SelectTrigger className="w-full sm:w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPT_OPTIONS.map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={!email.trim() || addMember.isPending}>
                {addMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shared exams</CardTitle>
          <CardDescription>
            Exams tagged to this organization. Share by exam ID (from the exam URL), or open the question bank with{" "}
            <code className="text-xs">?organizationId={id}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {exams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exams shared yet.</p>
          ) : (
            <ul className="space-y-2">
              {exams.map((exam) => (
                <li key={exam.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{exam.title}</span>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/exams/${exam.id}`}><Eye className="mr-1 h-3 w-3" /> View</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="share-exam" className="sr-only">Exam ID</Label>
              <Input id="share-exam" value={examId} onChange={(e) => setExamId(e.target.value)} placeholder="Exam ID to share" />
            </div>
            <Button disabled={!examId.trim() || shareExam.isPending} onClick={() => shareExam.mutate()}>
              {shareExam.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share"}
            </Button>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/question-bank?organizationId=${id}`}>{t("orgs.openBank")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
