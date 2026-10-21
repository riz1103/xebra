import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isSuccessResponse,
} from "react-native-nitro-google-signin";
import { authErrorMessage, useAuth } from "../auth";
import { googleWebClientId } from "../config";
import { useTheme, type Palette } from "../theme";

GoogleOneTapSignIn.configure({ webClientId: googleWebClientId });

export function LoginScreen() {
  const auth = useAuth();
  const { colors, scheme, toggle } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const continueWithGoogle = async () => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await GoogleOneTapSignIn.checkPlayServices();
      const response = await GoogleOneTapSignIn.presentExplicitSignIn();
      if (isCancelledResponse(response)) return;
      if (!isSuccessResponse(response) || !response.data?.idToken) {
        throw new Error("Google sign-in did not return an account.");
      }
      await auth.signInWithGoogle(response.data.idToken);
    } catch (err) {
      setError(authErrorMessage(err, "Google sign-in failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "up") {
        if (name.trim().length < 2) throw new Error("Enter your name.");
        await auth.signUp(name, email, password);
        setNotice("Account created. Open the verification email, then come back.");
      } else {
        await auth.signIn(email, password);
      }
    } catch (err) {
      setError(authErrorMessage(err, mode === "up" ? "Could not create the account." : "Could not sign in."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.wrap}>
        <View style={styles.topRow}>
          <Text style={styles.mark}>Xevra</Text>
          <Pressable onPress={toggle} hitSlop={8}>
            <Text style={styles.secondaryText}>{scheme === "dark" ? "Light" : "Dark"}</Text>
          </Pressable>
        </View>
          <Text style={styles.lead}>Take your exams on your phone.</Text>

          {auth.pendingVerificationEmail ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Verify your email</Text>
              <Text style={styles.body}>
                We sent a link to {auth.pendingVerificationEmail}. After you open it, tap the button below.
              </Text>
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                style={styles.primary}
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const ok = await auth.recheckVerification();
                    if (!ok) setError("That email is not verified yet.");
                  } catch (err) {
                    setError(authErrorMessage(err, "Could not check verification."));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>I've verified my email</Text>}
              </Pressable>
              <Pressable
                style={styles.secondary}
                onPress={async () => {
                  try {
                    await auth.resendVerification();
                    setNotice("Verification email sent again.");
                    setError("");
                  } catch (err) {
                    setError(authErrorMessage(err, "Could not resend the email."));
                  }
                }}
              >
                <Text style={styles.secondaryText}>Resend email</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.switch}>
                <Pressable style={[styles.switchBtn, mode === "in" && styles.switchOn]} onPress={() => setMode("in")}>
                  <Text style={[styles.switchText, mode === "in" && styles.switchTextOn]}>Sign in</Text>
                </Pressable>
                <Pressable style={[styles.switchBtn, mode === "up" && styles.switchOn]} onPress={() => setMode("up")}>
                  <Text style={[styles.switchText, mode === "up" && styles.switchTextOn]}>Create account</Text>
                </Pressable>
              </View>
              {mode === "up" ? (
                <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
              ) : null}
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable style={styles.google} disabled={busy} onPress={continueWithGoogle}>
                {busy ? <ActivityIndicator color={colors.text} /> : <Text style={styles.googleText}>Continue with Google</Text>}
              </Pressable>
              <Text style={styles.or}>or</Text>
              <Pressable style={styles.primary} disabled={busy} onPress={submit}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === "up" ? "Create account" : "Sign in"}</Text>}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "words";
  keyboardType?: "email-address";
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize ?? "none"}
        keyboardType={props.keyboardType}
        autoCorrect={false}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  wrap: { flex: 1, justifyContent: "center", padding: 20 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mark: { fontSize: 36, fontWeight: "800", color: colors.primary },
  lead: { marginTop: 4, marginBottom: 20, color: colors.muted, fontSize: 16 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  body: { marginTop: 8, color: colors.muted, lineHeight: 22 },
  switch: { flexDirection: "row", backgroundColor: colors.bg, borderRadius: 12, padding: 4, marginBottom: 8 },
  switchBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  switchOn: { backgroundColor: colors.card },
  switchText: { color: colors.muted, fontWeight: "600" },
  switchTextOn: { color: colors.text },
  field: { marginTop: 12 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.text, backgroundColor: colors.bg },
  error: { marginTop: 12, color: colors.danger },
  notice: { marginTop: 12, color: colors.success },
  google: { marginTop: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 14, alignItems: "center", backgroundColor: colors.card },
  googleText: { color: colors.text, fontWeight: "700", fontSize: 16 },
  or: { marginTop: 12, textAlign: "center", color: colors.muted },
  primary: { marginTop: 12, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: { marginTop: 10, paddingVertical: 12, alignItems: "center" },
  secondaryText: { color: colors.primary, fontWeight: "700" },
});
}
