import { useEffect, useState, useCallback } from 'react';

type Perm = NotificationPermission | 'unsupported';

export function useNotificationPermission() {
  const [permission, setPermission] = useState<Perm>('default');
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);

    const isLovablePreview =
      window.location.hostname.includes('lovableproject.com') ||
      window.location.hostname.startsWith('id-preview--') ||
      window.location.search.includes('__lovable_token=');

    if ('serviceWorker' in navigator && import.meta.env.PROD && !isLovablePreview) {
      navigator.serviceWorker.getRegistration('/sw.js').then((reg) => {
        if (reg && mounted) setSwRegistration(reg);
      }).catch(() => {});
    }

    return () => { mounted = false; };
  }, []);

  const requestPermission = useCallback(async (): Promise<Perm> => {
    if (!('Notification' in window)) return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const showNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') return;

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
