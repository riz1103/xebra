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
            // Merge Firebase photoURL if the backend doesn't provide an image
            const userData = response.data;
            if (!userData.picture && !userData.photoURL && firebaseUser.photoURL) {
              userData.photoURL = firebaseUser.photoURL;
            }
            setUser(userData);
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
            if (meResponse.data) {
              const userData = meResponse.data;
              if (!userData.picture && !userData.photoURL && firebaseUser.photoURL) {
                userData.photoURL = firebaseUser.photoURL;
              }
              setUser(userData);
            } else {
              setUser(null);
            }
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
