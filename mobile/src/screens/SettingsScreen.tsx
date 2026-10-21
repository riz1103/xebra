import { useCallback, useEffect, useState } from "react";
import { Image, Linking, Switch, Text, View } from "react-native";
import { api, apiErrorMessage } from "../api";
import { devicePushToken } from "../push";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import { Choice, Field, Ghost, Primary, StaffBody, useStaffStyles } from "../staff-ui";
import type { AiPack, AiPlan, IntegrationStatus, NotificationPrefs, PaymongoCheckout, Webhook } from "../types";

const DEFAULT_PREFS: NotificationPrefs = { resultEmails: true, reminderEmails: true, dailySummary: false };

export function SettingsScreen() {
  const t = useT();
  const { colors, styles } = useStaffStyles();
  const { user } = useAuth();
  const staff = user?.role === "proctor" || user?.role === "admin";
  const [prefs, setPrefs] = useState<NotificationPrefs>(user?.notificationPrefs || DEFAULT_PREFS);
  const [plans, setPlans] = useState<AiPlan[]>([]);
  const [packs, setPacks] = useState<AiPack[]>([]);
  const [planName, setPlanName] = useState("");
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [checkout, setCheckout] = useState<PaymongoCheckout | null>(null);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignPlan, setAssignPlan] = useState<AiPlan["id"]>("pro");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [me, planRes, usage] = await Promise.all([api.getMe(), api.getPlans(), api.getAiUsage()]);
      if (me.data?.notificationPrefs) setPrefs({ ...DEFAULT_PREFS, ...me.data.notificationPrefs });
      setPlans(planRes.data || []);
      setPacks(planRes.packs || []);
      setPlanName(usage.data?.plan?.name || "");
      if (staff) {
        const [hookRes, statusRes] = await Promise.all([api.getWebhooks(), api.getIntegrationStatus()]);
        setHooks(hookRes.data || []);
        setIntegrations(statusRes.data);
      }
    } catch (err) {
      setError(apiErrorMessage(err, t("overview.loadError")));
    }
  }, [staff, t]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (!checkout || checkout.status !== "pending") return;
    const timer = setInterval(() => {
      api
        .getPaymongoCheckout(checkout.paymentIntentId)
        .then((res) => {
          setCheckout(res.data);
          if (res.data.status === "paid") setNotice(t("settings.paid"));
        })
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(timer);
  }, [checkout, t]);

  async function toggle(key: keyof NotificationPrefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await api.updatePreferences({ [key]: value });
      setNotice(t("settings.saved"));
    } catch (err) {
      setError(apiErrorMessage(err, t("overview.loadError")));
    }
  }

  const integrationRows: { key: keyof IntegrationStatus; label: "settings.paymongo" | "settings.push" | "settings.classroom" | "settings.lti" | "settings.sheets" | "settings.webhooks" }[] = [
    { key: "paymongo", label: "settings.paymongo" },
    { key: "push", label: "settings.push" },
    { key: "googleClassroom", label: "settings.classroom" },
    { key: "lti", label: "settings.lti" },
    { key: "googleSheets", label: "settings.sheets" },
    { key: "webhooks", label: "settings.webhooks" },
  ];

  return (
    <StaffBody>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.ok}>{notice}</Text> : null}
      <Text style={styles.title}>{t("settings.notifications")}</Text>
      <Pref label={t("settings.resultEmails")} value={prefs.resultEmails} color={colors.primary} onChange={(value) => toggle("resultEmails", value)} />
      <Pref label={t("settings.reminderEmails")} value={prefs.reminderEmails} color={colors.primary} onChange={(value) => toggle("reminderEmails", value)} />
      {staff ? (
        <Pref label={t("settings.dailySummary")} value={prefs.dailySummary} color={colors.primary} onChange={(value) => toggle("dailySummary", value)} />
      ) : null}

      <Text style={styles.title}>{t("settings.plan")}</Text>
      <Text style={styles.body}>{planName || "—"}</Text>
      {staff && integrations?.paymongo
        ? plans
            .filter((plan) => plan.id !== "free" && plan.priceCentavos)
            .map((plan) => (
              <Ghost
                key={plan.id}
                label={`${plan.name} · ${t("settings.upgrade")}`}
                onPress={() => {
                  api
                    .startPaymongoCheckout({ plan: plan.id as "pro" | "school" })
                    .then((res) => setCheckout(res.data))
                    .catch((err) => setError(apiErrorMessage(err, t("overview.loadError"))));
                }}
              />
            ))
        : null}
      {staff && integrations?.paymongo ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.muted}>{t("settings.packs")}</Text>
          {packs.map((pack) => (
            <Ghost
              key={pack.id}
              label={`${pack.requests}`}
              onPress={() => {
                api
                  .startPaymongoCheckout({ pack: pack.id })
                  .then((res) => setCheckout(res.data))
                  .catch((err) => setError(apiErrorMessage(err, t("overview.loadError"))));
              }}
            />
          ))}
        </View>
      ) : null}
      {checkout?.qrImageUrl ? <Image source={{ uri: checkout.qrImageUrl }} style={{ width: 220, height: 220 }} /> : null}
      {checkout?.testUrl ? <Ghost label={checkout.testUrl} onPress={() => Linking.openURL(checkout.testUrl as string)} /> : null}
      {user?.role === "admin" ? (
        <View style={styles.card}>
          <Text style={styles.title}>{t("settings.assign")}</Text>
          <Field label={t("invites.email")} value={assignEmail} onChangeText={setAssignEmail} keyboardType="email-address" />
          <View style={styles.row}>
            {(["free", "pro", "school"] as const).map((id) => (
              <Choice key={id} label={id} on={assignPlan === id} onPress={() => setAssignPlan(id)} />
            ))}
          </View>
          <Primary
            label={t("common.save")}
            onPress={() => {
              api
                .setUserPlan(assignEmail.trim(), assignPlan)
                .then(() => setNotice(t("settings.saved")))
                .catch((err) => setError(apiErrorMessage(err, t("overview.loadError"))));
            }}
          />
        </View>
      ) : null}

      {staff ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.title}>{t("settings.webhooks")}</Text>
          <Field label={t("settings.webhookUrl")} value={url} onChangeText={setUrl} autoCapitalizeOff />
          <Primary
            label={t("settings.addWebhook")}
            onPress={() => {
              api
                .createWebhook({ url: url.trim(), events: ["result.submitted", "result.graded"] })
                .then((res) => {
                  setSecret(res.data.secret || "");
                  setUrl("");
                  return load();
                })
                .catch((err) => setError(apiErrorMessage(err, t("overview.loadError"))));
            }}
          />
          {secret ? (
            <Text style={styles.body}>
              {t("settings.secret")}: {secret}
            </Text>
          ) : null}
          {hooks.map((hook) => (
            <View key={hook.id} style={styles.card}>
              <Text style={styles.body}>{hook.url}</Text>
              <Text style={styles.muted}>{hook.active ? t("exams.active") : t("exams.archived")}</Text>
              <View style={styles.row}>
                <Ghost label={hook.active ? t("groups.disable") : t("exams.active")} onPress={() => api.updateWebhook(hook.id, { active: !hook.active }).then(load)} />
                <Ghost label={t("common.delete")} danger onPress={() => api.deleteWebhook(hook.id).then(load)} />
              </View>
            </View>
          ))}
          <Text style={styles.title}>{t("settings.integrations")}</Text>
          {integrationRows.map((row) => (
            <View key={row.key} style={styles.card}>
              <Text style={styles.body}>{t(row.label)}</Text>
              <Text style={styles.muted}>{integrations?.[row.key] ? t("settings.ready") : t("settings.needsKeys")}</Text>
              {row.key === "push" ? (
                <Ghost
                  label={t("settings.enablePush")}
                  onPress={() => {
                    devicePushToken()
                      .then((token) => api.subscribeMobilePush(token))
                      .then(() => setNotice(t("settings.pushOn")))
                      .catch((err) => setError(apiErrorMessage(err, t("overview.loadError"))));
                  }}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </StaffBody>
  );
}

function Pref({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  color: string;
}) {
  const { styles } = useStaffStyles();
  return (
    <View style={[styles.row, { justifyContent: "space-between" }]}>
      <Text style={styles.body}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: color }} />
    </View>
  );
}
