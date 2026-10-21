import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api, apiErrorMessage } from "../api";
import { useAuth } from "../auth";
import { formatWhen } from "../format";
import { roleLabel, useT } from "../i18n";
import { useColors, type Palette } from "../theme";
import type { ProctorRequest } from "../types";

export function ProctorRequestScreen() {
  const { user } = useAuth();
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [requests, setRequests] = useState<ProctorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [extra, setExtra] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await api.getProctorRequests();
    setRequests(res.data ?? []);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(apiErrorMessage(err, t("proctor.loadError"))))
      .finally(() => setLoading(false));
  }, [load, t]);

  const already = user?.role === "proctor" || user?.role === "admin";
  if (already) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t("proctor.already", { role: roleLabel(t, user?.role) })}</Text>
        <Text style={styles.muted}>{t("proctor.alreadyBody")}</Text>
      </View>
    );
  }

  const pending = requests.some((request) => request.status === "pending");
  const submit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 10) return setFieldError(t("proctor.reasonShort"));
    if (trimmed.length > 500) return setFieldError(t("proctor.reasonLong"));
    if (extra.trim().length > 1000) return setFieldError(t("proctor.extraLong"));
    setBusy(true);
    setFieldError("");
    setNotice("");
    try {
      await api.createProctorRequest({ reason: trimmed, additionalInfo: extra.trim() || undefined });
      setReason("");
      setExtra("");
      setNotice(t("proctor.submitted"));
      await load();
    } catch (err) {
      setFieldError(apiErrorMessage(err, t("proctor.submitError")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t("proctor.title")}</Text>
      <Text style={styles.muted}>{t("proctor.subtitle")}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {requests.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("proctor.yourRequests")}</Text>
          {requests.map((request) => (
            <View key={request.id} style={styles.item}>
              <Text style={[styles.status, request.status === "approved" ? styles.pass : request.status === "rejected" ? styles.fail : styles.warn]}>
                {request.status === "approved" ? t("proctor.approved") : request.status === "rejected" ? t("proctor.rejected") : t("proctor.pending")}
              </Text>
              <Text style={styles.muted}>{formatWhen(request.createdAt)}</Text>
              {request.reviewNotes ? <Text style={styles.body}>{t("proctor.review", { notes: request.reviewNotes })}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
      {!pending && !loading ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("proctor.submitTitle")}</Text>
          <Text style={styles.muted}>{t("proctor.submitDesc")}</Text>
          <Text style={styles.label}>{t("proctor.reason")}</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={reason}
            onChangeText={setReason}
            placeholder={t("proctor.reasonPlaceholder")}
            placeholderTextColor={colors.muted}
            multiline
          />
          <Text style={styles.label}>{t("proctor.extra")}</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={extra}
            onChangeText={setExtra}
            placeholder={t("proctor.extraPlaceholder")}
            placeholderTextColor={colors.muted}
            multiline
          />
          {fieldError ? <Text style={styles.error}>{fieldError}</Text> : null}
          <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={submit}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t("proctor.submit")}</Text>}
          </Pressable>
        </View>
      ) : null}
      {pending ? (
        <View style={[styles.card, styles.pendingCard]}>
          <Text style={styles.cardTitle}>{t("proctor.pendingTitle")}</Text>
          <Text style={styles.muted}>{t("proctor.pendingBody")}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
    title: { fontSize: 26, fontWeight: "800", color: colors.text, textAlign: "center" },
    muted: { color: colors.muted, lineHeight: 20 },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 },
    pendingCard: { borderColor: colors.warning },
    cardTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
    item: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 2 },
    status: { fontWeight: "800", textTransform: "capitalize" },
    pass: { color: colors.success },
    fail: { color: colors.danger },
    warn: { color: colors.warning },
    body: { color: colors.text },
    label: { color: colors.text, fontWeight: "700", marginTop: 4 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, backgroundColor: colors.bg },
    area: { minHeight: 96, textAlignVertical: "top" },
    primary: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    primaryText: { color: "#fff", fontWeight: "800" },
    disabled: { opacity: 0.5 },
    error: { color: colors.danger },
    notice: { color: colors.success, fontWeight: "700" },
  });
}
