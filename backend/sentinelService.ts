/**
 * LYLO OS — sentinelService.ts
 * Sentinel integration: engagement reset + push token registration.
 *
 * Two responsibilities:
 *   1. notifySentinelEngagement()  — fire-and-forget POST to /sentinel-reset
 *      after every successful chat response. Tells the Sentinel the user is
 *      active so it resets the consecutive_ignored counter in Pinecone.
 *
 *   2. registerSentinelPushToken() — registers the browser's VAPID Web Push
 *      subscription with the backend after notification permission is granted.
 *      Called once per device. Backend stores it under {email}_push_tokens.
 *
 * No state. No React. Pure async functions — import where needed.
 */

const API_URL = 'https://lylo-backend.onrender.com';

// ---------------------------------------------------------------------------
// VAPID PUBLIC KEY
// Replace this with your actual VAPID public key from your .env / backend.
// Generate a key pair: npx web-push generate-vapid-keys
// ---------------------------------------------------------------------------
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

// ---------------------------------------------------------------------------
// Converts a VAPID base64 public key string to a Uint8Array for
// PushManager.subscribe(). Required by the Web Push spec.
// ---------------------------------------------------------------------------
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData  = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// ---------------------------------------------------------------------------
// notifySentinelEngagement
// ---------------------------------------------------------------------------
// Called inside handleSend() after a successful SSE stream completes.
// Fire-and-forget — never throws, never blocks the chat flow.
// ---------------------------------------------------------------------------
export async function notifySentinelEngagement(userEmail: string): Promise<void> {
  if (!userEmail) return;
  try {
    const fd = new FormData();
    fd.append('user_email', userEmail);
    await fetch(`${API_URL}/sentinel-reset`, {
      method:  'POST',
      body:    fd,
    });
    // No response parsing needed — backend logs it and returns 200.
  } catch {
    // Network failures are silent — this is telemetry, not critical path.
  }
}

// ---------------------------------------------------------------------------
// registerSentinelPushToken
// ---------------------------------------------------------------------------
// Called after Notification.requestPermission() === 'granted'.
// Registers the VAPID Web Push subscription with the backend so the Sentinel
// can dispatch pushes via pywebpush when the user is dormant or it's Sunday.
//
// Safe to call multiple times — backend upserts, does not duplicate.
// ---------------------------------------------------------------------------
export async function registerSentinelPushToken(
  userEmail: string,
  deviceId:  string,
): Promise<void> {
  if (!userEmail || !deviceId) return;

  // Web Push not supported (iOS Safari < 16.4, or non-HTTPS)
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Sentinel] Web Push not supported on this browser/platform.');
    return;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Sentinel] VITE_VAPID_PUBLIC_KEY is not set — push registration skipped.');
    return;
  }

  try {
    // Wait for the service worker to be ready
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed (idempotent)
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Extract the subscription components the backend needs
    const keys         = subscription.toJSON().keys ?? {};
    const p256dh       = keys.p256dh ?? '';
    const auth         = keys.auth   ?? '';
    const endpoint     = subscription.endpoint;

    // POST to backend — stored as {email}_push_tokens in Pinecone
    const fd = new FormData();
    fd.append('user_email',           userEmail);
    fd.append('device_id',            deviceId);
    fd.append('webpush_endpoint',     endpoint);
    fd.append('webpush_keys_p256dh',  p256dh);
    fd.append('webpush_keys_auth',    auth);
    fd.append('push_consent',         'true');

    await fetch(`${API_URL}/register-push-token`, {
      method: 'POST',
      body:   fd,
    });

    console.info('[Sentinel] VAPID push subscription registered for', userEmail.slice(0, 4) + '***');
  } catch (err) {
    // Blocked by browser policy, VAPID key mismatch, or no HTTPS — log only.
    console.warn('[Sentinel] Push registration failed:', err);
  }
}
