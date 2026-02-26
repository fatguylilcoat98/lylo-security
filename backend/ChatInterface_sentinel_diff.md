# ChatInterface.tsx — Sentinel Integration Diff
# Four surgical changes. Nothing else touches.

---

## CHANGE 1 — Add imports (top of file, after existing imports)

Add these two lines directly after your existing import block:

```ts
import { useSentinel } from '../lib/useSentinel';
```

---

## CHANGE 2 — Instantiate the hook (inside ChatInterface component)

Add this line directly after the `const [deviceId]` line (~line 200):

```ts
// Existing line — do not change:
const [deviceId] = useState(() => getDeviceId());

// ADD THIS LINE immediately after:
const sentinel   = useSentinel({ userEmail, deviceId });
```

---

## CHANGE 3 — Fire engagement reset after successful SSE stream

Inside `handleSend()`, find the line that reads:

```ts
setStreamingMsgId(null); setStreamingText('');
```

This appears AFTER the `break outer` loop, after `setMessages(prev => prev.map(...))`.
Add `sentinel.onEngagement()` on the next line:

```ts
// Existing lines:
setStreamingMsgId(null); setStreamingText('');

// ADD THIS LINE:
sentinel.onEngagement();   // Resets Sentinel consecutive_ignored counter
```

---

## CHANGE 4 — Register push token after permission granted

Inside `requestMobileAlerts()`, find the block that runs when permission is granted:

```ts
if (p === 'granted') {
  setNotificationsEnabled(true);
  new Notification('LYLO Alerts Active 🛡️', { body: 'Mission reminders enabled.', icon: '/icon-192.png' });
}
```

Replace it with (only adding one line + fixing the icon to match your manifest):

```ts
if (p === 'granted') {
  setNotificationsEnabled(true);
  new Notification('LYLO Alerts Active 🛡️', { body: 'Mission reminders enabled.', icon: '/logo.png' });
  sentinel.onPermissionGranted();   // Registers VAPID subscription with Sentinel backend
}
```

---

## That's it. Summary of what each change does:

| Change | Location | Effect |
|--------|----------|--------|
| Import | Top of file | Pulls in the hook |
| Hook init | After `deviceId` | Wires userEmail + deviceId into service functions |
| `sentinel.onEngagement()` | After SSE stream success | Resets backoff counter so active users aren't pushed |
| `sentinel.onPermissionGranted()` | Inside `requestMobileAlerts` | Registers VAPID subscription endpoint with backend |

## No other changes needed.

- `handleSend()` SSE logic — untouched
- Audio queue — untouched
- Scroll logic — untouched
- All existing state — untouched
- `requestMobileAlerts()` local notification — untouched
- `scheduleMobileReminder()` — untouched
