import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";

/**
 * Detects in-app browsers (Instagram, Facebook, Messenger, TikTok, Snapchat,
 * Line, WeChat, etc.) which frequently fail to load module scripts and have
 * stale-cache issues. Shows a non-blocking banner urging the user to open in
 * their real browser. Dismissible per session.
 */
const STORAGE_KEY = "__levo_inapp_notice_dismissed_v1";

function detectInAppBrowser(): { isInApp: boolean; name: string } {
  if (typeof navigator === "undefined") return { isInApp: false, name: "" };
  const ua = navigator.userAgent || "";
  if (/Instagram/i.test(ua)) return { isInApp: true, name: "Instagram" };
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return { isInApp: true, name: "Facebook" };
  if (/Messenger|MessengerLite/i.test(ua)) return { isInApp: true, name: "Messenger" };
  if (/TikTok|musical_ly|Bytedance|BytedanceWebview/i.test(ua)) return { isInApp: true, name: "TikTok" };
  if (/Snapchat/i.test(ua)) return { isInApp: true, name: "Snapchat" };
  if (/Line\//i.test(ua)) return { isInApp: true, name: "Line" };
  if (/MicroMessenger/i.test(ua)) return { isInApp: true, name: "WeChat" };
  return { isInApp: false, name: "" };
}

function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");
}

function openExternally() {
  const url = window.location.href;
  if (isAndroid()) {
    // intent:// asks Android to open in Chrome directly, bypassing the WebView
    const cleanUrl = url.replace(/^https?:\/\//, "");
    const intent = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
    window.location.href = intent;
  } else {
    // iOS: cannot programmatically escape WebView — instruct the user
    // The text instructions are shown in the banner itself
    try {
      window.open(url, "_blank");
    } catch (e) {}
  }
}

export default function InAppBrowserNotice() {
  const [show, setShow] = useState(false);
  const [browserName, setBrowserName] = useState("");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch (e) {}
    const { isInApp, name } = detectInAppBrowser();
    if (isInApp) {
      setBrowserName(name);
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch (e) {}
    setShow(false);
  };

  const android = isAndroid();

  return (
    <div
      role="alert"
      dir="rtl"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999999,
        background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        color: "#fff",
        padding: "10px 14px",
        fontSize: 13,
        fontFamily: "Cairo, system-ui, -apple-system, sans-serif",
        boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        lineHeight: 1.45,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", marginBottom: 2 }}>
          متصفح {browserName} قد لا يعمل بشكل صحيح
        </strong>
        <span style={{ opacity: 0.95 }}>
          {android
            ? "اضغط الزر لفتح الموقع في Chrome"
            : "اضغط على ⋯ في الأعلى ثم اختر «Open in Safari» أو «فتح في المتصفح»"}
        </span>
      </div>
      {android && (
        <button
          onClick={openExternally}
          style={{
            background: "rgba(255,255,255,0.22)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ExternalLink size={14} />
          فتح
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="إغلاق"
        style={{
          background: "transparent",
          color: "#fff",
          border: "none",
          padding: 4,
          cursor: "pointer",
          flexShrink: 0,
          opacity: 0.85,
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
