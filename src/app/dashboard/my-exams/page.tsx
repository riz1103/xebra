"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTableSkeleton } from "@/components/ui/loading";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { GraduationCap, Clock, ArrowRight, Loader2, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatDuration } from "@/lib/utils";

export default function MyExamsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [pendingPage, setPendingPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);

  const { data: pendingExamsData, isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-exams", pendingPage],
    queryFn: () => api.getPendingExams({ page: pendingPage, size: DEFAULT_PAGE_SIZE }),
  });

  const { data: sessionsData, isLoading: sessLoading } = useQuery({
    queryKey: ["my-sessions", sessionsPage],
    queryFn: () => api.getExamSessions({ page: sessionsPage, size: DEFAULT_PAGE_SIZE }),
  });

  const startSessionMutation = useMutation({
    mutationFn: (invitationId: string) => api.createExamSession({ invitationId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["pending-exams"] });
      if (data.data) {
        router.push(`/exam/${data.data.id}`);
      }
    },
    onError: (err: Error) => toast.error(err.message || "Failed to start exam"),
  });

  const pendingExams = pendingExamsData?.data || [];
  const sessions = sessionsData?.data || [];
  const pendingPagination = pendingExamsData?.pagination;
  const sessionsPagination = sessionsData?.pagination;
  const isLoading = pendingLoading || sessLoading;

  // Extract invitation details from the invitations array in each exam
  const pendingExamsWithInvitations = pendingExams.map((exam) => {
    // Get the first invitation from the invitations array (usually there's only one)
    const invitation = exam.invitations?.[0];
    
    // Convert FirestoreTimestamp to string if needed
    let expiresAt: string | undefined;
    if (invitation?.expiresAt) {
      if (typeof invitation.expiresAt === "object" && "_seconds" in invitation.expiresAt) {
        expiresAt = new Date(invitation.expiresAt._seconds * 1000).toISOString();
      } else {
        expiresAt = invitation.expiresAt as string;
      }
    }

    return {
      ...exam,
      invitationId: invitation?.id,
      expiresAt: expiresAt,
      maxAttempts: invitation?.maxAttempts,
      currentAttempts: invitation?.attemptsUsed ?? 0,
    };
  });

  const inProgressSessions = sessions.filter((s) => s.status === "in_progress" || s.status === "in-progress");
  const completedSessions = sessions.filter((s) => s.status === "completed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Exams</h1>
        <p className="text-muted-foreground">View your invitations and ongoing exam sessions.</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingExamsWithInvitations.length})
          </TabsTrigger>
          <TabsTrigger value="in-progress">
            In Progress ({inProgressSessions.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedSessions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {isLoading ? (
            <DataTableSkeleton rows={4} />
          ) : pendingExamsWithInvitations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No pending exams</h3>
                <p className="text-sm text-muted-foreground">You&apos;ll see exams here when a proctor invites you.</p>
              </CardContent>
            </Card>
          ) : (
            pendingExamsWithInvitations.map((exam) => (
              <Card key={exam.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between py-5">
                  <div>
                    <h3 className="font-semibold">{exam.title || "Exam"}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {exam.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires: {formatDate(exam.expiresAt)}
                        </span>
                      )}
                      {exam.maxAttempts !== undefined && exam.currentAttempts !== undefined && (
                        <span>Attempts: {exam.currentAttempts}/{exam.maxAttempts}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      if (exam.invitationId) {
                        startSessionMutation.mutate(exam.invitationId);
                      }
                    }}
                    disabled={startSessionMutation.isPending || !exam.invitationId}
                  >
                    {startSessionMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Start Exam
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
          {pendingPagination && (
            <Pagination pagination={pendingPagination} onPageChange={setPendingPage} className="mt-4" />
          )}
        </TabsContent>

        <TabsContent value="in-progress" className="space-y-4">
          {isLoading ? (
            <DataTableSkeleton rows={2} />
          ) : inProgressSessions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No exams in progress</h3>
              </CardContent>
            </Card>
          ) : (
            inProgressSessions.map((session) => (
              <Card key={session.id} className="transition-shadow hover:shadow-md border-amber-200 dark:border-amber-800">
                <CardContent className="flex items-center justify-between py-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{session.examTitle || session.exam?.title || "Exam"}</h3>
                      <Badge variant="warning">In Progress</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Question {session.currentQuestionIndex + 1}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(session.timeRemainingSeconds)}
                      </span>
                    </div>
                  </div>
                  <Button onClick={() => router.push(`/exam/${session.id}`)}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Resume
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
          {sessionsPagination && (
            <Pagination pagination={sessionsPagination} onPageChange={setSessionsPage} className="mt-4" />
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedSessions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No completed exams</h3>
              </CardContent>
            </Card>
          ) : (
            completedSessions.map((session) => (
              <Card key={session.id} className="opacity-75">
                <CardContent className="flex items-center justify-between py-5">
                  <div>
                    <h3 className="font-semibold">{session.examTitle || session.exam?.title || "Exam"}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Completed: {formatDate(session.completedAt || session.updatedAt)}
                    </p>
                  </div>
                  <Badge variant="success">Completed</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
