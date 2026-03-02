import { useEffect, useState, useCallback } from 'react';

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);

    // Reuse existing SW only in real production (never register from preview/dev)
    const isLovablePreview =
      window.location.hostname.includes('lovableproject.com') ||
      window.location.hostname.startsWith('id-preview--') ||
      window.location.search.includes('__lovable_token=');

    if ('serviceWorker' in navigator && import.meta.env.PROD && !isLovablePreview) {
      navigator.serviceWorker.getRegistration('/sw.js').then((reg) => {
        if (reg) setSwRegistration(reg);
      }).catch(() => {});
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'unsupported' as const;
    
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') return;

    // Use service worker notification for better reliability
    if (swRegistration) {
      swRegistration.showNotification(title, {
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        dir: 'rtl',
        lang: 'ar',
        ...options,
      } as NotificationOptions);
    } else if ('Notification' in window) {
      new Notification(title, {
        icon: '/icons/icon-192.png',
        dir: 'rtl',
        lang: 'ar',
        ...options,
      });
    }
  }, [permission, swRegistration]);

  return { permission, requestPermission, showNotification };
}
