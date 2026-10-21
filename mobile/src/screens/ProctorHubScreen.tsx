import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { StaffBody, useStaffStyles } from "../staff-ui";

type HubRoute = "ManagedExams" | "QuestionBank" | "Bundles" | "Invitations" | "Groups" | "ManagedResults" | "Organizations" | "Settings";

const LINKS: { key: HubRoute; label: "hub.exams" | "hub.bank" | "hub.bundles" | "hub.invites" | "hub.groups" | "hub.results" | "hub.orgs" | "hub.settings" }[] = [
  { key: "ManagedExams", label: "hub.exams" },
  { key: "QuestionBank", label: "hub.bank" },
  { key: "Bundles", label: "hub.bundles" },
  { key: "Invitations", label: "hub.invites" },
  { key: "Groups", label: "hub.groups" },
  { key: "ManagedResults", label: "hub.results" },
  { key: "Organizations", label: "hub.orgs" },
  { key: "Settings", label: "hub.settings" },
];

export function ProctorHubScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <StaffBody>
      {LINKS.map((item) => (
        <Pressable key={item.key} style={styles.card} onPress={() => navigation.navigate(item.key)}>
          <Text style={styles.title}>{t(item.label)}</Text>
        </Pressable>
      ))}
      {user?.role === "admin" ? (
        <View style={{ gap: 12 }}>
          <Pressable style={styles.card} onPress={() => navigation.navigate("QuestionTypes")}>
            <Text style={styles.title}>{t("hub.types")}</Text>
          </Pressable>
          <Pressable style={styles.card} onPress={() => navigation.navigate("AdminRequests")}>
            <Text style={styles.title}>{t("hub.requests")}</Text>
          </Pressable>
        </View>
      ) : null}
    </StaffBody>
  );
}
