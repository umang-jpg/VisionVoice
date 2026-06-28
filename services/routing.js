// services/routing.js
//
// Free-only routing stack with fallback:
//   Geocode: Geoapify -> Nominatim
//   Route:   ORS      -> OSRM
//
// HARD RULES honored here:
//   - No paid/credit-card APIs.
//   - No npm deps beyond expo-location (already required by locationService).
//     All geometry (haversine distance, bearing, geojson line-string handling)
//     is implemented inline as plain JS.
//   - Every fetch is timeout-bounded via AbortController (~8s).
//   - No function throws out to the caller; failures resolve RouteError.

// -----------------------------
// Low-level fetch helper
// -----------------------------

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Wrapped fetch with timeout. Never throws — returns {ok:true,status,json}
 * or {ok:false}. JSON parse failures count as failures.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const status = res.status;
    if (status < 200 || status >= 300) {
      return { ok: false, status };
    }
    let json = null;
    try {
      json = await res.json();
    } catch (_) {
      return { ok: false, status };
    }
    return { ok: true, status, json };
  } catch (_) {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

// -----------------------------
// Inline geometry helpers
// (No turf / geolib — manual implementations, good enough at city-walk scale.)
// -----------------------------

function toRad(deg) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

/** Haversine distance in meters between {lat,lon}. */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Initial bearing in degrees (0=N, 90=E) from point1 -> point2. */
function bearingDeg(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// -----------------------------
// Maneuver normalization
// -----------------------------

/**
 * Maps a provider maneuver (type + optional modifier/direction + step text)
 * onto one of the five internal buckets. Falls back to bearing-delta analysis
 * when the provider gives no directional signal.
 */
function bucketFromManeuver({
  type,
  modifier,
  direction,
  instructionText,
  prevCoord,
  thisCoord,
  nextCoord,
}) {
  const t = (type || '').toLowerCase();
  const m = (modifier || direction || '').toLowerCase();

  if (t === 'arrive' || t === 'destination' || t === 'end_of_road') {
    if (t === 'arrive' || t === 'destination') return 'arrive';
  }

  if (t === 'turn' || t === 'new name' || t === 'merge' || t === 'on ramp' || t === 'off ramp' || t === 'end of road') {
    if (m.includes('left')) return 'turn-left';
    if (m.includes('right')) return 'turn-right';
  }

  if (t === 'continue' || t === 'depart' || t === 'merge') {
    if (m.includes('left')) return 'turn-left';
    if (m.includes('right')) return 'turn-right';
    if (m === 'straight' || m === 'slight' || m === '' || m === 'uturn') {
      if (m === 'uturn') return 'uturn';
      return 'straight';
    }
  }

  if (t === 'roundabout' || t === 'rotary' || t === 'roundabout turn') {
    if (m.includes('left')) return 'turn-left';
    if (m.includes('right')) return 'turn-right';
    return 'straight';
  }

  if (t === 'uturn' || m === 'uturn' || m.includes('u-turn') || m.includes('uturn')) {
    return 'uturn';
  }

  // Instruction-text heuristics (used when raw text is rich, e.g. OSRM 'name').
  if (instructionText) {
    const txt = instructionText.toLowerCase();
    if (txt.includes('u-turn') || txt.includes('uturn') || txt.includes('turn around')) return 'uturn';
    if (txt.includes('turn left') || txt.includes('bear left') || txt.includes('slight left') || txt.includes('sharp left')) return 'turn-left';
    if (txt.includes('turn right') || txt.includes('bear right') || txt.includes('slight right') || txt.includes('sharp right')) return 'turn-right';
    if (txt.includes('arriv') || txt.includes('destination') || txt.includes('you have reached')) return 'arrive';
    if (txt.includes('continue') || txt.includes('straight') || txt.includes('head') || txt.includes('depart')) return 'straight';
  }

  // Bearing-delta fallback: infer turn direction from geometry.
  if (prevCoord && thisCoord && nextCoord) {
    try {
      const b1 = bearingDeg(prevCoord[1], prevCoord[0], thisCoord[1], thisCoord[0]);
      const b2 = bearingDeg(thisCoord[1], thisCoord[0], nextCoord[1], nextCoord[0]);
      let delta = (b2 - b1 + 360) % 360;
      if (delta > 180) delta -= 360; // -180..180
      if (delta > 140 || delta < -140) return 'uturn';
      if (delta > 30) return 'turn-right';
      if (delta < -30) return 'turn-left';
      return 'straight';
    } catch (_) {
      // ignore
    }
  }

  return 'straight';
}

function bucketToHapticKey(bucket) {
  switch (bucket) {
    case 'turn-left':
    case 'turn-right':
      return 'navigationTurn';
    case 'uturn':
      // NOTE: 'navigationUturn' must be registered as a pattern key in
      // services/haptics.js. If it is not, playHapticPattern() falls back to
      // a generic selectionAsync() buzz (not broken, just weaker than
      // intended) — confirm this key exists before wiring.
      return 'navigationUturn';
    case 'arrive':
      return 'navigationArrived';
    case 'straight':
    default:
      return 'navigationStraight';
  }
}

function bucketToGenericSpoken(bucket) {
  switch (bucket) {
    case 'turn-left':
      return 'Turn left';
    case 'turn-right':
      return 'Turn right';
    case 'uturn':
      return 'Turn around';
    case 'arrive':
      return 'You have arrived';
    case 'straight':
    default:
      return 'Continue straight';
  }
}

/** Returns the street name from a route name string. */
function cleanName(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  return s;
}

// -----------------------------
// ORS normalizer
// -----------------------------

function normalizeOrs(data) {
  // data: GeoJSON FeatureCollection
  if (!data || !data.features || !data.features.length) return null;
  const feature = data.features[0];
  const coords = feature?.geometry?.coordinates || [];
  const segs = feature?.properties?.segments || [];
  if (!segs.length) return null;
  const seg = segs[0];
  const rawSteps = seg.steps || [];

  const steps = [];
  // Build coordinate slice per step using way_points (indices into the geometry).
  for (let i = 0; i < rawSteps.length; i++) {
    const s = rawSteps[i];
    const wp = s.way_points || [0, coords.length - 1];
    const startIdx = Math.max(0, Math.min(wp[0] || 0, coords.length - 1));
    const endIdx = Math.max(startIdx, Math.min(wp[1] || coords.length - 1, coords.length - 1));
    const segCoords = coords.slice(startIdx, endIdx + 1);

    // Context for bearing fallback
    const prevCoord = i > 0 ? (steps[i - 1].coordinates || []).slice(-1)[0] : segCoords[0];
    const thisCoord = segCoords[0];
    const nextCoord = segCoords.length > 1 ? segCoords[1] : segCoords[segCoords.length - 1];

    const isLast = i === rawSteps.length - 1;

    const bucket = isLast
      ? 'arrive'
      : bucketFromManeuver({
          type: s.type,
          instructionText: s.instruction,
          prevCoord,
          thisCoord,
          nextCoord,
        });

    const distance = typeof s.distance === 'number' ? s.distance : 0;

    // Prefer the provider's human instruction text; otherwise bucket fallback.
    let spokenCue = '';
    if (s.instruction && String(s.instruction).trim().length) {
      spokenCue = String(s.instruction).trim();
      if (isLast && !/arriv|destination|reached|you have/i.test(spokenCue)) {
        spokenCue = `${spokenCue}. You have arrived`;
      }
    } else {
      spokenCue = bucketToGenericSpoken(bucket);
    }

    steps.push({
      index: i,
      instructionBucket: bucket,
      spokenCue,
      hapticKey: bucketToHapticKey(bucket),
      distanceMeters: distance,
      coordinates: segCoords,
    });
  }

  // Summary
  const totalDistance = feature?.properties?.summary?.distance ?? 0;
  const totalDuration = feature?.properties?.summary?.duration ?? 0;
  const summaryDistance = formatDistance(totalDistance);
  const summaryDuration = formatDuration(totalDuration);

  return { steps, summaryDistance, summaryDuration };
}

// -----------------------------
// OSRM normalizer
// -----------------------------

function normalizeOsrm(data) {
  if (!data || !data.routes || !data.routes.length) return null;
  const route = data.routes[0];
  const legs = route.legs || [];
  if (!legs.length) return null;
  const leg = legs[0];
  const rawSteps = leg.steps || [];

  // OSRM provides per-step geometry; we keep each step's own coordinates.
  const steps = [];
  for (let i = 0; i < rawSteps.length; i++) {
    const s = rawSteps[i];
    const segCoords = (s.geometry && s.geometry.coordinates) || [];
    if (!segCoords.length) {
      // No geometry; synthesize an empty slice so downstream never crashes.
      // (Rare; just guard.)
    }
    const prevCoord = i > 0 ? (steps[i - 1].coordinates || []).slice(-1)[0] : segCoords[0];
    const thisCoord = segCoords[0];
    const nextCoord = segCoords.length > 1 ? segCoords[1] : segCoords[segCoords.length - 1];

    const isLast = i === rawSteps.length - 1;
    const maneuver = s.maneuver || {};
    const bucket = isLast && maneuver.type === 'arrive'
      ? 'arrive'
      : bucketFromManeuver({
          type: maneuver.type,
          modifier: maneuver.modifier,
          prevCoord,
          thisCoord,
          nextCoord,
        });

    const distance = typeof s.distance === 'number' ? s.distance : 0;
    let spokenCue = '';

    // OSRM step.name is the street name; build a sensible sentence.
    const name = cleanName(s.name);
    if (maneuver.type === 'arrive' || isLast) {
      spokenCue = name ? `Arriving at ${name}` : 'You have arrived';
    } else if (maneuver.type === 'depart') {
      spokenCue = name ? `Head toward ${name}` : 'Continue straight';
    } else if (maneuver.type === 'turn' || maneuver.type === 'new name' || maneuver.type === 'merge' || maneuver.type === 'on ramp' || maneuver.type === 'off ramp' || maneuver.type === 'end of road' || maneuver.type === 'continue') {
      const dir = (maneuver.modifier || '').replace('slight ', 'slight ').replace('sharp ', 'sharp ');
      const humanDir = dir ? `${dir} ` : '';
      spokenCue = name
        ? `Turn ${humanDir}onto ${name}`.replace(/\s+/g, ' ').trim()
        : `Turn ${humanDir}`.replace(/\s+/g, ' ').trim();
      if (!spokenCue || spokenCue === 'Turn') spokenCue = bucketToGenericSpoken(bucket);
    } else if (maneuver.type === 'roundabout' || maneuver.type === 'rotary') {
      spokenCue = name ? `Enter the roundabout toward ${name}` : 'Enter the roundabout';
    } else if (maneuver.type === 'uturn') {
      spokenCue = 'Turn around';
    } else {
      spokenCue = bucketToGenericSpoken(bucket);
    }

    steps.push({
      index: i,
      instructionBucket: bucket,
      spokenCue,
      hapticKey: bucketToHapticKey(bucket),
      distanceMeters: distance,
      coordinates: segCoords,
    });
  }

  const summaryDistance = formatDistance(route.distance || 0);
  const summaryDuration = formatDuration(route.duration || 0);

  return { steps, summaryDistance, summaryDuration };
}

// -----------------------------
// Formatting helpers
// -----------------------------

function formatDistance(meters) {
  if (typeof meters !== 'number' || !isFinite(meters)) return 'unknown distance';
  if (meters < 1000) return `${Math.round(meters / 10) * 10} meters`;
  const km = meters / 1000;
  if (km < 10) return `${km.toFixed(1)} kilometers`;
  return `${Math.round(km)} kilometers`;
}

function formatDuration(seconds) {
  if (typeof seconds !== 'number' || !isFinite(seconds)) return 'unknown time';
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'less than a minute';
  if (minutes === 1) return 'about 1 minute';
  if (minutes < 60) return `about ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (remMin === 0) return `about ${hours} hour${hours === 1 ? '' : 's'}`;
  return `about ${hours} hour${hours === 1 ? '' : 's'} ${remMin} minutes`;
}

// -----------------------------
// Step A: Geocoding
// -----------------------------

/**
 * @returns {Promise<{lat:number, lon:number, name:string}|null>}
 */
async function geocodeDestination(query) {
  if (!query || typeof query !== 'string') return null;
  const text = query.trim();
  if (!text) return null;

  // --- 1. Geoapify ---
  try {
    const geoapifyKey = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY;
    console.log('[geocode] Geoapify key present:', !!geoapifyKey);
    if (geoapifyKey) {
      const url =
        'https://api.geoapify.com/v1/geocode/search?apiKey=' +
        encodeURIComponent(geoapifyKey) +
        '&limit=1&text=' +
        encodeURIComponent(text);
      const r = await fetchWithTimeout(url, {
        headers: { Accept: 'application/json' },
      });
      console.log('[geocode] Geoapify response ok:', r.ok, 'status:', r.status, 'body:', JSON.stringify(r.json)?.slice(0, 300));
      if (
        r.ok &&
        r.json &&
        Array.isArray(r.json.features) &&
        r.json.features.length
      ) {
        const f = r.json.features[0];
        const lon = f?.properties?.lon;
        const lat = f?.properties?.lat;
        if (
          typeof lat === 'number' &&
          isFinite(lat) &&
          typeof lon === 'number' &&
          isFinite(lon)
        ) {
          const name =
            f?.properties?.formatted ||
            f?.properties?.name ||
            f?.properties?.city ||
            text;
          return { lat, lon, name: String(name) };
        }
      }
    }
  } catch (e) {
    console.log('[geocode] Geoapify threw:', e?.message);
    // fall through
  }

  // --- 2. Nominatim ---
  try {
    // Required descriptive User-Agent per Nominatim usage policy.
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
      encodeURIComponent(text);
    const r = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'application/json',
          // Nominatim REQUIRES a descriptive UA; requests without one may be rejected.
          'User-Agent': 'VisionVoiceApp/1.0 (accessibility app)',
        },
      },
      8000
    );
    console.log('[geocode] Nominatim response ok:', r.ok, 'status:', r.status, 'body:', JSON.stringify(r.json)?.slice(0, 300));
    if (
      r.ok &&
      r.json &&
      Array.isArray(r.json) &&
      r.json.length
    ) {
      const hit = r.json[0];
      const lat = parseFloat(hit.lat);
      const lon = parseFloat(hit.lon);
      if (isFinite(lat) && isFinite(lon)) {
        const name = hit.display_name || hit.name || text;
        return { lat, lon, name: String(name) };
      }
    }
  } catch (e) {
    console.log('[geocode] Nominatim threw:', e?.message);
    // fall through
  }

  return null;
}

// -----------------------------
// Step B: Routing
// -----------------------------

/**
 * @param {{latitude:number,longitude:number}} start
 * @param {{lat:number,lon:number,name:string}} dest
 * @returns {Promise<{steps:RouteStep[], summaryDistance:string, summaryDuration:string, rawProvider:'ors'|'osrm'}|null>}
 */
async function fetchRoute(start, dest) {
  const startLat = start.latitude;
  const startLon = start.longitude;
  const endLat = dest.lat;
  const endLon = dest.lon;

  // --- 1. OpenRouteService ---
  try {
    const orsKey = process.env.EXPO_PUBLIC_ORS_API_KEY;
    console.log('[routing] ORS key present:', !!orsKey);
    if (orsKey) {
      const url =
        'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
      const r = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: orsKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            coordinates: [
              [startLon, startLat],
              [endLon, endLat],
            ],
          }),
        },
        8000
      );
      console.log('[routing] ORS response ok:', r.ok, 'status:', r.status, 'body:', JSON.stringify(r.json)?.slice(0, 300));
      if (r.ok && r.json) {
        const norm = normalizeOrs(r.json);
        if (norm && norm.steps && norm.steps.length) {
          return {
            steps: norm.steps,
            summaryDistance: norm.summaryDistance,
            summaryDuration: norm.summaryDuration,
            rawProvider: 'ors',
          };
        }
      }
    }
  } catch (e) {
    console.log('[routing] ORS threw:', e?.message);
    // fall through
  }

  // --- 2. OSRM public demo ---
  try {
    const url =
      'https://router.project-osrm.org/route/v1/foot/' +
      encodeURIComponent(startLon) +
      ',' +
      encodeURIComponent(startLat) +
      ';' +
      encodeURIComponent(endLon) +
      ',' +
      encodeURIComponent(endLat) +
      '?overview=full&geometries=geojson&steps=true';
    const r = await fetchWithTimeout(url, {
      headers: { Accept: 'application/json' },
    });
    console.log('[routing] OSRM response ok:', r.ok, 'status:', r.status, 'body:', JSON.stringify(r.json)?.slice(0, 300));
    if (r.ok && r.json) {
      const norm = normalizeOsrm(r.json);
      if (norm && norm.steps && norm.steps.length) {
        return {
          steps: norm.steps,
          summaryDistance: norm.summaryDistance,
          summaryDuration: norm.summaryDuration,
          rawProvider: 'osrm',
        };
      }
    }
  } catch (e) {
    console.log('[routing] OSRM threw:', e?.message);
    // fall through
  }

  return null;
}

// -----------------------------
// Public entry: fetchWalkingRoute
// -----------------------------

/**
 * @param {string} destinationQuery
 * @returns {Promise<RouteResult|RouteError>}
 */
export async function fetchWalkingRoute(destinationQuery) {
  // Defensive: bad query type -> speakable, friendly error.
  if (!destinationQuery || typeof destinationQuery !== 'string' || !destinationQuery.trim()) {
    return {
      ok: false,
      message: 'Please tell me where you would like to go.',
      code: 'geocode_failed',
    };
  }

  // Lazy-import to avoid circular concerns and to keep this file's
  // permission/position logic decoupled at module-load time.
  let currentPosition = null;
  try {
    const { getCurrentPosition, requestLocationPermission } = require('./locationService');
    const granted = await requestLocationPermission();
    if (!granted) {
      return {
        ok: false,
        message:
          'I need location permission to guide you. Please allow location access in your settings.',
        code: 'location_permission_denied',
      };
    }
    currentPosition = await getCurrentPosition();
  } catch (_) {
    currentPosition = null;
  }

  if (
    !currentPosition ||
    typeof currentPosition.latitude !== 'number' ||
    typeof currentPosition.longitude !== 'number'
  ) {
    return {
      ok: false,
      message: 'I could not find your current location. Please try again in a moment.',
      code: 'location_permission_denied',
    };
  }

  // Geocode destination.
  let dest = null;
  try {
    dest = await geocodeDestination(destinationQuery);
  } catch (_) {
    dest = null;
  }
  if (!dest) {
    return {
      ok: false,
      message: 'I could not find that location. Please try a different destination.',
      code: 'geocode_failed',
    };
  }

  // Fetch walking route.
  let route = null;
  try {
    route = await fetchRoute(
      { latitude: currentPosition.latitude, longitude: currentPosition.longitude },
      dest
    );
  } catch (_) {
    route = null;
  }
  if (!route) {
    return {
      ok: false,
      message:
        'I could not plan a walking route to that place. Please check your connection and try again.',
      code: 'routing_failed',
    };
  }

  return {
    ok: true,
    destinationName: dest.name || destinationQuery,
    origin: {
      latitude: currentPosition.latitude,
      longitude: currentPosition.longitude,
    },
    steps: route.steps,
    summaryDistance: route.summaryDistance,
    summaryDuration: route.summaryDuration,
    rawProvider: route.rawProvider,
  };
}
