// services/locationService.js
import * as Location from 'expo-location';

// All functions in this file MUST NOT throw to the caller. Location access is
// foundational for a blind user; if it fails, the UI must still get a defined
// value (false / null / a no-op subscription) so it can speak an error.

/**
 * Requests foreground location permission.
 * @returns {Promise<boolean>} true if granted, false otherwise. Never throws.
 */
export async function requestLocationPermission() {
  try {
    // Race against a hard 6s safety bound so the UI never hangs indefinitely
    // if the OS permission dialog is dismissed or the runtime stalls.
    const result = await Promise.race([
      Location.requestForegroundPermissionsAsync(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('permission_timeout')), 6000)
      ),
    ]);
    return !!(result && result.status === 'granted');
  } catch (e) {
    return false;
  }
}

/**
 * Returns the current position once, or null if permission is missing or
 * location is unavailable. Never throws.
 * @returns {Promise<{latitude:number, longitude:number, heading:number|null, accuracy:number|null}|null>}
 */
export async function getCurrentPosition() {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm || perm.status !== 'granted') return null;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    if (!pos || !pos.coords) return null;

    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      // heading may be null/NaN on many devices when stationary; normalize.
      heading:
        typeof pos.coords.heading === 'number' && isFinite(pos.coords.heading)
          ? pos.coords.heading
          : null,
      accuracy:
        typeof pos.coords.accuracy === 'number' && isFinite(pos.coords.accuracy)
          ? pos.coords.accuracy
          : null,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Returns a ready-to-send sentence describing the user's last known location,
 * for use in emergency SOS messages. Never throws — always resolves to a
 * speakable/textable string, even if location is unavailable.
 * @returns {Promise<string>}
 */
export async function getLocationMessage() {
  try {
    const pos = await getCurrentPosition();
    if (!pos) {
      return 'Location is unavailable.';
    }
    const lat = pos.latitude.toFixed(5);
    const lon = pos.longitude.toFixed(5);
    const mapsUrl = `https://maps.google.com/?q=${pos.latitude},${pos.longitude}`;
    return `Last known location: ${lat}, ${lon}. Map: ${mapsUrl}`;
  } catch (e) {
    return 'Location is unavailable.';
  }
}

/**
 * Starts continuous location updates.
 * @param {(pos:{latitude:number,longitude:number,heading:number|null,accuracy:number|null})=>void} onUpdate
 * @returns {{remove:()=>void}} subscription handle. Always returns a working
 *   object even if tracking failed to start — UI calls .remove() on unmount.
 */
export function watchPosition(onUpdate) {
  // Defensive: a non-function onUpdate would break integration silently; guard.
  const handle = typeof onUpdate === 'function' ? onUpdate : () => {};

  let subscription = null;
  let cancelled = false;

  (async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm || perm.status !== 'granted') return;

      // Walking pace tuning: 1500ms / 3m balances responsiveness vs. battery.
      // FIX: was assigning to an undeclared `sub` variable (ReferenceError,
      // silently swallowed by the outer catch — tracking would never start
      // and no error would ever reach the user). Assign directly to the
      // already-declared `subscription` instead.
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1500,
          distanceInterval: 3,
        },
        (pos) => {
          if (cancelled || !pos || !pos.coords) return;
          try {
            handle({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              heading:
                typeof pos.coords.heading === 'number' &&
                isFinite(pos.coords.heading)
                  ? pos.coords.heading
                  : null,
              accuracy:
                typeof pos.coords.accuracy === 'number' &&
                isFinite(pos.coords.accuracy)
                  ? pos.coords.accuracy
                  : null,
            });
          } catch (_) {
            // Swallow handler errors — they must not break the watch loop.
          }
        }
      );

      if (cancelled) {
        // stop() was called while we were awaiting watchPositionAsync.
        try {
          sub.remove();
        } catch (_) {}
        return;
      }
      subscription = sub;
    } catch (_) {
      // Tracking setup failed; .remove() is still safe to call (no-op).
    }
  })();

  return {
    remove: () => {
      cancelled = true;
      try {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        }
      } catch (_) {
        // ignore
      }
      subscription = null;
    },
  };
}
