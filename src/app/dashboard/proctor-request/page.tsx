"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { proctorRequestSchema, type ProctorRequestFormValues } from "@/lib/validations";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserCheck, Loader2, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export default function ProctorRequestPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-proctor-requests"],
    queryFn: () => api.getProctorRequests(),
  });

  const form = useForm<ProctorRequestFormValues>({
    resolver: zodResolver(proctorRequestSchema),
    defaultValues: { reason: "", additionalInfo: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: ProctorRequestFormValues) => api.createProctorRequest(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-proctor-requests"] });
      toast.success("Request submitted successfully!");
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const requests = data?.data || [];
  const hasPendingRequest = requests.some((r) => r.status === "pending");
  const isAlreadyProctor = user?.role === "proctor" || user?.role === "admin";

  if (isAlreadyProctor) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold sm:text-3xl">You&apos;re already a {user?.role}!</h1>
        <p className="text-muted-foreground mt-2">You have full access to create and manage exams.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Become a Proctor</h1>
        <p className="text-muted-foreground">
          Submit a request to become a proctor and start creating exams.
        </p>
      </div>

      {/* Previous Requests */}
      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    {req.status === "pending" && <Clock className="h-4 w-4 text-amber-500" />}
                    {req.status === "approved" && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                    {req.status === "rejected" && <XCircle className="h-4 w-4 text-red-500" />}
                    <Badge variant={req.status === "pending" ? "warning" : req.status === "approved" ? "success" : "destructive"}>
                      {req.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(req.createdAt)}</p>
                  {req.reviewNotes && <p className="text-xs mt-1">Review: {req.reviewNotes}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* New Request Form */}
      {!hasPendingRequest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" /> Submit Request
            </CardTitle>
            <CardDescription>
              Tell us why you want to become a proctor. An admin will review your request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Textarea
                  placeholder="Explain why you want to become a proctor..."
                  rows={4}
                  {...form.register("reason")}
                />
                {form.formState.errors.reason && (
                  <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Additional Information (optional)</Label>
                <Textarea
                  placeholder="Any relevant experience or qualifications..."
                  rows={3}
                  {...form.register("additionalInfo")}
                />
              </div>
              <Button type="submit" disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {hasPendingRequest && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="flex items-center gap-4 py-6">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <h3 className="font-semibold">Request Pending</h3>
              <p className="text-sm text-muted-foreground">Your proctor request is being reviewed by an admin.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
