// public/sw.js
self.addEventListener('push', function(event) {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/logo192.png', // Ensure you have a logo in public folder
    badge: '/badge.png',  // Optional: A small monochrome icon for the status bar
    vibrate: [200, 100, 200],
    data: { url: data.url }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // Open the app when the notification is clicked
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
