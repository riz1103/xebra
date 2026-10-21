import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { useColors, type Palette } from "../theme";

export function ExamEntryScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "ExamEntry">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useColors();
  const t = useT();
  const styles = makeStyles(colors);
  const { examId, invitationId } = route.params;
  const [title, setTitle] = useState(t("home.exam"));
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let gone = false;
    const load = invitationId
      ? api.getExamInvitation(invitationId).then((res) => res.data?.examTitle || t("home.exam"))
      : api.getExam(examId, false).then((res) => res.data?.title || t("home.exam"));
    load
      .then((next) => {
        if (!gone && next) setTitle(next);
      })
      .catch(() => {
        if (!gone) setTitle(t("home.exam"));
      });
    return () => {
      gone = true;
    };
  }, [examId, invitationId, t]);

  const start = async () => {
    setStarting(true);
    setError("");
    try {
      const res = await api.createExamSession(invitationId ? { invitationId } : { examId });
      const sessionId = res.data?.id;
      if (!sessionId) throw new Error(t("entry.didNotStart"));
      navigation.replace("Exam", { sessionId });
    } catch (err) {
      setError(apiErrorMessage(err, t("entry.couldNotStart")));
      setStarting(false);
    }
  };

  return (
    <View style={styles.page}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{t("entry.body")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.primary, starting && styles.disabled]} disabled={starting} onPress={start}>
        {starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t("entry.start")}</Text>}
      </Pressable>
      <Pressable style={styles.secondary} disabled={starting} onPress={() => navigation.navigate("Home")}>
        <Text style={styles.secondaryText}>{t("entry.notNow")}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center" },
    title: { fontSize: 26, fontWeight: "800", color: colors.text },
    body: { marginTop: 12, color: colors.muted, fontSize: 16, lineHeight: 24 },
    error: { marginTop: 16, color: colors.danger },
    primary: { marginTop: 24, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    disabled: { opacity: 0.6 },
    secondary: { marginTop: 12, alignItems: "center", paddingVertical: 12 },
    secondaryText: { color: colors.primary, fontWeight: "700" },
  });
}
