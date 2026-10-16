"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { BUILD_ID } from "@/lib/version";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_DISMISSED_KEY = "xebra:pwa-install-dismissed";

/** Registers the service worker (production only) and offers a one-time "Install app" prompt. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // Query param helps the browser pick up a new worker when BUILD_ID changes
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(BUILD_ID)}`).catch(() => {
      // Installability is optional; the app works the same without the worker
    });
  }, []);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return;
      const install = event as BeforeInstallPromptEvent;
      toast("Install Xevra", {
        description: "Add the app to your home screen or desktop for quicker access.",
        duration: 15000,
        action: {
          label: "Install",
          onClick: () => {
            install.prompt().catch(() => {});
          },
        },
        onDismiss: () => localStorage.setItem(INSTALL_DISMISSED_KEY, "1"),
        onAutoClose: () => localStorage.setItem(INSTALL_DISMISSED_KEY, "1"),
      });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return null;
}
