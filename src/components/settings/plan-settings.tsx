"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gauge, Loader2 } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { AiPlanId, PaymongoCheckout } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, school: 2 };

function formatPhp(centavos: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(centavos / 100);
}

/** The user's plan, this month's AI requests against its quota, QR Ph upgrades, and admin assignment. */
export function PlanSettings() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const canPay = user?.role === "proctor" || user?.role === "admin" || user?.role === "owner";
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState<AiPlanId>("pro");
  const [checkout, setCheckout] = useState<PaymongoCheckout | null>(null);
  const celebrated = useRef<string | null>(null);

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
  const { data: integrations } = useQuery({
    queryKey: ["integrations-status"],
    queryFn: () => api.getIntegrationStatus(),
    enabled: canPay,
    retry: false,
  });
  const plan = usageData?.data?.plan;
  const plans = plansData?.data ?? [];
  const paymongoReady = !!integrations?.data?.paymongo;

  const statusQuery = useQuery({
    queryKey: ["paymongo-checkout", checkout?.paymentIntentId],
    queryFn: () => api.getPaymongoCheckout(checkout!.paymentIntentId),
    enabled: !!checkout && checkout.status === "pending",
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return !status || status === "pending" ? 3000 : false;
    },
  });
  const live = statusQuery.data?.data ?? checkout;

  useEffect(() => {
    if (live?.status !== "paid" || celebrated.current === live.paymentIntentId) return;
    celebrated.current = live.paymentIntentId;
    toast.success(`You're on the ${live.plan === "school" ? "School" : "Pro"} plan`);
    queryClient.invalidateQueries({ queryKey: ["ai-usage"] });
  }, [live, queryClient]);

  const setPlanMutation = useMutation({
    mutationFn: () => api.setUserPlan(email.trim(), planId),
    onSuccess: (res) => {
      toast.success(res.message ?? "Plan updated");
      setEmail("");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not update the plan")),
  });

  const payMutation = useMutation({
    mutationFn: (next: "pro" | "school") => api.startPaymongoCheckout(next),
    onSuccess: (res) => {
      if (res.data) setCheckout(res.data);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not start QR Ph checkout")),
  });

  const used = plan ? Math.min(100, (plan.requestsThisMonth / Math.max(1, plan.monthlyRequests)) * 100) : 0;
  const currentRank = PLAN_RANK[plan?.id ?? "free"] ?? 0;

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
            {plans.map((p) => {
              const upgrade = canPay && paymongoReady && p.id !== "free" && (PLAN_RANK[p.id] ?? 0) > currentRank && p.priceCentavos;
              return (
                <div
                  key={p.id}
                  className={cn("rounded-lg border p-3", p.id === plan?.id && "border-primary bg-primary/5")}
                >
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.monthlyRequests.toLocaleString()} AI requests / month</p>
                  {p.priceCentavos ? (
                    <p className="mt-1 text-xs font-medium">{formatPhp(p.priceCentavos)}</p>
                  ) : null}
                  {upgrade ? (
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      variant="outline"
                      disabled={payMutation.isPending}
                      onClick={() => payMutation.mutate(p.id as "pro" | "school")}
                    >
                      {payMutation.isPending && payMutation.variables === p.id ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Pay with QR Ph
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {canPay
            ? "A QR Ph payment upgrades this account until an admin changes the plan. It is not a monthly subscription."
            : "To change your plan, contact your Xebra administrator."}
        </p>

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

      <Dialog open={!!checkout} onOpenChange={(open) => { if (!open) setCheckout(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay with QR Ph</DialogTitle>
            <DialogDescription>
              {live
                ? live.testUrl
                  ? `${formatPhp(live.amount)} for the ${live.plan === "school" ? "School" : "Pro"} plan. Test mode does not use GCash.`
                  : `${formatPhp(live.amount)} for the ${live.plan === "school" ? "School" : "Pro"} plan. Scan with any bank or e-wallet app.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {live?.status === "paid" ? (
            <p className="text-sm">Payment received. This account is on the {live.plan === "school" ? "School" : "Pro"} plan.</p>
          ) : live?.status === "expired" || live?.status === "failed" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">This code is no longer payable. Generate a new one to try again.</p>
              <Button
                className="w-full"
                disabled={payMutation.isPending}
                onClick={() => live && payMutation.mutate(live.plan)}
              >
                {payMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                New QR code
              </Button>
            </div>
          ) : live?.qrImageUrl ? (
            <div className="space-y-2 text-center">
              {/* PayMongo returns a data URL or hosted PNG. next/image does not accept that data URL. */}
              <img src={live.qrImageUrl} alt="QR Ph code" className="mx-auto h-auto w-56 rounded-md border bg-white p-2" />
              {live.testUrl ? (
                <a
                  href={live.testUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                >
                  Simulate payment
                </a>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {live.testUrl
                  ? "Open Simulate payment and choose Authorize. Do not scan this QR with GCash. Keep this window open."
                  : "Waiting for payment. This code expires in 30 minutes. Keep this window open."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">The QR code did not load.</p>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
