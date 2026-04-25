// Defers non-critical hooks until the browser is idle, to keep the
// initial JS execution path lean on slow mobile connections.
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useDailyLogin } from "@/hooks/useDailyLogin";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import { useOnlineHeartbeat } from "@/hooks/useOnlineHeartbeat";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";

const NATIVE_PERM_ASKED_KEY = "native_notif_perm_asked_v1";

function NativeNotificationPrompt() {
  const { permission, requestPermission } = useNotificationPermission();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (permission !== "default") return;
    if (localStorage.getItem(NATIVE_PERM_ASKED_KEY)) return;

    const t = setTimeout(() => {
      localStorage.setItem(NATIVE_PERM_ASKED_KEY, "1");
      requestPermission().catch(() => {});
    }, 1500);

    return () => clearTimeout(t);
  }, [permission, requestPermission]);

  return null;
}

function DeferredHooks() {
  useDailyLogin();
  useMessageNotifications();
  useOnlineHeartbeat();
  return <NativeNotificationPrompt />;
}

export default function DeferredEffects() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ric: any =
      (window as any).requestIdleCallback ||
      ((cb: () => void) => setTimeout(cb, 1500));
    const handle = ric(() => setReady(true), { timeout: 3000 });
    return () => {
      const cic = (window as any).cancelIdleCallback;
      if (cic) cic(handle);
    };
  }, []);

  if (!ready) return null;
  return <DeferredHooks />;
}
