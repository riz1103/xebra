import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { api, apiErrorMessage } from "../api";
import { SITE_ORIGIN } from "../config";
import { formatWhen } from "../format";
import { useT } from "../i18n";
import { QrCode } from "../qr";
import { useColors, type Palette } from "../theme";
import type { Certificate } from "../types";
import type { RootStackParamList } from "../navigation";

export function CertificateScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "Certificate">>();
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .issueCertificate(route.params.resultId)
      .then((res) => setCertificate(res.data ?? null))
      .catch((err) => setError(apiErrorMessage(err, t("cert.unavailableBody"))))
      .finally(() => setLoading(false));
  }, [route.params.resultId, t]);

  if (loading) {
    return (
      <View style={styles.page}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!certificate) {
    return (
      <View style={styles.page}>
        <Text style={styles.heading}>{t("cert.unavailable")}</Text>
        <Text style={styles.muted}>{error || t("cert.unavailableBody")}</Text>
      </View>
    );
  }

  const verifyUrl = `${SITE_ORIGIN}/verify/${encodeURIComponent(certificate.code)}`;
  const score = certificate.percentage != null ? t("cert.withScore", { percent: certificate.percentage }) : "";
  const when = certificate.completedAt ? t("cert.onDate", { date: formatWhen(certificate.completedAt) }) : "";

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable style={styles.share} onPress={() => Share.share({ message: verifyUrl, url: verifyUrl }).catch(() => undefined)}>
        <Text style={styles.shareText}>{t("cert.share")}</Text>
      </Pressable>
      <View style={styles.sheet}>
        <Text style={styles.brand}>XEVRA</Text>
        <Text style={styles.heading}>{t("cert.heading")}</Text>
        <Text style={styles.mutedDark}>{t("cert.certifies")}</Text>
        <Text style={styles.name}>{certificate.examineeName}</Text>
        <Text style={styles.mutedDark}>{t("cert.passed")}</Text>
        <Text style={styles.exam}>{certificate.examTitle}</Text>
        <Text style={styles.mutedDark}>{[score, when].filter(Boolean).join(" ")}</Text>
        <View style={styles.footer}>
          <View style={{ flex: 1, gap: 2 }}>
            {certificate.issuerName ? <Text style={styles.fine}>{t("cert.issuedBy", { name: certificate.issuerName })}</Text> : null}
            {certificate.issuedAt ? <Text style={styles.fine}>{t("cert.issued", { date: formatWhen(certificate.issuedAt) })}</Text> : null}
            <Text style={styles.fine}>{t("cert.id", { code: certificate.code })}</Text>
          </View>
          <View style={styles.qrWrap}>
            <QrCode value={verifyUrl} />
            <Text style={styles.fine}>{verifyUrl.replace(/^https?:\/\//, "")}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 32, gap: 12 },
    share: { alignSelf: "flex-end", backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
    shareText: { color: "#fff", fontWeight: "800" },
    sheet: {
      backgroundColor: "#fff",
      borderWidth: 6,
      borderColor: "#d97706",
      borderRadius: 12,
      padding: 20,
      gap: 8,
      alignItems: "center",
    },
    brand: { letterSpacing: 4, color: "#737373", fontWeight: "800", fontSize: 12 },
    heading: { fontSize: 26, fontWeight: "800", color: "#171717", textAlign: "center" },
    muted: { color: colors.muted, textAlign: "center", marginTop: 8 },
    mutedDark: { color: "#525252", textAlign: "center" },
    name: { fontSize: 28, fontWeight: "700", color: "#92400e", textAlign: "center" },
    exam: { fontSize: 20, fontWeight: "700", color: "#171717", textAlign: "center" },
    footer: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 16, width: "100%" },
    fine: { color: "#525252", fontSize: 11 },
    qrWrap: { alignItems: "center", gap: 4, maxWidth: 140 },
  });
}
