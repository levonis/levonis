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

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        setSwRegistration(reg);
      }).catch(console.error);
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
        icon: '/icons/icon-512.png',
        badge: '/icons/icon-512.png',
        dir: 'rtl',
        lang: 'ar',
        ...options,
      } as any);
    } else if ('Notification' in window) {
      new Notification(title, {
        icon: '/icons/icon-512.png',
        dir: 'rtl',
        lang: 'ar',
        ...options,
      });
    }
  }, [permission, swRegistration]);

  return { permission, requestPermission, showNotification };
}
