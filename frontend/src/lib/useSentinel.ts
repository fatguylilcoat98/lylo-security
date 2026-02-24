/**
 * LYLO OS — useSentinel.ts
 * React hook that encapsulates all Sentinel side-effects for ChatInterface.
 *
 * Drop-in usage inside ChatInterface:
 *
 *   const sentinel = useSentinel({ userEmail, deviceId });
 *
 *   // After successful SSE stream:
 *   sentinel.onEngagement();
 *
 *   // Inside requestMobileAlerts(), after permission === 'granted':
 *   sentinel.onPermissionGranted();
 *
 * Does NOT touch any existing state. Does NOT replace requestMobileAlerts().
 * Purely additive — if sentinelService calls fail, the chat is unaffected.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  notifySentinelEngagement,
  registerSentinelPushToken,
} from './sentinelService';

interface UseSentinelOptions {
  userEmail: string;
  deviceId:  string;
}

interface UseSentinelReturn {
  /** Call after every successful chat SSE stream completes. */
  onEngagement:       () => void;
  /** Call after Notification.requestPermission() returns 'granted'. */
  onPermissionGranted: () => void;
}

export function useSentinel({
  userEmail,
  deviceId,
}: UseSentinelOptions): UseSentinelReturn {

  // Track whether we've already registered this session to avoid hammering
  // the backend on every permission check.
  const registeredRef = useRef(false);

  // On mount: if permission is already granted (returning user), register
  // silently so the Sentinel always has a fresh subscription endpoint.
  useEffect(() => {
    if (
      userEmail &&
      deviceId &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      !registeredRef.current
    ) {
      registeredRef.current = true;
      registerSentinelPushToken(userEmail, deviceId);
    }
  }, [userEmail, deviceId]);

  // Called from inside handleSend() after the SSE stream breaks outer loop.
  const onEngagement = useCallback(() => {
    notifySentinelEngagement(userEmail);
  }, [userEmail]);

  // Called from inside requestMobileAlerts() after permission === 'granted'.
  const onPermissionGranted = useCallback(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;
    registerSentinelPushToken(userEmail, deviceId);
  }, [userEmail, deviceId]);

  return { onEngagement, onPermissionGranted };
}
