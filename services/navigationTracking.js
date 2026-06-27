import * as Location from 'expo-location';
import { haversineMeters } from './routing';

const APPROACH_METERS = 25;
const ARRIVAL_METERS = 20;
const PASSED_MANEUVER_METERS = 40;
const REPEAT_AFTER_MS = 15000;

/**
 * GPS turn-by-turn tracker — deterministic, no AI calls.
 */
export function createNavigationTracker({ steps, onCue, onProgress, onArrive, onError }) {
  let subscription = null;
  let currentStepIndex = 0;
  let lastPosition = null;
  const stepState = steps.map(() => ({
    announced: 0,
    announcedAt: 0,
    closestMeters: Infinity,
  }));

  function reportProgress(latitude, longitude, step, dist) {
    onProgress?.({
      currentStepIndex,
      distanceToNextTurn: Math.round(dist),
      totalSteps: steps.length,
      stepsRemaining: Math.max(0, steps.length - currentStepIndex),
      currentStep: step,
      userPosition: { latitude, longitude },
    });
  }

  function handlePosition(location) {
    const { latitude, longitude } = location.coords;
    lastPosition = { latitude, longitude };

    if (currentStepIndex >= steps.length) return;

    const step = steps[currentStepIndex];
    const dist = haversineMeters(latitude, longitude, step.latitude, step.longitude);
    const state = stepState[currentStepIndex];
    const now = Date.now();

    reportProgress(latitude, longitude, step, dist);

    if (dist < state.closestMeters) {
      state.closestMeters = dist;
    }

    if (step.maneuverType === 'arrive' && dist <= ARRIVAL_METERS) {
      stop();
      onArrive?.();
      return;
    }

    if (dist <= APPROACH_METERS && state.announced === 0) {
      state.announced = 1;
      state.announcedAt = now;
      onCue?.(step, false);
    }

    if (
      state.announced === 1 &&
      now - state.announcedAt >= REPEAT_AFTER_MS &&
      dist > PASSED_MANEUVER_METERS &&
      state.closestMeters <= APPROACH_METERS
    ) {
      state.announced = 2;
      onCue?.(step, true);
    }

    if (state.announced >= 1 && dist <= APPROACH_METERS * 0.6) {
      currentStepIndex += 1;
    } else if (
      state.announced === 2 &&
      dist > PASSED_MANEUVER_METERS
    ) {
      currentStepIndex += 1;
    }

    if (currentStepIndex >= steps.length) {
      stop();
      onArrive?.();
    }
  }

  async function start() {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      onError?.('location_denied');
      return false;
    }

    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,
        timeInterval: 2000,
      },
      handlePosition
    );

    return true;
  }

  function stop() {
    if (subscription) {
      subscription.remove();
      subscription = null;
    }
  }

  function getLastPosition() {
    return lastPosition;
  }

  return { start, stop, getLastPosition };
}
