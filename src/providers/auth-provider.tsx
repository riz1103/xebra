"use client";

import { useEffect, useRef } from "react";
import { onAuthChange, isEmailPasswordUser } from "@/lib/firebase";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useQueryClient } from "@tanstack/react-query";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();
  const queryClient = useQueryClient();
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Email/password users must verify email before we grant app access
        if (isEmailPasswordUser(firebaseUser) && !firebaseUser.emailVerified) {
          setUser(null);
          previousUserIdRef.current = null;
          setLoading(false);
          return;
        }
        try {
          // Bearer idToken is auto-attached by axios interceptor; /me is enough for access
          const response = await api.getMe();
          if (response.data) {
            const userData = response.data;
            if (!userData.picture && !userData.photoURL && firebaseUser.photoURL) {
              userData.photoURL = firebaseUser.photoURL;
            }
            if (previousUserIdRef.current && previousUserIdRef.current !== userData.id) {
              queryClient.clear();
            }
            previousUserIdRef.current = userData.id;
            setUser(userData);
          } else {
            setUser(null);
            previousUserIdRef.current = null;
          }
        } catch {
          setUser(null);
          previousUserIdRef.current = null;
        }
      } else {
        // User logged out - clear cache and reset user tracking
        queryClient.clear();
        previousUserIdRef.current = null;
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading, queryClient]);

  return <>{children}</>;
}
