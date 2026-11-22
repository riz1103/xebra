"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTableSkeleton } from "@/components/ui/loading";
import { ArrowDown, ArrowUp, ArrowUpDown, Gauge, Coins, Zap, Hash, Search, Shield } from "lucide-react";
import type { AiUsageConsumer, AiUsageConsumerTotals, AiUsageOverview, AiUsageTierSummary } from "@/types";

const usd = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });

const count = (value: number) => value.toLocaleString();

type SortKey = "costUsd" | "requests" | "totalTokens" | "name";
type SortDir = "asc" | "desc";

function pct(used: number, limit: number) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function Meter({ label, usedLabel, remainLabel, percent }: { label: string; usedLabel: string; remainLabel: string; percent: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{usedLabel}</span>
        <span>{remainLabel}</span>
      </div>
    </div>
  );
}

function TierCard({ title, tier, modelHint }: { title: string; tier: AiUsageTierSummary; modelHint: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{modelHint}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground">Requests</p>
          <p className="font-medium tabular-nums">{count(tier.requests)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Estimated cost</p>
          <p className="font-medium tabular-nums">{usd(tier.costUsd)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Input tokens</p>
          <p className="font-medium tabular-nums">{count(tier.inputTokens)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Output tokens</p>
          <p className="font-medium tabular-nums">{count(tier.outputTokens)}</p>
        </div>
        {tier.budgetUsd != null && (
          <div className="sm:col-span-2">
            <Meter
              label="Primary budget"
              usedLabel={`${usd(tier.costUsd)} used`}
              remainLabel={`${usd(tier.remainingBudgetUsd ?? 0)} left of ${usd(tier.budgetUsd)}`}
              percent={pct(tier.costUsd, tier.budgetUsd)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function filterAndSort(
  rows: AiUsageConsumer[],
  search: string,
  sortKey: SortKey,
  sortDir: SortDir
): AiUsageConsumer[] {
  const q = search.trim().toLowerCase();
  const filtered = !q
    ? rows
    : rows.filter((row) => {
        const hay = `${row.name || ""} ${row.email || ""} ${row.role || ""} ${row.userId}`.toLowerCase();
        return hay.includes(q);
      });

  const dir = sortDir === "asc" ? 1 : -1;
  return [...filtered].sort((a, b) => {
    if (sortKey === "name") {
      const an = (a.name || a.email || a.userId).toLowerCase();
      const bn = (b.name || b.email || b.userId).toLowerCase();
      return an.localeCompare(bn) * dir;
    }
    const av = a[sortKey] || 0;
    const bv = b[sortKey] || 0;
    if (av === bv) {
      return (a.name || a.email || "").localeCompare(b.name || b.email || "");
    }
    return (av < bv ? -1 : 1) * dir;
  });
}

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === column;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`pb-2 font-medium ${align === "right" ? "text-right" : "text-left"} ${align === "right" ? "" : "pr-3"}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${align === "right" ? "flex-row-reverse" : ""} ${
          active ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </th>
  );
}

function ConsumerTable({
  title,
  description,
  rows,
  totals,
  emptyLabel,
  showQuotaHint,
}: {
  title: string;
  description: string;
  rows: AiUsageConsumer[];
  totals: AiUsageConsumerTotals;
  emptyLabel: string;
  showQuotaHint?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("costUsd");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const visible = useMemo(
    () => filterAndSort(rows, search, sortKey, sortDir),
    [rows, search, sortKey, sortDir]
  );

  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground sm:justify-end">
            <span>
              <span className="font-medium text-foreground">{count(totals.users)}</span> users
            </span>
            <span>
              <span className="font-medium text-foreground">{count(totals.requests)}</span> requests
            </span>
            <span>
              <span className="font-medium text-foreground">{count(totals.totalTokens)}</span> tokens
            </span>
            <span>
              <span className="font-medium text-foreground">{usd(totals.costUsd)}</span> est.
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or role…"
              className="pl-8"
            />
          </div>
          <Select
            value={`${sortKey}:${sortDir}`}
            onValueChange={(value) => {
              const [key, dir] = value.split(":") as [SortKey, SortDir];
              setSortKey(key);
              setSortDir(dir);
            }}
          >
            <SelectTrigger className="sm:w-[220px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="costUsd:desc">Cost · high to low</SelectItem>
              <SelectItem value="costUsd:asc">Cost · low to high</SelectItem>
              <SelectItem value="requests:desc">Requests · high to low</SelectItem>
              <SelectItem value="requests:asc">Requests · low to high</SelectItem>
              <SelectItem value="totalTokens:desc">Tokens · high to low</SelectItem>
              <SelectItem value="totalTokens:asc">Tokens · low to high</SelectItem>
              <SelectItem value="name:asc">Name · A–Z</SelectItem>
              <SelectItem value="name:desc">Name · Z–A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users match “{search.trim()}”.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <SortHeader label="User" column="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <th className="pb-2 pr-3 text-left font-medium text-muted-foreground">Role</th>
                  <SortHeader label="Requests" column="requests" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
                  <SortHeader label="Tokens" column="totalTokens" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
                  <SortHeader label="Est. cost" column="costUsd" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => (
                  <tr key={user.userId} className="border-b last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{user.name || user.email || user.userId}</div>
                      {user.email && user.name ? (
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      ) : null}
                      {showQuotaHint && !user.countsTowardPlanQuota ? (
                        <div className="text-xs text-muted-foreground">Not counted toward plan quotas</div>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge variant="secondary" className="capitalize">
                        {user.role || "user"}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      <div>{count(user.requests)}</div>
                      <div className="text-xs text-muted-foreground">
                        {count(user.primaryRequests)} prim · {count(user.fallbackRequests)} fb
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      <div>{count(user.totalTokens)}</div>
                      <div className="text-xs text-muted-foreground">
                        {count(user.inputTokens)} in · {count(user.outputTokens)} out
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{usd(user.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewBody({ data }: { data: AiUsageOverview }) {
  const capPct = pct(data.bill.estimatedUsd, data.limits.monthlyCapUsd);
  const tokenRemain =
    data.totals.estimatedRemainingTokens == null
      ? "—"
      : `${count(data.totals.estimatedRemainingTokens)} est. remaining`;

  const userConsumers = data.userConsumers ?? data.consumers?.filter((c) => !c.isAdmin) ?? [];
  const adminConsumers = data.adminConsumers ?? data.consumers?.filter((c) => c.isAdmin) ?? [];
  const userTotals = data.userTotals ?? {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    users: userConsumers.length,
  };
  const adminTotals = data.adminTotals ?? {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    users: adminConsumers.length,
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated bill</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{usd(data.bill.estimatedUsd)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {usd(data.bill.remainingCapUsd)} left of {usd(data.limits.monthlyCapUsd)} monthly cap
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI requests</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{count(data.totals.requests)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {count(data.tiers.primary.requests)} primary · {count(data.tiers.fallback.requests)} fallback
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens used</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{count(data.totals.totalTokens)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {count(data.totals.inputTokens)} in · {count(data.totals.outputTokens)} out
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens remaining</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {data.totals.estimatedRemainingTokens == null
                ? "—"
                : count(data.totals.estimatedRemainingTokens)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Projected from remaining monthly cap</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly spend vs limits</CardTitle>
          <CardDescription>
            Billing period {data.period} ({data.timeZone}). Day {data.day}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Meter
            label="Platform monthly cap"
            usedLabel={`${usd(data.bill.estimatedUsd)} estimated bill`}
            remainLabel={`${usd(data.bill.remainingCapUsd)} remaining · ${tokenRemain}`}
            percent={capPct}
          />
          <Meter
            label="Primary model soft budget"
            usedLabel={`${usd(data.bill.primaryUsd)} used`}
            remainLabel={`${usd(data.bill.remainingPrimaryBudgetUsd ?? 0)} left of ${usd(data.limits.primaryMonthlyBudgetUsd)}`}
            percent={pct(data.bill.primaryUsd, data.limits.primaryMonthlyBudgetUsd)}
          />
          <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Non-admin consumption</p>
              <p className="font-medium tabular-nums">
                {usd(userTotals.costUsd)} · {count(userTotals.requests)} requests · {count(userTotals.users)} users
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Shield className="h-3.5 w-3.5" /> Admin consumption (no plan quota)
              </p>
              <p className="font-medium tabular-nums">
                {usd(adminTotals.costUsd)} · {count(adminTotals.requests)} requests · {count(adminTotals.users)} admins
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{data.bill.note}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TierCard title="Primary model" tier={data.tiers.primary} modelHint="Main Gemini model for staff exam generation" />
        <TierCard title="Fallback model" tier={data.tiers.fallback} modelHint="Cheaper model after budget/daily limits, and for examinee practice" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configured limits</CardTitle>
            <CardDescription>Hard and soft caps that gate AI access this month.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Monthly spend cap</span>
              <span className="font-medium tabular-nums">{usd(data.limits.monthlyCapUsd)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Primary soft budget</span>
              <span className="font-medium tabular-nums">{usd(data.limits.primaryMonthlyBudgetUsd)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Primary requests / user / day</span>
              <span className="font-medium tabular-nums">{count(data.limits.primaryDailyRequestsPerUser)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Examinee requests / day</span>
              <span className="font-medium tabular-nums">{count(data.limits.examineeDailyRequests)}</span>
            </div>
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pricing (per 1M tokens)</p>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Primary in / out</span>
                <span className="font-medium tabular-nums">
                  {usd(data.pricing.primary.inputPerMillion)} / {usd(data.pricing.primary.outputPerMillion)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Fallback in / out</span>
                <span className="font-medium tabular-nums">
                  {usd(data.pricing.fallback.inputPerMillion)} / {usd(data.pricing.fallback.outputPerMillion)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan quotas</CardTitle>
            <CardDescription>Per-user AI request allowances. Admins bypass these entirely.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.plans.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{plan.name}</Badge>
                  {plan.priceCentavos != null && (
                    <span className="text-xs text-muted-foreground">
                      ₱{(plan.priceCentavos / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
                <span className="font-medium tabular-nums">
                  {plan.monthlyRequests == null ? "Unlimited" : `${count(plan.monthlyRequests)} requests`}
                </span>
              </div>
            ))}
            {data.packs.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Extra request packs</p>
                {data.packs.map((pack) => (
                  <div key={pack.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">+{pack.requests} requests</span>
                    <span className="font-medium tabular-nums">₱{(pack.priceCentavos / 100).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConsumerTable
        title="User consumption"
        description="Every non-admin account that used AI this billing month. Search and sort by cost, requests, or tokens."
        rows={userConsumers}
        totals={userTotals}
        emptyLabel="No non-admin AI usage recorded yet this month."
      />

      <ConsumerTable
        title="Admin consumption"
        description="Platform admins and owners. Usage still counts toward the Gemini bill and budgets, but never consumes Free/Pro/School plan quotas."
        rows={adminConsumers}
        totals={adminTotals}
        emptyLabel="No admin AI usage recorded yet this month."
        showQuotaHint
      />
    </div>
  );
}

export default function ResourcesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (user !== undefined && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, isAdmin, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ai-usage-overview"],
    queryFn: () => api.getAiUsageOverview(),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  if (user !== undefined && !isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resources</h1>
        <p className="text-muted-foreground">
          Platform AI budgets, per-user consumption, remaining capacity, and the estimated Gemini bill for this billing month.
        </p>
      </div>

      {isLoading && <DataTableSkeleton />}
      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {(error as Error).message || "Could not load resource usage."}
          </CardContent>
        </Card>
      )}
      {data?.data && <OverviewBody data={data.data} />}
    </div>
  );
}
