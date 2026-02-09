"use client";

import { useEffect, useRef } from "react";
import { onAuthChange } from "@/lib/firebase";
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
        try {
          // Bearer token is auto-attached by axios interceptor, just call /me
          const response = await api.getMe();
          if (response.data) {
            // Merge Firebase photoURL if the backend doesn't provide an image
            const userData = response.data;
            if (!userData.picture && !userData.photoURL && firebaseUser.photoURL) {
              userData.photoURL = firebaseUser.photoURL;
            }
            
            // Clear cache if user changed (different user logged in)
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
              
              // Clear cache if user changed (different user logged in)
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
