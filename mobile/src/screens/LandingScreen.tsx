import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { useStaffStyles } from "../staff-ui";

export function LandingScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={local.brand}>Xevra</Text>
        <Text style={styles.title}>{t("landing.title")}</Text>
        <Text style={styles.body}>{t("landing.lead")}</Text>
        {(
          [
            ["landing.f1t", "landing.f1d"],
            ["landing.f2t", "landing.f2d"],
            ["landing.f3t", "landing.f3d"],
            ["landing.f4t", "landing.f4d"],
            ["landing.f5t", "landing.f5d"],
            ["landing.f6t", "landing.f6d"],
          ] as const
        ).map(([title, body]) => (
          <View key={title} style={styles.card}>
            <Text style={styles.title}>{t(title)}</Text>
            <Text style={styles.muted}>{t(body)}</Text>
          </View>
        ))}
        <Pressable style={styles.btn} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.btnText}>{t("landing.signIn")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  brand: { fontSize: 28, fontWeight: "800", color: "#4338CA" },
});
