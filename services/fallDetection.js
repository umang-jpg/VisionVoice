import { Accelerometer } from 'expo-sensors';

// ── Tunable thresholds (adjust for demo vs real-device testing) ──
// Demo tip: temporarily lower IMPACT_THRESHOLD (e.g. 4.0) to trigger on desk drops.
// Real use: keep stricter values to reduce false positives.
const FREE_FALL_THRESHOLD = 1.0;
const IMPACT_THRESHOLD = 2.0;
const IMPACT_WINDOW_MS = 500;
const COOLDOWN_MS = 30000;

let subscription = null;
let freeFallStart = null;
let cooldownUntil = 0;

function resetState() {
  freeFallStart = null;
}

export function startFallDetection(onFallDetected) {
  if (subscription) return;

  Accelerometer.setUpdateInterval(100);

  subscription = Accelerometer.addListener(({ x, y, z }) => {
    const now = Date.now();
    if (now < cooldownUntil) return;

    const magnitude = Math.sqrt(x * x + y * y + z * z);

    // Phase 1: free fall — magnitude drops well below ~1g at rest
    if (magnitude < FREE_FALL_THRESHOLD) {
      if (freeFallStart === null) {
        freeFallStart = now;
      }
    }

    // Phase 2: impact within window after free fall
    if (
      freeFallStart !== null &&
      magnitude > IMPACT_THRESHOLD &&
      now - freeFallStart <= IMPACT_WINDOW_MS
    ) {
      resetState();
      cooldownUntil = now + COOLDOWN_MS;
      onFallDetected();
      return;
    }

    // Expire stale free-fall window without impact
    if (freeFallStart !== null && now - freeFallStart > IMPACT_WINDOW_MS) {
      resetState();
    }
  });
}

export function stopFallDetection() {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
  resetState();
  cooldownUntil = 0;
}
