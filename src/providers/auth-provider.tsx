"use client";

import { useEffect } from "react";
import { onAuthChange } from "@/lib/firebase";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Bearer token is auto-attached by axios interceptor, just call /me
          const response = await api.getMe();
          if (response.data) {
            setUser(response.data);
          } else {
            setUser(null);
          }
        } catch {
          // User authenticated in Firebase but not registered in backend yet
          // Call /login to register them, then fetch profile
          try {
            const idToken = await firebaseUser.getIdToken();
            await api.login(idToken);
            const meResponse = await api.getMe();
            setUser(meResponse.data || null);
          } catch {
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  return <>{children}</>;
}
