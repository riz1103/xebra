"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScoreBucket, ScoreHistoryPoint, WeeklyResultTrend } from "@/types";

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function ScoreDistributionChart({ data }: { data: ScoreBucket[] }) {
  if (!data.some((b) => b.count > 0)) return <EmptyChart message="No graded results yet." />;
  const rows = data.map((b) => ({ ...b, failed: b.count - b.passed }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="range" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(label) => `Score ${label}%`}
          />
          <Bar dataKey="passed" name="Passed" stackId="results" fill="#10b981" />
          <Bar dataKey="failed" name="Failed" stackId="results" fill="#f87171" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatWeek(weekStart: string) {
  const d = new Date(`${weekStart}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function PassRateTrendChart({ data }: { data: WeeklyResultTrend[] }) {
  if (!data.some((w) => w.count > 0)) return <EmptyChart message="No results in this period." />;
  const rows = data.map((w) => ({ ...w, label: formatWeek(w.weekStart) }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis yAxisId="rate" domain={[0, 100]} unit="%" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(label) => `Week of ${label}`}
            formatter={(value, name) => (name === "Results" ? [value, name] : [value == null ? "—" : `${value}%`, name])}
          />
          <Bar yAxisId="count" dataKey="count" name="Results" fill="var(--muted)" radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="passRate"
            name="Pass rate"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="averagePercentage"
            name="Average score"
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreHistoryChart({ data, passMark }: { data: ScoreHistoryPoint[]; passMark?: number }) {
  if (data.length < 2) {
    return <EmptyChart message={data.length === 1 ? "Take another exam to see your progress." : "No graded results yet."} />;
  }
  const rows = data.map((p, i) => ({
    ...p,
    index: i + 1,
    label: new Date(p.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis domain={[0, 100]} unit="%" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          {passMark != null && <ReferenceLine y={passMark} stroke="var(--muted-foreground)" strokeDasharray="4 3" />}
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(_, payload) => {
              const point = payload?.[0]?.payload as (ScoreHistoryPoint & { label: string }) | undefined;
              return point ? `${point.examTitle || "Exam"} · ${point.label}` : "";
            }}
            formatter={(value, _name, item) => [
              `${value}% (${(item.payload as ScoreHistoryPoint).passed ? "passed" : "failed"})`,
              "Score",
            ]}
          />
          <Line
            type="monotone"
            dataKey="percentage"
            name="Score"
            stroke="#6366f1"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: ScoreHistoryPoint; index: number };
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={payload.passed ? "#10b981" : "#f87171"}
                  stroke="var(--background)"
                  strokeWidth={1.5}
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
