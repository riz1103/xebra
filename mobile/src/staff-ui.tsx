import { useMemo, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useColors, type Palette } from "./theme";

export function useStaffStyles() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return { colors, styles };
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    pad: { padding: 16, gap: 12, paddingBottom: 48 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 8,
    },
    title: { color: colors.text, fontSize: 17, fontWeight: "700" },
    body: { color: colors.text, fontSize: 15 },
    muted: { color: colors.muted, fontSize: 13 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.card,
    },
    btn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    btnText: { color: "#fff", fontWeight: "700" },
    ghost: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignItems: "center",
      backgroundColor: colors.card,
    },
    ghostText: { color: colors.text, fontWeight: "600" },
    danger: { color: colors.danger, fontWeight: "700" },
    row: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
    chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.tab },
    chipOn: { backgroundColor: colors.primary },
    chipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
    chipTextOn: { color: "#fff" },
    error: { color: colors.danger, fontSize: 13 },
    ok: { color: colors.success, fontSize: 13 },
  });
}

export function StaffBody({ children }: { children: ReactNode }) {
  const { styles } = useStaffStyles();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalizeOff,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad";
  autoCapitalizeOff?: boolean;
}) {
  const { styles } = useStaffStyles();
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9A94A8"
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalizeOff || keyboardType === "email-address" ? "none" : "sentences"}
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: "top" }]}
      />
    </View>
  );
}

export function Primary({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { styles } = useStaffStyles();
  return (
    <Pressable style={[styles.btn, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

export function Ghost({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const { styles } = useStaffStyles();
  return (
    <Pressable style={styles.ghost} onPress={onPress}>
      <Text style={danger ? styles.danger : styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

export function Choice({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const { styles } = useStaffStyles();
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}
