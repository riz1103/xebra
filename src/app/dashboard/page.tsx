"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResultOutcomeBadge } from "@/components/results/result-outcome-badge";
import { PassRateTrendChart, ScoreDistributionChart } from "@/components/results/result-charts";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import {
  FileText,
  Package,
  Users,
  Mail,
  BarChart3,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isProctorOrAdmin = user?.role === "proctor" || user?.role === "admin";

  if (isProctorOrAdmin) return <ProctorDashboard />;
  return <ExamineeDashboard />;
}

function ProctorDashboard() {
  const { data: examsData, isLoading: examsLoading } = useQuery({
    queryKey: ["exams", 1],
    queryFn: () => api.getExams({ page: 1, size: DEFAULT_PAGE_SIZE }),
  });

  const { data: bundlesData, isLoading: bundlesLoading } = useQuery({
    queryKey: ["bundles", 1],
    queryFn: () => api.getExamBundles({ page: 1, size: DEFAULT_PAGE_SIZE }),
  });

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups", 1],
    queryFn: () => api.getExamineeGroups({ page: 1, size: DEFAULT_PAGE_SIZE }),
  });

  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ["results", "managed", "recent"],
    queryFn: () => api.getExamResults({ scope: "managed", page: 1, size: DEFAULT_PAGE_SIZE }),
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["results", "stats", "managed"],
    queryFn: () => api.getExamResultStats({ scope: "managed", weeks: 12 }),
  });

  const exams = examsData?.data || [];
  const bundles = bundlesData?.data || [];
  const groups = groupsData?.data || [];
  const results = resultsData?.data || [];
  const resultStats = statsData?.data;
  const isLoading = examsLoading || bundlesLoading || groupsLoading || resultsLoading;

  const totalExams = examsData?.pagination?.total ?? exams.length;
  const totalBundles = bundlesData?.pagination?.total ?? bundles.length;
  const totalGroups = groupsData?.pagination?.total ?? groups.length;
  const totalResults = resultsData?.pagination?.total ?? results.length;

  const stats = [
    { label: "Total Exams", value: totalExams, icon: FileText, color: "text-blue-500", href: "/dashboard/exams" },
    { label: "Exam Bundles", value: totalBundles, icon: Package, color: "text-purple-500", href: "/dashboard/bundles" },
    { label: "Groups", value: totalGroups, icon: Users, color: "text-emerald-500", href: "/dashboard/groups" },
    { label: "Results", value: totalResults, icon: BarChart3, color: "text-amber-500", href: "/dashboard/results" },
  ];

  const activeExams = exams.filter((e) => e.status === "active");
  const avgScore = resultStats?.averagePercentage ?? (results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length)
    : 0);
  const passRate = resultStats?.passRate ?? (results.length > 0
    ? Math.round((results.filter((r) => r.passed).length / results.length) * 100)
    : 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="text-muted-foreground">Manage your examinations and monitor results.</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/exams/create">
            <Plus className="mr-2 h-4 w-4" /> Create Exam
          </Link>
        </Button>
      </div>

      <OnboardingChecklist exams={exams} totalExams={totalExams} totalResults={totalResults} isLoading={isLoading} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-shadow hover:shadow-md cursor-pointer">
              <CardHeader className="flex flex-row items-start justify-between gap-1 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground leading-tight sm:text-sm">{stat.label}</CardTitle>
                <stat.icon className={`h-4 w-4 shrink-0 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-xl font-bold sm:text-2xl">{stat.value}</div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active Exams</span>
              <Badge variant="success">{activeExams.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Average Score</span>
              <Badge variant={avgScore >= 70 ? "success" : "warning"}>{avgScore}%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pass Rate</span>
              <Badge variant="secondary">{passRate}%</Badge>
            </div>
            {(resultStats?.pendingReview ?? 0) > 0 && (
              <Link
                href="/dashboard/results"
                className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
              >
                <span>Results awaiting essay grading</span>
                <Badge variant="warning">{resultStats!.pendingReview}</Badge>
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Exams</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/exams">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (<Skeleton key={i} className="h-12 w-full" />))}
              </div>
            ) : exams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No exams created yet.</p>
            ) : (
              <div className="space-y-3">
                {exams.slice(0, 5).map((exam) => (
                  <Link
                    key={exam.id}
                    href={`/dashboard/exams/${exam.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {exam.questionCount || 0} questions &middot; {exam.timeLimit} min
                      </p>
                    </div>
                    <Badge
                      className="shrink-0"
                      variant={
                        exam.status === "active" ? "success" : exam.status === "draft" ? "secondary" : "outline"
                      }
                    >
                      {exam.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score Distribution</CardTitle>
            <CardDescription>
              {resultStats ? `${resultStats.graded} graded result${resultStats.graded === 1 ? "" : "s"} by percentage` : "Graded results by percentage"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-56 w-full" /> : <ScoreDistributionChart data={resultStats?.distribution ?? []} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pass Rate Trend</CardTitle>
            <CardDescription>Weekly results, pass rate and average score over the last 12 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-56 w-full" /> : <PassRateTrendChart data={resultStats?.trend ?? []} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExamineeDashboard() {
  const { data: invitationsData, isLoading: invLoading } = useQuery({
    queryKey: ["my-invitations", 1],
    queryFn: () => api.getExamInvitations({ page: 1, size: DEFAULT_PAGE_SIZE }),
  });

  const { data: resultsData, isLoading: resLoading } = useQuery({
    queryKey: ["my-results", "recent"],
    queryFn: () => api.getExamResults({ scope: "mine", page: 1, size: DEFAULT_PAGE_SIZE }),
  });

  const { data: sessionsData, isLoading: sessLoading } = useQuery({
    queryKey: ["my-sessions", 1],
    queryFn: () => api.getExamSessions({ page: 1, size: DEFAULT_PAGE_SIZE }),
  });

  const invitations = invitationsData?.data || [];
  const results = resultsData?.data || [];
  const sessions = sessionsData?.data || [];
  const isLoading = invLoading || resLoading || sessLoading;

  const pendingInvitations = invitations.filter((i) => i.status === "pending");
  const inProgressSessions = sessions.filter((s) => s.status === "in_progress" || s.status === "in-progress");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Dashboard</h1>
        <p className="text-muted-foreground">View your upcoming exams and results.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-1 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground leading-tight sm:text-sm">Pending Exams</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-xl font-bold sm:text-2xl">{pendingInvitations.length}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-1 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground leading-tight sm:text-sm">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-xl font-bold sm:text-2xl">{inProgressSessions.length}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-1 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground leading-tight sm:text-sm">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-xl font-bold sm:text-2xl">{results.length}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>Exams you&apos;ve been invited to take</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (<Skeleton key={i} className="h-16 w-full" />))}
            </div>
          ) : pendingInvitations.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No pending invitations.</p>
          ) : (
            <div className="space-y-3">
              {pendingInvitations.map((inv) => (
                <div key={inv.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{inv.examTitle || "Exam"}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button asChild size="sm" className="w-full sm:w-auto">
                    <Link href={`/dashboard/my-exams?start=${inv.id}`}>
                      Start Exam <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Results */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Results</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (<Skeleton key={i} className="h-16 w-full" />))}
            </div>
          ) : results.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No results yet.</p>
          ) : (
            <div className="space-y-3">
              {results.slice(0, 5).map((result) => (
                <Link
                  key={result.id}
                  href={`/dashboard/my-results/${result.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{result.examTitle || "Exam"}</p>
                    <p className="text-xs text-muted-foreground">
                      Score: {result.score}/{result.totalPoints}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-medium">{result.percentage}%</span>
                    <ResultOutcomeBadge result={result} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
