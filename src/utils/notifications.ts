// Push notification utilities for Flightline

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;

  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) return true; // Already subscribed

    // For a real app, you'd get the VAPID public key from your backend
    // and call registration.pushManager.subscribe({ ... })
    return Notification.permission === 'granted';
  } catch {
    return false;
  }
}

/** Show a notification via the active service worker (supports vibrate, actions, etc.) */
export async function sendLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(title, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      ...options,
    } as any);
  } catch {
    // Fallback
    new Notification(title, options);
  }
}

export async function sendFlightStatusNotification(
  flightName: string,
  status: string,
  details?: string
): Promise<void> {
  const title = `${flightName} — ${status}`;
  await sendLocalNotification(title, {
    body: details ?? `Your flight status has changed to ${status}`,
    tag: `flight-${flightName}`,
    requireInteraction: true,
  });
}
