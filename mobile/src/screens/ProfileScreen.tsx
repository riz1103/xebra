import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../navigation";
import { formatWhen } from "../format";
import { LOCALES, roleLabel, useLocale, useT } from "../i18n";
import { useColors, useTheme, type Palette } from "../theme";

function initials(name: string | undefined, email: string | undefined): string {
  const source = (name || email || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { colors, scheme, toggle } = useTheme();
  const { locale, setLocale } = useLocale();
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const name = user?.name || user?.displayName || t("profile.account");

  return (
    <View style={styles.page}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(name, user?.email)}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.role}>{roleLabel(t, user?.role)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t("profile.email")}</Text>
        <Text style={styles.value}>{user?.email}</Text>
        {user?.createdAt ? (
          <>
            <Text style={styles.label}>{t("profile.memberSince")}</Text>
            <Text style={styles.value}>{formatWhen(user.createdAt)}</Text>
          </>
        ) : null}
      </View>

      <Pressable style={styles.row} onPress={() => setLocale(locale === "en" ? "fil" : "en")}>
        <Text style={styles.rowLabel}>{t("profile.language")}</Text>
        <Text style={styles.rowValue}>{LOCALES[locale]}</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={toggle}>
        <Text style={styles.rowLabel}>{t("profile.appearance")}</Text>
        <Text style={styles.rowValue}>{scheme === "dark" ? t("login.dark") : t("login.light")}</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={() => navigation.navigate("Settings")}>
        <Text style={styles.rowLabel}>{t("profile.settings")}</Text>
      </Pressable>

      <Pressable style={styles.signOut} onPress={() => signOut()}>
        <Text style={styles.signOutText}>{t("profile.signOut")}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg, padding: 20 },
    identity: { alignItems: "center", marginTop: 12 },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: colors.primary, fontSize: 24, fontWeight: "800" },
    name: { marginTop: 12, fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center" },
    role: { marginTop: 4, color: colors.muted, textTransform: "capitalize" },
    card: {
      marginTop: 24,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    label: { marginTop: 12, color: colors.muted, fontSize: 12, fontWeight: "700" },
    value: { marginTop: 2, color: colors.text, fontSize: 16 },
    row: {
      marginTop: 12,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    rowLabel: { color: colors.text, fontSize: 16, fontWeight: "700" },
    rowValue: { color: colors.primary, fontWeight: "700" },
    signOut: { marginTop: 20, backgroundColor: colors.dangerBg, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    signOutText: { color: colors.danger, fontWeight: "800", fontSize: 16 },
  });
}
