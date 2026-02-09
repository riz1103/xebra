"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DataTableSkeleton } from "@/components/ui/loading";
import { UserCheck, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { ProctorRequest } from "@/types";

export default function ProctorRequestsPage() {
  const [reviewDialog, setReviewDialog] = useState<{ request: ProctorRequest; action: "approve" | "reject" } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["proctor-requests"],
    queryFn: () => api.getProctorRequests(),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => api.approveProctorRequest(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proctor-requests"] });
      toast.success("Request approved! User is now a proctor.");
      setReviewDialog(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => api.rejectProctorRequest(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proctor-requests"] });
      toast.success("Request rejected.");
      setReviewDialog(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openReview = (request: ProctorRequest, action: "approve" | "reject") => {
    setReviewDialog({ request, action });
    setReviewNotes("");
  };

  const handleReview = () => {
    if (!reviewDialog) return;
    const { request, action } = reviewDialog;
    if (action === "approve") {
      approveMutation.mutate({ id: request.id, notes: reviewNotes });
    } else {
      rejectMutation.mutate({ id: request.id, notes: reviewNotes });
    }
  };

  const requests = data?.data || [];
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const reviewedRequests = requests.filter((r) => r.status !== "pending");

  const statusColors: Record<string, "warning" | "success" | "destructive"> = {
    pending: "warning",
    approved: "success",
    rejected: "destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Proctor Requests</h1>
        <p className="text-muted-foreground">Review and manage requests from users who want to become proctors.</p>
      </div>

      {isLoading ? (
        <DataTableSkeleton rows={4} />
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <UserCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No proctor requests</h3>
            <p className="text-sm text-muted-foreground mt-1">Requests will appear here when users apply to become proctors.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pending */}
          {pendingRequests.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Pending Requests ({pendingRequests.length})</h2>
              {pendingRequests.map((req) => (
                <Card key={req.id}>
                  <CardContent className="flex items-start gap-4 py-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{req.userName || req.userEmail || "User"}</p>
                        <Badge variant={statusColors[req.status]}>{req.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{req.reason}</p>
                      {req.additionalInfo && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{req.additionalInfo}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">Submitted: {formatDate(req.createdAt)}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => openReview(req, "approve")} className="bg-emerald-600 hover:bg-emerald-700">
                        <Check className="mr-1 h-3 w-3" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openReview(req, "reject")}>
                        <X className="mr-1 h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Reviewed */}
          {reviewedRequests.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Reviewed ({reviewedRequests.length})</h2>
              {reviewedRequests.map((req) => (
                <Card key={req.id} className="opacity-75">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{req.userName || req.userEmail || "User"}</p>
                        <Badge variant={statusColors[req.status]}>{req.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{req.reason}</p>
                      {req.reviewNotes && <p className="text-xs text-muted-foreground mt-1">Notes: {req.reviewNotes}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(req.reviewedAt || req.updatedAt)}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.action === "approve" ? "Approve" : "Reject"} Request
            </DialogTitle>
            <DialogDescription>
              {reviewDialog?.action === "approve"
                ? "This will grant proctor privileges to the user."
                : "The user will be notified of the rejection."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{reviewDialog?.request.userName || reviewDialog?.request.userEmail}</p>
              <p className="text-muted-foreground mt-1">{reviewDialog?.request.reason}</p>
            </div>
            <div className="space-y-2">
              <Label>Review Notes (optional)</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes about your decision..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Cancel</Button>
            <Button
              onClick={handleReview}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              variant={reviewDialog?.action === "approve" ? "default" : "destructive"}
            >
              {(approveMutation.isPending || rejectMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {reviewDialog?.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
