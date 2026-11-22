import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import { Field, StaffBody, useStaffStyles } from "../staff-ui";
import type { AiUsageConsumer, AiUsageOverview } from "../types";

const usd = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

const count = (value: number) => value.toLocaleString();

type SortKey = "costUsd" | "requests" | "totalTokens" | "name";

const SORTS: { key: SortKey; label: "resources.sortCost" | "resources.sortRequests" | "resources.sortTokens" | "resources.sortName" }[] = [
  { key: "costUsd", label: "resources.sortCost" },
  { key: "requests", label: "resources.sortRequests" },
  { key: "totalTokens", label: "resources.sortTokens" },
  { key: "name", label: "resources.sortName" },
];

function Row({ label, value }: { label: string; value: string }) {
  const { styles } = useStaffStyles();
  return (
    <View style={styles.row}>
      <Text style={[styles.muted, { flex: 1 }]}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>
  );
}

function filterSort(rows: AiUsageConsumer[], search: string, sortKey: SortKey): AiUsageConsumer[] {
  const q = search.trim().toLowerCase();
  const filtered = !q
    ? rows
    : rows.filter((row) => `${row.name || ""} ${row.email || ""} ${row.role || ""} ${row.userId}`.toLowerCase().includes(q));
  return [...filtered].sort((a, b) => {
    if (sortKey === "name") {
      return (a.name || a.email || a.userId).localeCompare(b.name || b.email || b.userId);
    }
    return (b[sortKey] || 0) - (a[sortKey] || 0);
  });
}

function ConsumerList({
  title,
  subtitle,
  rows,
  search,
  onSearch,
  sortKey,
  onSort,
  empty,
  quotaNote,
}: {
  title: string;
  subtitle: string;
  rows: AiUsageConsumer[];
  search: string;
  onSearch: (value: string) => void;
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
  empty: string;
  quotaNote?: boolean;
}) {
  const t = useT();
  const { styles } = useStaffStyles();
  const visible = useMemo(() => filterSort(rows, search, sortKey), [rows, search, sortKey]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.muted}>{subtitle}</Text>
      <Field label={t("resources.search")} value={search} onChangeText={onSearch} placeholder={t("resources.searchHint")} />
      <View style={styles.row}>
        {SORTS.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.chip, sortKey === item.key && styles.chipOn]}
            onPress={() => onSort(item.key)}
          >
            <Text style={[styles.chipText, sortKey === item.key && styles.chipTextOn]}>{t(item.label)}</Text>
          </Pressable>
        ))}
      </View>
      {rows.length === 0 ? <Text style={styles.muted}>{empty}</Text> : null}
      {rows.length > 0 && visible.length === 0 ? (
        <Text style={styles.muted}>{t("resources.noMatch")}</Text>
      ) : null}
      {visible.map((user) => (
        <View key={user.userId} style={{ gap: 2, paddingTop: 4 }}>
          <Text style={styles.body}>{user.name || user.email || user.userId}</Text>
          <Text style={styles.muted}>
            {user.role || "user"} · {count(user.requests)} {t("resources.reqShort")} · {count(user.totalTokens)}{" "}
            {t("resources.tokensShort")} · {usd(user.costUsd)}
          </Text>
          {quotaNote && !user.countsTowardPlanQuota ? (
            <Text style={styles.muted}>{t("resources.noPlanQuota")}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function ResourcesScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const [data, setData] = useState<AiUsageOverview | null>(null);
  const [error, setError] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [userSort, setUserSort] = useState<SortKey>("costUsd");
  const [adminSort, setAdminSort] = useState<SortKey>("costUsd");

  const load = useCallback(async () => {
    try {
      const res = await api.getAiUsageOverview();
      setData(res.data || null);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, t("resources.loadError")));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const userConsumers = data?.userConsumers ?? data?.consumers?.filter((c) => !c.isAdmin) ?? [];
  const adminConsumers = data?.adminConsumers ?? data?.consumers?.filter((c) => c.isAdmin) ?? [];

  return (
    <StaffBody>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!data && !error ? <Text style={styles.muted}>{t("resources.loading")}</Text> : null}
      {data ? (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>{t("resources.bill")}</Text>
            <Text style={styles.body}>{usd(data.bill.estimatedUsd)}</Text>
            <Text style={styles.muted}>
              {usd(data.bill.remainingCapUsd)} {t("resources.leftOf")} {usd(data.limits.monthlyCapUsd)}
            </Text>
            <Text style={styles.muted}>
              {data.period} · {data.timeZone}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{t("resources.usage")}</Text>
            <Row label={t("resources.requests")} value={count(data.totals.requests)} />
            <Row label={t("resources.tokensUsed")} value={count(data.totals.totalTokens)} />
            <Row
              label={t("resources.tokensRemaining")}
              value={
                data.totals.estimatedRemainingTokens == null
                  ? "—"
                  : count(data.totals.estimatedRemainingTokens)
              }
            />
            <Row
              label={t("resources.userSpend")}
              value={`${usd(data.userTotals?.costUsd ?? 0)} · ${count(data.userTotals?.users ?? userConsumers.length)}`}
            />
            <Row
              label={t("resources.adminSpend")}
              value={`${usd(data.adminTotals?.costUsd ?? 0)} · ${count(data.adminTotals?.users ?? adminConsumers.length)}`}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{t("resources.primary")}</Text>
            <Row label={t("resources.requests")} value={count(data.tiers.primary.requests)} />
            <Row label={t("resources.tokensUsed")} value={count(data.tiers.primary.totalTokens)} />
            <Row label={t("resources.cost")} value={usd(data.tiers.primary.costUsd)} />
            <Row
              label={t("resources.budgetLeft")}
              value={`${usd(data.tiers.primary.remainingBudgetUsd ?? 0)} / ${usd(data.limits.primaryMonthlyBudgetUsd)}`}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{t("resources.fallback")}</Text>
            <Row label={t("resources.requests")} value={count(data.tiers.fallback.requests)} />
            <Row label={t("resources.tokensUsed")} value={count(data.tiers.fallback.totalTokens)} />
            <Row label={t("resources.cost")} value={usd(data.tiers.fallback.costUsd)} />
          </View>

          <ConsumerList
            title={t("resources.userConsumers")}
            subtitle={t("resources.userConsumersHint")}
            rows={userConsumers}
            search={userSearch}
            onSearch={setUserSearch}
            sortKey={userSort}
            onSort={setUserSort}
            empty={t("resources.usersEmpty")}
          />

          <ConsumerList
            title={t("resources.adminConsumers")}
            subtitle={t("resources.adminConsumersHint")}
            rows={adminConsumers}
            search={adminSearch}
            onSearch={setAdminSearch}
            sortKey={adminSort}
            onSort={setAdminSort}
            empty={t("resources.adminsEmpty")}
            quotaNote
          />

          <Text style={styles.muted}>{data.bill.note}</Text>
        </>
      ) : null}
    </StaffBody>
  );
}
