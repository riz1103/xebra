import { useEffect, useRef, useState } from "react";
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/auth";
import { LocaleProvider, useT } from "./src/i18n";
import { parseAppLink, type AppLink } from "./src/links";
import { AdminRequestsScreen } from "./src/screens/AdminRequestsScreen";
import { BundlesScreen } from "./src/screens/BundlesScreen";
import { CertificateScreen } from "./src/screens/CertificateScreen";
import { ExamEntryScreen } from "./src/screens/ExamEntryScreen";
import { ExamFormScreen } from "./src/screens/ExamFormScreen";
import { ExamScreen } from "./src/screens/ExamScreen";
import { GroupsScreen } from "./src/screens/GroupsScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { InvitationsScreen } from "./src/screens/InvitationsScreen";
import { LandingScreen } from "./src/screens/LandingScreen";
import { LiveMonitorScreen } from "./src/screens/LiveMonitorScreen";
import { ManagedExamsScreen } from "./src/screens/ManagedExamsScreen";
import { ManagedResultsScreen } from "./src/screens/ManagedResultsScreen";
import { OrgDetailScreen } from "./src/screens/OrgDetailScreen";
import { OrganizationsScreen } from "./src/screens/OrganizationsScreen";
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { PracticeScreen } from "./src/screens/PracticeScreen";
import { ProctorHubScreen } from "./src/screens/ProctorHubScreen";
import { ProctorRequestScreen } from "./src/screens/ProctorRequestScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { QuestionBankScreen } from "./src/screens/QuestionBankScreen";
import { QuestionTypesScreen } from "./src/screens/QuestionTypesScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ResultScreen } from "./src/screens/ResultScreen";
import { ScoreSlipScreen } from "./src/screens/ScoreSlipScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { StaffReviewScreen } from "./src/screens/StaffReviewScreen";
import { VerifyScreen } from "./src/screens/VerifyScreen";
import type { RootStackParamList } from "./src/navigation";
import { ThemeProvider, useTheme } from "./src/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function openAppLink(link: AppLink, signedIn: boolean) {
  if (!navigationRef.isReady()) return false;
  if (link.kind === "verify") {
    navigationRef.navigate("Verify", { code: link.code });
    return true;
  }
  if (!signedIn) return false;
  if (link.kind === "session") navigationRef.navigate("Exam", { sessionId: link.sessionId });
  else navigationRef.navigate("ExamEntry", { examId: link.examId, invitationId: link.invitationId });
  return true;
}

function Root() {
  const { user, loading } = useAuth();
  const { colors, scheme } = useTheme();
  const t = useT();
  const [link, setLink] = useState<AppLink | null>(null);
  const pending = useRef<AppLink | null>(null);

  useEffect(() => {
    const take = (url: string | null | undefined) => {
      const parsed = url ? parseAppLink(url) : null;
      if (!parsed) return;
      pending.current = parsed;
      setLink(parsed);
    };
    Linking.getInitialURL().then(take).catch(() => undefined);
    const sub = Linking.addEventListener("url", ({ url }) => take(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!link) return;
    if (link.kind !== "verify" && !user) return;
    if (openAppLink(link, !!user)) pending.current = null;
  }, [user, link]);

  if (loading) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  const navigationTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        const next = pending.current;
        if (next && (next.kind === "verify" || user)) openAppLink(next, !!user);
      }}
      theme={{
        ...navigationTheme,
        colors: {
          ...navigationTheme.colors,
          background: colors.bg,
          card: colors.card,
          text: colors.text,
          border: colors.border,
          primary: colors.primary,
        },
      }}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: t("profile.title") }} />
            <Stack.Screen name="ExamEntry" component={ExamEntryScreen} options={{ title: t("entry.title") }} />
            <Stack.Screen name="Exam" component={ExamScreen} options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="Result" component={ResultScreen} options={{ title: t("result.title") }} />
            <Stack.Screen name="Practice" component={PracticeScreen} options={{ title: t("practice.title") }} />
            <Stack.Screen name="Certificate" component={CertificateScreen} options={{ title: t("cert.title") }} />
            <Stack.Screen name="Verify" component={VerifyScreen} options={{ title: t("verify.title") }} />
            <Stack.Screen name="ProctorRequest" component={ProctorRequestScreen} options={{ title: t("proctor.title") }} />
            <Stack.Screen name="Overview" component={OverviewScreen} options={{ title: t("overview.title") }} />
            <Stack.Screen name="ProctorHub" component={ProctorHubScreen} options={{ title: t("hub.title") }} />
            <Stack.Screen name="ManagedExams" component={ManagedExamsScreen} options={{ title: t("exams.title") }} />
            <Stack.Screen name="ExamForm" component={ExamFormScreen} options={{ title: t("form.edit") }} />
            <Stack.Screen name="LiveMonitor" component={LiveMonitorScreen} options={{ title: t("live.title") }} />
            <Stack.Screen name="QuestionBank" component={QuestionBankScreen} options={{ title: t("bank.title") }} />
            <Stack.Screen name="Bundles" component={BundlesScreen} options={{ title: t("bundles.title") }} />
            <Stack.Screen name="Invitations" component={InvitationsScreen} options={{ title: t("invites.title") }} />
            <Stack.Screen name="Groups" component={GroupsScreen} options={{ title: t("groups.title") }} />
            <Stack.Screen name="ManagedResults" component={ManagedResultsScreen} options={{ title: t("results.title") }} />
            <Stack.Screen name="StaffReview" component={StaffReviewScreen} options={{ title: t("review.title") }} />
            <Stack.Screen name="ScoreSlip" component={ScoreSlipScreen} options={{ title: t("slip.title") }} />
            <Stack.Screen name="Organizations" component={OrganizationsScreen} options={{ title: t("orgs.title") }} />
            <Stack.Screen name="OrgDetail" component={OrgDetailScreen} options={{ title: t("orgs.members") }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t("settings.title") }} />
            <Stack.Screen name="QuestionTypes" component={QuestionTypesScreen} options={{ title: t("types.title") }} />
            <Stack.Screen name="AdminRequests" component={AdminRequestsScreen} options={{ title: t("requests.title") }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Landing" component={LandingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Verify" component={VerifyScreen} options={{ title: t("verify.title") }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <ThemeProvider>
          <AuthProvider>
            <Root />
          </AuthProvider>
        </ThemeProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center" },
});
