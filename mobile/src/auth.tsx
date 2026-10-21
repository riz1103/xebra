import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { api } from "./api";
import { auth } from "./firebase";
import type { User } from "./types";

interface AuthValue {
  user: User | null;
  loading: boolean;
  pendingVerificationEmail: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  recheckVerification: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function isPasswordUser(user: FirebaseUser): boolean {
  return user.providerData.some((p) => p.providerId === "password");
}

async function loadProfile(firebaseUser: FirebaseUser): Promise<User | null> {
  const me = await api.getMe();
  const profile = me.data;
  if (!profile) return null;
  if (!profile.photoURL && firebaseUser.photoURL) profile.photoURL = firebaseUser.photoURL;
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setPendingVerificationEmail(null);
        setLoading(false);
        return;
      }
      if (isPasswordUser(firebaseUser) && !firebaseUser.emailVerified) {
        setUser(null);
        setPendingVerificationEmail(firebaseUser.email);
        setLoading(false);
        return;
      }
      try {
        setUser(await loadProfile(firebaseUser));
        setPendingVerificationEmail(null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      pendingVerificationEmail,
      async signIn(email, password) {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (isPasswordUser(cred.user) && !cred.user.emailVerified) {
          setPendingVerificationEmail(cred.user.email);
          throw new Error("Please verify your email first. Check your inbox for the link.");
        }
        setUser(await loadProfile(cred.user));
        setPendingVerificationEmail(null);
      },
      async signInWithGoogle(idToken: string) {
        const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
        setUser(await loadProfile(cred.user));
        setPendingVerificationEmail(null);
      },
      async signUp(name, email, password) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await sendEmailVerification(cred.user);
        setPendingVerificationEmail(cred.user.email);
      },
      async resendVerification() {
        if (auth.currentUser) await sendEmailVerification(auth.currentUser);
      },
      async recheckVerification() {
        const current = auth.currentUser;
        if (!current) return false;
        await current.reload();
        if (!current.emailVerified) return false;
        setUser(await loadProfile(current));
        setPendingVerificationEmail(null);
        return true;
      },
      async signOut() {
        await firebaseSignOut(auth);
        setUser(null);
      },
    }),
    [user, loading, pendingVerificationEmail]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

const AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Invalid email or password.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/email-already-in-use": "This email is already registered. Sign in instead.",
  "auth/weak-password": "Use at least 6 characters.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection.",
};

export function authErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return AUTH_MESSAGES[error.code] ?? fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
