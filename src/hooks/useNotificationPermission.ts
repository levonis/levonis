import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

type Perm = NotificationPermission | 'unsupported';

export function useNotificationPermission() {
  const [permission, setPermission] = useState<Perm>('default');
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Native (Android/iOS): use Capacitor LocalNotifications permission
      if (isNative) {
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          const status = await LocalNotifications.checkPermissions();
          if (!mounted) return;
          setPermission(status.display === 'granted' ? 'granted' : status.display === 'denied' ? 'denied' : 'default');
        } catch {
          if (mounted) setPermission('unsupported');
        }
        return;
      }

      // Web
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
    })();

    return () => { mounted = false; };
  }, [isNative]);

  const requestPermission = useCallback(async (): Promise<Perm> => {
    if (isNative) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const res = await LocalNotifications.requestPermissions();
        const result: Perm = res.display === 'granted' ? 'granted' : res.display === 'denied' ? 'denied' : 'default';
        setPermission(result);
        return result;
      } catch {
        return 'unsupported';
      }
    }

    if (!('Notification' in window)) return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isNative]);

  const showNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') return;

    if (isNative) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 2_000_000_000),
            title,
            body: (options?.body as string) || '',
            schedule: { at: new Date(Date.now() + 100) },
            smallIcon: 'ic_stat_icon_config_sample',
            extra: options?.data,
          }],
        });
      } catch {}
      return;
    }

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
  }, [permission, swRegistration, isNative]);

  return { permission, requestPermission, showNotification };
}
