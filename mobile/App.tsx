import { useEffect, useRef, useState } from "react";
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/auth";
import { parseExamLink, type ExamLink } from "./src/links";
import { ExamEntryScreen } from "./src/screens/ExamEntryScreen";
import { ExamScreen } from "./src/screens/ExamScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ResultScreen } from "./src/screens/ResultScreen";
import type { RootStackParamList } from "./src/navigation";
import { ThemeProvider, useTheme } from "./src/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function openExamLink(link: ExamLink) {
  if (!navigationRef.isReady()) return false;
  if (link.kind === "session") navigationRef.navigate("Exam", { sessionId: link.sessionId });
  else navigationRef.navigate("ExamEntry", { examId: link.examId, invitationId: link.invitationId });
  return true;
}

function Root() {
  const { user, loading } = useAuth();
  const { colors, scheme } = useTheme();
  const [link, setLink] = useState<ExamLink | null>(null);
  const pending = useRef<ExamLink | null>(null);

  useEffect(() => {
    const take = (url: string | null) => {
      const parsed = url ? parseExamLink(url) : null;
      if (!parsed) return;
      pending.current = parsed;
      setLink(parsed);
    };
    Linking.getInitialURL().then(take).catch(() => undefined);
    const sub = Linking.addEventListener("url", ({ url }) => take(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!user || !link) return;
    if (openExamLink(link)) pending.current = null;
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
        if (user && pending.current) openExamLink(pending.current);
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
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
            <Stack.Screen name="ExamEntry" component={ExamEntryScreen} options={{ title: "Start exam" }} />
            <Stack.Screen name="Exam" component={ExamScreen} options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="Result" component={ResultScreen} options={{ title: "Result" }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center" },
});
