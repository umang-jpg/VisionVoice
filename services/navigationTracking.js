// services/navigationTracking.js
//
// Given a normalized route (RouteResult.steps), tracks the user's live position
// and fires:
//   onProgress(...)  — every position update
//   onCue(step, isRepeat) — when a turn cue should fire (first time + reminders)
//   onArrive()       — once, when the user reaches the final step within ~15m
//   onError(code)    — recoverable failure: 'location_denied' | 'location_unavailable' | 'gps_lost'
//
// NOTE for the UI integration pass: the screen wiring this tracker up MUST
// branch on all three onError codes above, not just 'location_denied'.
// 'location_unavailable' fires when permission was granted but a GPS fix
// could not be obtained (e.g. indoors, cold start). 'gps_lost' fires if
// updates stop arriving mid-navigation. Both need a spoken message + a path
// back to idle, same as 'location_denied' — see the wiring doc.
//
// Geometry is implemented inline (no turf/geolib). Euclidean-on-small-scale
// approximation is acceptable at walking-navigation resolution.

import { requestLocationPermission, getCurrentPosition, watchPosition } from './locationService';

// -----------------------------
// Inline geometry helpers
// -----------------------------

function toRad(d) { return (d * Math.PI) / 180; }
function toDeg(r) { return (r * 180) / Math.PI; }

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Distance from point P to segment AB (all as [lon,lat]). Returns meters. */
function distancePointToSegmentMeters(p, a, b) {
  // Project onto a flat equirectangular plane — fine at city scale.
  const lat0 = (a[1] + b[1] + p[1]) / 3;
  const mPerLat = 111320;
  const mPerLon = 111320 * Math.cos(toRad(lat0));

  const px = p[0] * mPerLon;
  const py = p[1] * mPerLat;
  const ax = a[0] * mPerLon;
  const ay = a[1] * mPerLat;
  const bx = b[0] * mPerLon;
  const by = b[1] * mPerLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t = 0;
  if (lenSq > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ddx = px - cx;
  const ddy = py - cy;
  return Math.sqrt(ddx * ddx + ddy * ddy);
}

/** Closest distance from P to any segment in coords (array of [lon,lat]). */
function distanceToPolylineMeters(p, coords) {
  if (!coords || coords.length < 2) {
    if (coords && coords.length === 1) {
      return haversineMeters(p[1], p[0], coords[0][1], coords[0][0]);
    }
    return Infinity;
  }
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = distancePointToSegmentMeters(p, coords[i], coords[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

/** Distance (meters) along polyline from P to the end, via projection. */
function remainingDistanceAlongPolylineMeters(p, coords) {
  if (!coords || coords.length < 2) {
    if (coords && coords.length === 1) {
      return haversineMeters(p[1], p[0], coords[0][1], coords[0][0]);
    }
    return Infinity;
  }
  const lat0 = (coords[0][1] + coords[coords.length - 1][1] + p[1]) / 3;
  const mPerLat = 111320;
  const mPerLon = 111320 * Math.cos(toRad(lat0));

  const px = p[0] * mPerLon;
  const py = p[1] * mPerLat;

  let bestIdx = 0;
  let bestT = 0;
  let bestDist = Infinity;
  const segLens = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const ax = coords[i][0] * mPerLon;
    const ay = coords[i][1] * mPerLat;
    const bx = coords[i + 1][0] * mPerLon;
    const by = coords[i + 1][1] * mPerLat;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    const segLen = Math.sqrt(lenSq);
    segLens.push(segLen);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
      bestT = t;
    }
  }

  // Walk from bestIdx+1 segment to the end, adding remaining partial of bestIdx.
  let remaining = 0;
  for (let i = bestIdx; i < segLens.length; i++) {
    if (i === bestIdx) {
      remaining += segLens[i] * (1 - bestT);
    } else {
      remaining += segLens[i];
    }
  }
  return remaining;
}

// -----------------------------
// Tracker factory
// -----------------------------

/**
 * @param {object} config
 * @returns {{start:()=>Promise<boolean>, stop:()=>void}}
 */
export function createNavigationTracker(config) {
  const safeConfig = config || {};

  const steps = Array.isArray(safeConfig.steps) ? safeConfig.steps : [];
  const onProgress = typeof safeConfig.onProgress === 'function' ? safeConfig.onProgress : () => {};
  const onCue = typeof safeConfig.onCue === 'function' ? safeConfig.onCue : () => {};
  const onArrive = typeof safeConfig.onArrive === 'function' ? safeConfig.onArrive : () => {};
  const onError = typeof safeConfig.onError === 'function' ? safeConfig.onError : () => {};

  // --- State ---
  let started = false;
  let stopped = false;
  let subscription = null;
  let watchdogTimer = null;

  let currentStepIndex = 0;
  let announcedStepIndex = -1; // which step we've already fired onCue(_, false) for
  let lastAnnouncementAt = 0;
  let lastAnnouncementPosition = null; // {lat,lon,ts}
  let lastSignificantMoveAt = 0; // ts of last movement >= 5m
  let lastKnownPosition = null; // {lat,lon}
  let lastPositionTime = 0;
  let gpsLostFired = false;
  let arrivedFired = false;
  let lastReminderAt = 0;

  const ANNOUNCE_LEAD_METERS = 30;
  const ARRIVE_RADIUS_METERS = 15;
  const REMINDER_STALL_MS = 8000;
  const REMINDER_MIN_GAP_MS = 15000;
  const GPS_LOST_MS = 12000;
  const STEP_SWITCH_BUFFER_METERS = 6; // how close to next step's start before advancing

  function safeCall(fn, ...args) {
    try {
      fn(...args);
    } catch (_) {
      // UI callback errors must not break tracking.
    }
  }

  function emitProgress(userPosition) {
    const step = steps[currentStepIndex];
    if (!step) return;
    let distToNextTurn = 0;
    try {
      const p = [userPosition.longitude, userPosition.latitude];
      if (step.coordinates && step.coordinates.length) {
        distToNextTurn = remainingDistanceAlongPolylineMeters(p, step.coordinates);
      } else {
        // No geometry — fall back to step.distanceMeters.
        distToNextTurn = step.distanceMeters || 0;
      }
    } catch (_) {
      distToNextTurn = step.distanceMeters || 0;
    }
    safeCall(onProgress, {
      currentStepIndex,
      distanceToNextTurn: distToNextTurn,
      totalSteps: steps.length,
      userPosition,
    });

    // --- Cue logic ---
    const now = Date.now();

    // First announcement for the current step.
    if (announcedStepIndex !== currentStepIndex) {
      const shouldAnnounceNow =
        !step.distanceMeters ||
        step.distanceMeters <= 50 ||
        distToNextTurn <= ANNOUNCE_LEAD_METERS;
      if (shouldAnnounceNow) {
        announcedStepIndex = currentStepIndex;
        lastAnnouncementAt = now;
        lastAnnouncementPosition = {
          lat: userPosition.latitude,
          lon: userPosition.longitude,
          ts: now,
        };
        lastSignificantMoveAt = now;
        safeCall(onCue, step, false);
      }
    } else {
      // Reminder condition: stalled for REMINDER_STALL_MS, moved < 5m since
      // last announcement, and at least REMINDER_MIN_GAP_MS since last reminder.
      if (lastAnnouncementPosition) {
        const moved = haversineMeters(
          lastAnnouncementPosition.lat,
          lastAnnouncementPosition.lon,
          userPosition.latitude,
          userPosition.longitude
        );
        if (moved >= 5) {
          lastSignificantMoveAt = now;
        }
      }
      const stalled = now - lastSignificantMoveAt >= REMINDER_STALL_MS;
      const gapOk = now - lastReminderAt >= REMINDER_MIN_GAP_MS;
      const gapSinceAnn = now - lastAnnouncementAt >= REMINDER_MIN_GAP_MS;
      if (stalled && gapOk && gapSinceAnn && !arrivedFired) {
        lastReminderAt = now;
        safeCall(onCue, step, true);
      }
    }

    // --- Step advancement ---
    if (currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1];
      if (nextStep && nextStep.coordinates && nextStep.coordinates.length) {
        const p = [userPosition.longitude, userPosition.latitude];
        const dToNextStart = distanceToPolylineMeters(p, nextStep.coordinates);
        const dToCurrEnd =
          step.coordinates && step.coordinates.length
            ? remainingDistanceAlongPolylineMeters(p, step.coordinates)
            : Infinity;
        // Advance when user is closer to the next step's path than this step's end
        // OR has clearly crossed into next step territory.
        if (dToNextStart < STEP_SWITCH_BUFFER_METERS || dToCurrEnd < 2) {
          currentStepIndex += 1;
          announcedStepIndex = -1; // reset announce flag for the new step
          lastReminderAt = 0;
        }
      }
    }

    // --- Arrival ---
    if (currentStepIndex === steps.length - 1 && !arrivedFired) {
      const finalStep = steps[steps.length - 1];
      if (finalStep && finalStep.coordinates && finalStep.coordinates.length) {
        const lastCoord = finalStep.coordinates[finalStep.coordinates.length - 1];
        const d = haversineMeters(
          userPosition.latitude,
          userPosition.longitude,
          lastCoord[1],
          lastCoord[0]
        );
        if (d <= ARRIVE_RADIUS_METERS) {
          arrivedFired = true;
          safeCall(onArrive);
        }
      }
    }
  }

  function startWatchdog() {
    stopWatchdog();
    watchdogTimer = setInterval(() => {
      if (stopped) return;
      const now = Date.now();
      if (lastPositionTime > 0 && now - lastPositionTime > GPS_LOST_MS && !gpsLostFired) {
        gpsLostFired = true;
        safeCall(onError, 'gps_lost');
      }
    }, 2000);
  }

  function stopWatchdog() {
    if (watchdogTimer) {
      try {
        clearInterval(watchdogTimer);
      } catch (_) {}
      watchdogTimer = null;
    }
  }

  async function start() {
    if (started || stopped) return false;
    started = true;

    // Permission check.
    let granted = false;
    try {
      granted = await requestLocationPermission();
    } catch (_) {
      granted = false;
    }
    if (!granted) {
      safeCall(onError, 'location_denied');
      started = false;
      return false;
    }

    // Initial position to confirm GPS availability.
    let pos = null;
    try {
      pos = await getCurrentPosition();
    } catch (_) {
      pos = null;
    }
    if (!pos) {
      safeCall(onError, 'location_unavailable');
      started = false;
      return false;
    }

    if (stopped) {
      // User called stop() while we were awaiting.
      return false;
    }

    // Seed state.
    lastKnownPosition = { lat: pos.latitude, lon: pos.longitude };
    lastPositionTime = Date.now();
    lastSignificantMoveAt = Date.now();

    // If route has zero steps, fail gracefully.
    if (!steps.length) {
      safeCall(onError, 'location_unavailable');
      started = false;
      return false;
    }

    // Start the watchdog before the subscription so gps_lost can fire even
    // if watchPositionAsync takes a while to produce the first event.
    startWatchdog();

    // Subscribe to live updates.
    subscription = watchPosition((p) => {
      if (stopped || !p) return;

      // GPS is back — reset the lost flag and update timestamp.
      gpsLostFired = false;
      lastPositionTime = Date.now();

      // Track movement for "stalled" detection: if user moved >=5m since the
      // last known position, mark them as recently moving.
      if (lastKnownPosition) {
        const moved = haversineMeters(
          lastKnownPosition.lat,
          lastKnownPosition.lon,
          p.latitude,
          p.longitude
        );
        if (moved >= 5) {
          lastSignificantMoveAt = Date.now();
        }
      }
      lastKnownPosition = { lat: p.latitude, lon: p.longitude };

      try {
        emitProgress(p);
      } catch (_) {
        // Never let a processing error kill the subscription.
      }
    });

    // Emit one progress tick immediately with the seed position so the UI gets
    // an instant "X meters to next turn" display.
    try {
      emitProgress(pos);
    } catch (_) {}

    return true;
  }

  function stop() {
    stopped = true;
    stopWatchdog();
    try {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    } catch (_) {}
    subscription = null;
  }

  return { start, stop };
}
