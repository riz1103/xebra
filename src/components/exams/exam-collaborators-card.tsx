"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserMinus, UserPlus, Users } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/** Co-owners can edit the exam, grade, and see its results; only the creator or an admin changes sharing. */
export function ExamCollaboratorsCard({ examId }: { examId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuthStore();
  const [email, setEmail] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["exam-collaborators", examId],
    queryFn: () => api.getExamCollaborators(examId),
    retry: false,
  });
  const sharing = data?.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["exam-collaborators", examId] });
    queryClient.invalidateQueries({ queryKey: ["exam-audit-log", examId] });
  };

  const addMutation = useMutation({
    mutationFn: (value: string) => api.addExamCollaborator(examId, value),
    onSuccess: (res) => {
      toast.success(`Shared with ${res.data?.email ?? "co-owner"}`);
      setEmail("");
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not share the exam")),
  });

  const removeMutation = useMutation({
    mutationFn: (uid: string) => api.removeExamCollaborator(examId, uid),
    onSuccess: (_res, uid) => {
      if (uid === user?.uid) {
        toast.success("You left this exam");
        queryClient.invalidateQueries({ queryKey: ["exams"] });
        router.push("/dashboard/exams");
        return;
      }
      toast.success("Sharing removed");
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not remove co-owner")),
  });

  if (isError) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Co-owners
        </CardTitle>
        <CardDescription>
          Proctors you share this exam with can edit it, grade answers, and see its results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading || !sharing ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <ul className="space-y-2">
              <li className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{sharing.owner.email || "Creator"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">Creator</span>
              </li>
              {sharing.collaborators.map((c) => {
                const canRemove = sharing.canManageSharing || c.uid === user?.uid;
                return (
                  <li key={c.uid} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate" title={c.email ?? undefined}>
                      {c.name ? `${c.name} · ` : ""}
                      <span className="text-muted-foreground">{c.email}</span>
                    </span>
                    {canRemove && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs"
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(c.uid)}
                      >
                        <UserMinus className="mr-1 h-3 w-3" />
                        {c.uid === user?.uid ? "Leave" : "Remove"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            {sharing.canManageSharing && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) addMutation.mutate(email.trim());
                }}
              >
                <Input
                  type="email"
                  value={email}
                  placeholder="proctor@school.edu"
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Co-owner email"
                />
                <Button type="submit" variant="outline" disabled={!email.trim() || addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  <span className="ml-1 hidden sm:inline">Share</span>
                </Button>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
