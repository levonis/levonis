// Defers non-critical hooks until the browser is idle, to keep the
// initial JS execution path lean on slow mobile connections.
import { useEffect, useState } from "react";
import { useDailyLogin } from "@/hooks/useDailyLogin";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import { useOnlineHeartbeat } from "@/hooks/useOnlineHeartbeat";

function DeferredHooks() {
  useDailyLogin();
  useMessageNotifications();
  useOnlineHeartbeat();
  return null;
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
