"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, AlertCircle, CheckCircle2, XCircle, Clock, Play } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export default function ExamInvitationPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("invitation");
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, isAuthenticated } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const redirectUrl = invitationId 
        ? `/exams/${examId}?invitation=${encodeURIComponent(invitationId)}`
        : `/exams/${examId}`;
      router.replace(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
    }
  }, [authLoading, isAuthenticated, router, examId, invitationId]);

  // Fetch invitation details
  const { data: invitationData, isLoading: invitationLoading, error: invitationError } = useQuery({
    queryKey: ["exam-invitation", invitationId],
    queryFn: () => {
      if (!invitationId) throw new Error("No invitation ID provided");
      return api.getExamInvitation(invitationId);
    },
    enabled: !!invitationId && isAuthenticated,
    retry: false,
  });

  const invitation = invitationData?.data;

  // Validate invitation belongs to current user
  useEffect(() => {
    if (invitation && user && !error && !isValidated) {
      // Check if invitation is for this user (by email or userId)
      const isForUser =
        invitation.examineeEmail.toLowerCase() === user.email?.toLowerCase() ||
        (invitation.examineeId && invitation.examineeId === user.uid);

      if (!isForUser) {
        setError("This invitation is not for your account. Please use the invitation link sent to your email.");
        return;
      }

      // Check if invitation is for the correct exam
      if (invitation.examId !== examId) {
        setError("This invitation is for a different exam.");
        return;
      }

      // Check invitation status
      if (invitation.status === "expired") {
        setError("This invitation has expired.");
        return;
      }
      if (invitation.status === "revoked") {
        setError("This invitation has been revoked.");
        return;
      }
      if (invitation.status === "used" && (invitation.attemptsUsed || 0) >= invitation.maxAttempts) {
        setError("You have already used all attempts for this exam.");
        return;
      }

      // Check scheduled start time if present
      if (invitation.scheduledStartTime) {
        const scheduledStart = new Date(invitation.scheduledStartTime);
        const now = new Date();
        if (scheduledStart > now) {
          const minutesUntilStart = Math.ceil((scheduledStart.getTime() - now.getTime()) / (1000 * 60));
          setError(`This exam is scheduled to start at ${scheduledStart.toLocaleString()}. Please wait ${minutesUntilStart} minute(s).`);
          return;
        }
      }

      // If all validations pass, show the start dialog
      setIsValidated(true);
      setShowStartDialog(true);
    }
  }, [invitation, user, examId, error, isValidated]);

  // Create exam session mutation
  const createSessionMutation = useMutation({
    mutationFn: () => {
      if (!invitationId) throw new Error("No invitation ID provided");
      return api.createExamSession({ invitationId });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["exams-for-examinee"] });
      if (data.data) {
        router.push(`/exam/${data.data.id}`);
      }
    },
    onError: (err: unknown) => {
      let errorMessage = "Failed to start exam";
      if (err && typeof err === "object") {
        const axiosError = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
        if (axiosError.response?.data?.message) {
          errorMessage = axiosError.response.data.message;
        } else if (axiosError.response?.data?.error) {
          errorMessage = axiosError.response.data.error;
        } else if (axiosError.message) {
          errorMessage = axiosError.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      toast.error(errorMessage);
    },
  });

  // Handler to start the exam after user confirmation
  const handleStartExam = () => {
    if (invitationId) {
      createSessionMutation.mutate();
    }
  };

  // Show error immediately if invitation query failed
  useEffect(() => {
    if (invitationError) {
      let errorMessage = "Failed to load invitation";
      if (invitationError && typeof invitationError === "object" && "response" in invitationError) {
        const axiosError = invitationError as { 
          response?: { 
            status?: number;
            data?: { message?: string; error?: string; success?: boolean } 
          }; 
          message?: string;
        };
        if (axiosError.response?.status === 403) {
          errorMessage = "This invitation is not for your account. Please use the invitation link sent to your email address, or log in with the correct account.";
        } else if (axiosError.response?.status === 404) {
          errorMessage = "Invitation not found. This invitation may have been deleted or the link is invalid.";
        } else if (axiosError.response?.data?.message) {
          errorMessage = axiosError.response.data.message;
        } else if (axiosError.response?.data?.error) {
          errorMessage = axiosError.response.data.error;
        } else if (axiosError.message) {
          errorMessage = axiosError.message;
        }
      } else if (invitationError instanceof Error) {
        errorMessage = invitationError.message;
      } else if (typeof invitationError === "string") {
        errorMessage = invitationError;
      }
      setError(errorMessage);
    }
  }, [invitationError]);

  if (authLoading || (invitationLoading && !invitationError && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="text-lg font-semibold">Loading invitation...</h2>
            <p className="text-sm text-muted-foreground mt-2">Please wait while we verify your invitation.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitationId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold">Invalid Invitation Link</h2>
            <p className="text-sm text-muted-foreground mt-2">This invitation link is missing the invitation parameter.</p>
            <Button className="mt-4" onClick={() => router.push("/dashboard/my-exams")}>
              Go to My Exams
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold">Cannot Start Exam</h2>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <div className="mt-4 flex gap-2 justify-center">
              <Button variant="outline" onClick={() => router.push("/dashboard/my-exams")}>
                Go to My Exams
              </Button>
              {invitation && (
                <Button onClick={() => createSessionMutation.mutate()} disabled={createSessionMutation.isPending}>
                  {createSessionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    "Try Again"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (createSessionMutation.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="text-lg font-semibold">Starting Exam...</h2>
            <p className="text-sm text-muted-foreground mt-2">Please wait while we prepare your exam session.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper to normalize date (handles Firestore timestamps and ISO strings)
  const normalizeDate = (dateValue: string | { _seconds: number; _nanoseconds?: number } | undefined | null): Date | null => {
    if (!dateValue) return null;
    if (typeof dateValue === "object" && "_seconds" in dateValue) {
      return new Date(dateValue._seconds * 1000);
    }
    if (typeof dateValue === "string") {
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  };

  // Show confirmation dialog if invitation is validated and ready
  if (invitation && isValidated && !error && !createSessionMutation.isPending && !createSessionMutation.isSuccess) {
    const attemptsUsed = invitation.attemptsUsed || invitation.currentAttempts || 0;
    const attemptsRemaining = invitation.maxAttempts - attemptsUsed;
    const expiresAt = normalizeDate(invitation.expiresAt);
    const scheduledEndTime = normalizeDate(invitation.scheduledEndTime);

    return (
      <>
        <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" />
                Start Exam?
              </DialogTitle>
              <DialogDescription>
                You are about to start <strong>{invitation.examTitle || "this exam"}</strong>. Once you begin, the timer will start immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Attempts remaining:</span>
                  <span className="font-medium">{attemptsRemaining} of {invitation.maxAttempts}</span>
                </div>
                {expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expires:
                    </span>
                    <span className="font-medium">{expiresAt ? formatDate(expiresAt.toISOString()) : "N/A"}</span>
                  </div>
                )}
                {scheduledEndTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Must end by:
                    </span>
                    <span className="font-medium">{scheduledEndTime ? formatDate(scheduledEndTime.toISOString()) : "N/A"}</span>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                <p className="text-sm text-amber-900 dark:text-amber-200 font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Important: The timer will start as soon as you click &quot;Start Exam&quot;
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => router.push("/dashboard/my-exams")}>
                Cancel
              </Button>
              <Button onClick={handleStartExam} disabled={createSessionMutation.isPending}>
                {createSessionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Exam
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="flex min-h-screen items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="py-8 text-center">
              <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
              <h2 className="text-lg font-semibold">Preparing Exam</h2>
              <p className="text-sm text-muted-foreground mt-2">Please wait...</p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Default loading state
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="py-8 text-center">
          <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
          <h2 className="text-lg font-semibold">Preparing Exam</h2>
          <p className="text-sm text-muted-foreground mt-2">Please wait...</p>
        </CardContent>
      </Card>
    </div>
  );
}
