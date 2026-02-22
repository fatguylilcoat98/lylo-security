// LYLO OS Service Worker Engine
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
