import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { api } from "../api";
import { formatWhen } from "../format";
import { useT } from "../i18n";
import { useColors, type Palette } from "../theme";
import type { Certificate } from "../types";
import type { RootStackParamList } from "../navigation";

export function VerifyScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "Verify">>();
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const code = route.params.code;

  useEffect(() => {
    setLoading(true);
    setCertificate(null);
    setNotFound(false);
    setFailed(false);
    api
      .verifyCertificate(code)
      .then((res) => setCertificate(res.data ?? null))
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 404) setNotFound(true);
        else setFailed(true);
      })
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <View style={styles.page}>
      <Text style={styles.brand}>XEVRA</Text>
      <View style={styles.card}>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {certificate ? (
          <>
            <Text style={[styles.title, { color: certificate.valid ? colors.success : colors.warning }]}>
              {certificate.valid ? t("verify.valid") : t("verify.invalid")}
            </Text>
            {!certificate.valid && certificate.reason ? <Text style={styles.muted}>{certificate.reason}</Text> : null}
            <Row label={t("verify.awarded")} value={certificate.examineeName || "—"} />
            <Row label={t("verify.exam")} value={certificate.examTitle || "—"} />
            {certificate.percentage != null ? <Row label={t("verify.score")} value={`${certificate.percentage}%`} /> : null}
            {certificate.completedAt ? <Row label={t("verify.completed")} value={formatWhen(certificate.completedAt)} /> : null}
            {certificate.issuerName ? <Row label={t("verify.issuedBy")} value={certificate.issuerName} /> : null}
            {certificate.issuedAt ? <Row label={t("verify.issued")} value={formatWhen(certificate.issuedAt)} /> : null}
            <Row label={t("verify.id")} value={certificate.code} mono />
          </>
        ) : null}
        {!loading && !certificate ? (
          <>
            <Text style={[styles.title, { color: colors.danger }]}>{notFound ? t("verify.notFound") : t("verify.couldNot")}</Text>
            <Text style={styles.muted}>{notFound ? t("verify.notFoundBody", { code }) : failed ? t("verify.couldNotBody") : t("verify.couldNotBody")}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg, padding: 20, justifyContent: "center" },
    brand: { textAlign: "center", fontSize: 22, fontWeight: "800", color: colors.primary, marginBottom: 16 },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
    title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
    muted: { color: colors.muted, lineHeight: 20 },
    row: { flexDirection: "row", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderStyle: "dashed", borderBottomColor: colors.border, paddingVertical: 8 },
    value: { flex: 1, textAlign: "right", color: colors.text, fontWeight: "700" },
    mono: { fontVariant: ["tabular-nums"] },
  });
}
