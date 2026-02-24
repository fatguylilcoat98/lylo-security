// ============================================================================
// LYLO OS Service Worker Engine
// Extended with Sentinel Web Push handlers (additive — existing logic intact)
// ============================================================================

const CACHE_NAME = 'lylo-v1';

// Install event: Pre-caches the basic app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event: Takes control of the page immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Fetch event: Required for PWA status (even if empty)
self.addEventListener('fetch', (event) => {
  // Logic can be added here for offline mode later
});

// ============================================================================
// SENTINEL — PUSH HANDLER
// Receives Web Push payloads dispatched by delivery.py via pywebpush.
//
// Payload shape (JSON string in event.data):
// {
//   "title":  "The plan doesn't wait, Chris",
//   "body":   "48 hours off the mission. One move — right now.",
//   "tag":    "dormant_48h_build_wealth",
//   "icon":   "/logo.png",
//   "badge":  "/logo.png",
//   "data":   { "mission": "build_wealth", "trigger": "dormant_48h", "url": "/" }
// }
// ============================================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Malformed payload — show a safe fallback
    payload = {
      title: 'LYLO OS',
      body:  'Your mission needs attention.',
      tag:   'lylo_sentinel_fallback',
    };
  }

  const title = payload.title ?? 'LYLO OS';
  const options = {
    body:             payload.body  ?? '',
    tag:              payload.tag   ?? 'lylo_sentinel',   // Replaces previous same-tag notif
    icon:             '/logo.png',                        // Matches your actual manifest icon
    badge:            '/logo.png',
    vibrate:          [200, 100, 200],                    // Short double-pulse
    renotify:         true,                               // Always vibrate even on tag replace
    requireInteraction: false,                            // Auto-dismiss after ~5s on Android
    data: {
      url:     (payload.data && payload.data.url) ? payload.data.url : '/',
      mission: (payload.data && payload.data.mission) ? payload.data.mission : '',
      trigger: (payload.data && payload.data.trigger) ? payload.data.trigger : '',
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ============================================================================
// SENTINEL — NOTIFICATION CLICK HANDLER
// Opens (or focuses) the LYLO OS app when the user taps the notification.
// ============================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If LYLO is already open in a tab, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
