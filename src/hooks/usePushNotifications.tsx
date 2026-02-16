import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

interface PushNotificationState {
  isSupported: boolean;
  isPermissionGranted: boolean;
  subscription: PushSubscription | null;
}

export const usePushNotifications = () => {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isPermissionGranted: false,
    subscription: null,
  });

  // Check if push notifications are supported
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    setState((prev) => ({ ...prev, isSupported }));

    if (isSupported) {
      checkPermission();
    }
  }, []);

  const checkPermission = useCallback(async () => {
    if (!('Notification' in window)) return;

    const permission = Notification.permission;
    setState((prev) => ({
      ...prev,
      isPermissionGranted: permission === 'granted',
    }));
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setState((prev) => ({ ...prev, isPermissionGranted: granted }));

      if (granted) {
        await registerServiceWorker();
      }

      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, []);

  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);

      // Get push subscription
      const subscription = await (registration as any).pushManager?.getSubscription();
      if (subscription) {
        setState((prev) => ({ ...prev, subscription }));
        await saveSubscriptionToServer(subscription);
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }, []);

  const subscribeToNotifications = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return null;

    try {
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key from edge function
      const { data: vapidData, error: vapidError } = await supabase.functions.invoke(
        'get-vapid-key'
      );

      if (vapidError || !vapidData?.publicKey) {
        console.error('Failed to get VAPID key:', vapidError);
        return null;
      }

      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as BufferSource,
      });

      setState((prev) => ({ ...prev, subscription }));
      await saveSubscriptionToServer(subscription);

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }, []);

  const saveSubscriptionToServer = async (subscription: PushSubscription) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.functions.invoke('save-push-subscription', {
        body: {
          subscription: subscription.toJSON(),
          userId: user.id,
          platform: Capacitor.isNativePlatform() ? 'mobile' : 'web',
        },
      });

      if (error) {
        console.error('Failed to save subscription:', error);
      }
    } catch (error) {
      console.error('Error saving subscription:', error);
    }
  };

  // Show a local notification (for testing or fallback)
  const showLocalNotification = useCallback(
    async (title: string, options?: NotificationOptions) => {
      if (!state.isPermissionGranted) {
        const granted = await requestPermission();
        if (!granted) return;
      }

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, options);
      } else if ('Notification' in window) {
        new Notification(title, options);
      }
    },
    [state.isPermissionGranted, requestPermission]
  );

  return {
    ...state,
    requestPermission,
    subscribeToNotifications,
    showLocalNotification,
  };
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
