// public/sw.js - THE BACKGROUND BRAIN
self.addEventListener('push', (e) => {
  const data = e.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/logo192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' }
  });
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
