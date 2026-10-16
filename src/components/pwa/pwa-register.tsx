"use client";

import { useEffect } from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_DISMISSED_KEY = "xebra:pwa-install-dismissed";

/** Registers the service worker (production only) and offers a one-time "Install app" prompt. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
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
