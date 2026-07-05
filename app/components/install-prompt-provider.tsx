"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

const IOS_HINT_DISMISSED_KEY = "mindverse:ios-install-hint-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent) && !("MSStream" in window);
}

export function InstallPromptProvider() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;

      toast("Install Mindverse", {
        description: "Add it to your device for quick, full-screen access.",
        action: {
          label: "Install",
          onClick: () => {
            deferredPromptRef.current?.prompt();
            deferredPromptRef.current = null;
          },
        },
      });
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (isIos() && localStorage.getItem(IOS_HINT_DISMISSED_KEY) !== "1") {
      toast("Install Mindverse", {
        description: "Tap the Share icon, then \"Add to Home Screen\".",
        onDismiss: () => localStorage.setItem(IOS_HINT_DISMISSED_KEY, "1"),
        onAutoClose: () => localStorage.setItem(IOS_HINT_DISMISSED_KEY, "1"),
      });
    }

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  return null;
}
