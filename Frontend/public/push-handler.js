// Push Notification Handlers
// This file is imported into the main service worker via importScripts

// Handle push events
self.addEventListener('push', function(event) {
  console.log('[SW] Push message received:', event);

  var data = {
    title: 'Pickleball Community',
    body: 'You have a new notification',
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    url: '/notifications'
  };

  if (event.data) {
    try {
      var parsed = event.data.json();
      console.log('[SW] Parsed push data:', JSON.stringify(parsed));
      data = Object.assign({}, data, parsed);
    } catch (e) {
      console.warn('[SW] Failed to parse push data:', e);
      data.body = event.data.text();
    }
  }

  console.log('[SW] Final notification data:', JSON.stringify(data));

  var options = {
    body: data.body,
    icon: data.icon || '/logo-192.png',
    badge: data.badge || '/logo-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/notifications',
      timestamp: data.timestamp || Date.now()
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: false,
    tag: data.tag || ('pickleball-' + Date.now())
  };

  console.log('[SW] Showing notification with title:', data.title, 'options:', JSON.stringify(options));

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(function() {
        console.log('[SW] showNotification succeeded');
      })
      .catch(function(err) {
        console.error('[SW] showNotification FAILED:', err);
      })
  );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  if (event.action === 'dismiss') return;

  var urlToOpen = (event.notification.data && event.notification.data.url) || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

console.log('[SW] Push notification handlers loaded');
