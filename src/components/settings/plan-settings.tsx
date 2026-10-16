"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gauge, Loader2 } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { AiPlanId } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** The user's plan, this month's AI requests against its quota, and (for admins) assigning plans. */
export function PlanSettings() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState<AiPlanId>("pro");

  const { data: usageData, isLoading } = useQuery({
    queryKey: ["ai-usage"],
    queryFn: () => api.getAiUsage(),
    retry: false,
  });
  const { data: plansData } = useQuery({
    queryKey: ["ai-plans"],
    queryFn: () => api.getPlans(),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });
  const plan = usageData?.data?.plan;
  const plans = plansData?.data ?? [];

  const setPlanMutation = useMutation({
    mutationFn: () => api.setUserPlan(email.trim(), planId),
    onSuccess: (res) => {
      toast.success(res.message ?? "Plan updated");
      setEmail("");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not update the plan")),
  });

  const used = plan ? Math.min(100, (plan.requestsThisMonth / Math.max(1, plan.monthlyRequests)) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-4 w-4" /> Plan & AI usage
        </CardTitle>
        <CardDescription>AI exam generation, grading suggestions and practice quizzes count toward your monthly quota.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : plan ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline">{plan.name} plan</Badge>
              <span className="text-muted-foreground">
                {plan.requestsThisMonth} / {plan.monthlyRequests} AI requests this month
              </span>
            </div>
            <Progress value={used} className={cn("h-2", used >= 90 && "[&>div]:bg-red-500")} />
          </div>
        ) : (
          <p className="text-muted-foreground">Usage is unavailable right now.</p>
        )}

        {plans.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.id}
                className={cn("rounded-lg border p-3", p.id === plan?.id && "border-primary bg-primary/5")}
              >
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.monthlyRequests.toLocaleString()} AI requests / month</p>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">To change your plan, contact your Xebra administrator.</p>

        {isAdmin && (
          <>
            <Separator />
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) setPlanMutation.mutate();
              }}
            >
              <Label htmlFor="plan-email">Admin: assign a plan</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="plan-email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Select value={planId} onValueChange={(v) => setPlanId(v as AiPlanId)}>
                  <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(plans.length ? plans : [{ id: "free", name: "Free" }, { id: "pro", name: "Pro" }, { id: "school", name: "School" }]).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={!email.trim() || setPlanMutation.isPending}>
                  {setPlanMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Assign
                </Button>
              </div>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
