import { useState, useEffect, useCallback } from 'react';
import { pushApi } from '../services/api';

/**
 * Convert a base64 string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Hook for managing Web Push notifications
 */
export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, []);

  // Check current subscription status
  const checkSubscription = useCallback(async () => {
    try {
      // Wait for the main service worker to be ready (registered by Vite PWA)
      const registration = await navigator.serviceWorker.ready;

      // Get the current subscription
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
      setIsSubscribed(!!sub);
    } catch (err) {
      console.error('Error checking push subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async (deviceName = null) => {
    if (!isSupported) {
      throw new Error('Push notifications are not supported');
    }

    setLoading(true);
    setError(null);

    try {
      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get the VAPID public key from the server
      const keyResponse = await pushApi.getVapidPublicKey();
      const vapidPublicKey = keyResponse?.data?.data || keyResponse?.data;

      if (!vapidPublicKey) {
        throw new Error('Could not get VAPID public key');
      }

      // Register service worker and subscribe
      const registration = await navigator.serviceWorker.ready;

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // Send subscription to server
      await pushApi.subscribe(sub, deviceName);

      setSubscription(sub);
      setIsSubscribed(true);

      return sub;
    } catch (err) {
      console.error('Error subscribing to push notifications:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!subscription) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Unsubscribe from browser
      await subscription.unsubscribe();

      // Notify server
      await pushApi.unsubscribe(subscription.endpoint);

      setSubscription(null);
      setIsSubscribed(false);
    } catch (err) {
      console.error('Error unsubscribing from push notifications:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [subscription]);

  // Send test notification
  // Returns the number of notifications sent, or -1 on error
  const sendTest = useCallback(async () => {
    try {
      setError(null);
      const response = await pushApi.test();
      const sentTo = response?.sentTo ?? response?.data?.sentTo ?? 0;

      if (sentTo === 0) {
        setError('No push subscriptions found. Try disabling and re-enabling push notifications.');
        return 0;
      }

      return sentTo;
    } catch (err) {
      console.error('Error sending test notification:', err);
      setError(err.message || 'Failed to send test notification');
      return -1;
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    subscription,
    loading,
    error,
    subscribe,
    unsubscribe,
    sendTest,
    checkSubscription
  };
}

export default usePushNotifications;
