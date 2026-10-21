import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth";
import { formatWhen } from "../format";
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
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const name = user?.name || user?.displayName || "Account";

  return (
    <View style={styles.page}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(name, user?.email)}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.role}>{user?.role || "examinee"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email}</Text>
        {user?.createdAt ? (
          <>
            <Text style={styles.label}>Member since</Text>
            <Text style={styles.value}>{formatWhen(user.createdAt)}</Text>
          </>
        ) : null}
      </View>

      <Pressable style={styles.row} onPress={toggle}>
        <Text style={styles.rowLabel}>Appearance</Text>
        <Text style={styles.rowValue}>{scheme === "dark" ? "Dark" : "Light"}</Text>
      </Pressable>

      <Pressable style={styles.signOut} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
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
