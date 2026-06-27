/**
 * Walking route + geocoding via Google Maps Platform.
 * Optional fallback providers remain available if Google keys are missing.
 */

import * as Location from 'expo-location';

const GOOGLE_PLACES_BASE = 'https://places.googleapis.com/v1';
const GOOGLE_DIRECTIONS_BASE = 'https://maps.googleapis.com/maps/api/directions/json';
const GEOAPIFY_BASE = 'https://api.geoapify.com';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE =
  process.env.EXPO_PUBLIC_OSRM_BASE_URL || 'https://router.project-osrm.org';
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || null;
const GEOAPIFY_API_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || null;
const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY || null;

const USER_AGENT = 'VisionVoice/1.0 (accessibility navigation app)';
const ORS_BASE = 'https://api.openrouteservice.org';

const NEARBY_PREFIX_RE = /^(nearest|nearby|closest|local)\s+/i;
const NEAR_ME_SUFFIX_RE = /\s+(near me|nearby|around me|close to me)$/i;
const SEARCH_ALIASES = {
  cafe: ['cafe', 'coffee shop', 'coffee'],
  'coffee shop': ['coffee shop', 'cafe', 'coffee'],
  coffee: ['coffee', 'coffee shop', 'cafe'],
  restaurant: ['restaurant', 'food'],
  atm: ['atm', 'bank atm'],
  hospital: ['hospital', 'clinic'],
  pharmacy: ['pharmacy', 'chemist'],
  bus: ['bus stop', 'bus station'],
  'bus stop': ['bus stop', 'bus station'],
  train: ['train station', 'railway station'],
  'train station': ['train station', 'railway station'],
};

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} meters`;
  return `${(meters / 1000).toFixed(1)} kilometers`;
}

function formatDuration(seconds) {
  const mins = Math.max(1, Math.round(seconds / 60));
  return mins === 1 ? '1 minute' : `${mins} minutes`;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildViewbox(origin, radiusDegrees = 0.08) {
  return [
    origin.longitude - radiusDegrees,
    origin.latitude + radiusDegrees,
    origin.longitude + radiusDegrees,
    origin.latitude - radiusDegrees,
  ].join(',');
}

function normalizeDestinationQuery(query) {
  return query
    .trim()
    .replace(/[.,!?]+$/g, '')
    .replace(NEARBY_PREFIX_RE, '')
    .replace(NEAR_ME_SUFFIX_RE, '')
    .trim();
}

function buildSearchQueries(query) {
  const normalized = normalizeDestinationQuery(query);
  const variants = [query.trim(), normalized].filter(Boolean);
  const aliases = SEARCH_ALIASES[normalized.toLowerCase()];
  if (aliases) variants.push(...aliases);
  if (normalized && !/india/i.test(normalized)) {
    variants.push(`${normalized}, India`);
    variants.push(`${normalized} India`);
  }
  return [...new Set(variants.map((item) => item.trim()).filter(Boolean))];
}

function buildGoogleLocationBias(origin, radiusMeters = 30000) {
  if (!origin) return null;
  return {
    circle: {
      center: {
        latitude: origin.latitude,
        longitude: origin.longitude,
      },
      radius: radiusMeters,
    },
  };
}

function simplifyStepInstruction(text) {
  if (!text) return 'Continue straight';

  return String(text)
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/^(Head|Proceed|Continue) /i, 'Continue ')
    .replace(/^Merge onto /i, 'Merge onto ')
    .replace(/^Turn left /i, 'Turn left ')
    .replace(/^Turn right /i, 'Turn right ')
    .trim();
}

function buildRouteFromGoogleDirections(data, destination) {
  const route = data.routes?.[0];
  const leg = route?.legs?.[0];
  if (!leg?.steps?.length) return null;

  const steps = leg.steps
    .map((step) => {
      const maneuver = mapManeuver(step.maneuver || '', step.html_instructions || step.instructions || '');
      const instruction = step.html_instructions
        ? step.html_instructions.replace(/<[^>]+>/g, ' ')
        : step.instructions || step.maneuver || maneuver.spokenCue;
      const spokenCue = simplifyStepInstruction(instruction);
      return {
        instruction: spokenCue,
        spokenCue,
        maneuverType: maneuver.maneuverType,
        hapticKey: maneuver.hapticKey,
        latitude: step.end_location?.lat ?? destination.latitude,
        longitude: step.end_location?.lng ?? destination.longitude,
        distanceMeters: step.distance?.value || 0,
      };
    })
    .filter((step) => step.instruction && step.spokenCue);

  if (!steps.length) return null;

  const last = steps[steps.length - 1];
  if (last.maneuverType !== 'arrive') {
    steps.push({
      instruction: 'Arrive',
      spokenCue: 'You have arrived',
      maneuverType: 'arrive',
      hapticKey: 'navigationArrived',
      latitude: destination.latitude,
      longitude: destination.longitude,
      distanceMeters: 0,
    });
  }

  return {
    steps: compressRouteSteps(steps),
    totalDistanceMeters: route.legs?.[0]?.distance || 0,
    totalDurationSeconds: route.legs?.[0]?.duration || 0,
  };
}

function compressRouteSteps(steps) {
  const compressed = [];

  for (const step of steps) {
    const last = compressed[compressed.length - 1];
    if (
      last &&
      last.maneuverType === step.maneuverType &&
      last.instruction === step.instruction &&
      Math.abs((last.distanceMeters || 0) - (step.distanceMeters || 0)) < 20
    ) {
      last.distanceMeters += step.distanceMeters || 0;
      continue;
    }

    compressed.push({ ...step });
  }

  return compressed;
}

function sortPlacesByDistance(places, origin, getLatitude, getLongitude) {
  if (!origin) return places;

  return [...places].sort(
    (a, b) =>
      haversineMeters(origin.latitude, origin.longitude, getLatitude(a), getLongitude(a)) -
      haversineMeters(origin.latitude, origin.longitude, getLatitude(b), getLongitude(b))
  );
}

function mapManeuver(type, modifier) {
  const t = (type || '').toLowerCase();
  const m = (modifier || '').toLowerCase();

  if (t === 'arrive') {
    return { maneuverType: 'arrive', hapticKey: 'navigationArrived', spokenCue: 'You have arrived' };
  }
  if (m === 'left' || m === 'sharp left' || m === 'slight left') {
    return { maneuverType: 'left', hapticKey: 'navTurnLeft', spokenCue: 'Turn left now' };
  }
  if (m === 'right' || m === 'sharp right' || m === 'slight right') {
    return { maneuverType: 'right', hapticKey: 'navTurnRight', spokenCue: 'Turn right now' };
  }
  if (t === 'turn' || t === 'continue' || t === 'new name' || m === 'straight') {
    return { maneuverType: 'straight', hapticKey: 'navContinue', spokenCue: 'Continue straight' };
  }
  return { maneuverType: 'other', hapticKey: 'navigationTurn', spokenCue: 'Follow the path ahead' };
}

function buildSpokenCue(maneuver, streetName) {
  const base = maneuver.spokenCue;
  if (streetName && streetName.length > 1) {
    if (maneuver.maneuverType === 'arrive') return base;
    return `${base} onto ${streetName}`;
  }
  return base;
}

async function searchNominatim(query, origin, bounded) {
  const params = new URLSearchParams({
    format: 'json',
    limit: '5',
    addressdetails: '0',
    q: query,
  });

  if (origin) {
    params.set('viewbox', buildViewbox(origin));
    if (bounded) params.set('bounded', '1');
  }

  const url = `${NOMINATIM_BASE}/search?${params.toString()}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Geocoding failed (${res.status})`);
  }

  return await res.json();
}

async function searchGooglePlaces(query, origin) {
  if (!GOOGLE_MAPS_API_KEY) return [];

  const body = {
    textQuery: query,
  };

  const locationBias = buildGoogleLocationBias(origin);
  if (locationBias) body.locationBias = locationBias;

  const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Google Places failed (${res.status})`);
  }

  const data = await res.json();
  return data?.places || [];
}

async function geocodeWithGoogle(query, origin) {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const searchQueries = buildSearchQueries(query);

  for (const searchQuery of searchQueries) {
    const places = await searchGooglePlaces(searchQuery, origin);
    if (!places?.length) continue;

    const sorted = sortPlacesByDistance(
      places,
      origin,
      (place) => place.location?.latitude,
      (place) => place.location?.longitude
    );

    const place = sorted[0];
    const name =
      place.displayName?.text ||
      place.formattedAddress?.split(',')?.[0] ||
      searchQuery;

    return {
      name,
      googlePlaceId: place.id || null,
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
      provider: 'google',
    };
  }

  return null;
}

async function searchGeoapify(query, origin) {
  if (!GEOAPIFY_API_KEY) return [];

  const params = new URLSearchParams({
    text: query,
    format: 'json',
    limit: '5',
    apiKey: GEOAPIFY_API_KEY,
  });

  if (origin) {
    params.set('bias', `proximity:${origin.longitude},${origin.latitude}`);
  }
  params.set('filter', 'countrycode:in');

  const url = `${GEOAPIFY_BASE}/v1/geocode/search?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    throw new Error(`Geoapify geocoding failed (${res.status})`);
  }

  const data = await res.json();
  return data?.results || [];
}

async function geocodeWithGeoapify(query, origin) {
  if (!GEOAPIFY_API_KEY) return null;

  const searchQueries = buildSearchQueries(query);

  for (const searchQuery of searchQueries) {
    for (const useOrigin of origin ? [true, false] : [false]) {
      const data = await searchGeoapify(searchQuery, useOrigin ? origin : null);
      if (!data?.length) continue;

      const sorted = sortPlacesByDistance(
        data,
        origin,
        (place) => parseFloat(place.lat),
        (place) => parseFloat(place.lon)
      );
      const place = sorted[0];
      const name = place.name || place.address_line1 || place.formatted || searchQuery;

      return {
        name,
        latitude: parseFloat(place.lat),
        longitude: parseFloat(place.lon),
        provider: 'geoapify',
      };
    }
  }

  return null;
}

async function geocodeWithNominatim(query, origin) {
  const searchQueries = buildSearchQueries(query);

  for (const searchQuery of searchQueries) {
    const attempts = origin
      ? [{ bounded: true }, { bounded: false }]
      : [{ bounded: false }];

    for (const attempt of attempts) {
      const data = await searchNominatim(searchQuery, origin, attempt.bounded);
      if (!data?.length) continue;

      const sorted = sortPlacesByDistance(
        data,
        origin,
        (place) => parseFloat(place.lat),
        (place) => parseFloat(place.lon)
      );

      const place = sorted[0];
      return {
        name: place.display_name?.split(',')[0] || searchQuery,
        latitude: parseFloat(place.lat),
        longitude: parseFloat(place.lon),
        provider: 'nominatim',
      };
    }
  }

  return null;
}

async function getOriginCoordinates() {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    const granted = await Location.requestForegroundPermissionsAsync();
    if (granted.status !== 'granted') return null;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

async function fetchRouteFromOsrm(origin, destination) {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url =
    `${OSRM_BASE}/route/v1/foot/${coords}?steps=true&overview=full&geometries=geojson`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);

  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) return null;

  const route = data.routes[0];
  const leg = route.legs?.[0];
  if (!leg?.steps?.length) return null;

  const steps = leg.steps
    .filter((step) => step.maneuver)
    .map((step) => {
      const [lon, lat] = step.maneuver.location;
      const maneuver = mapManeuver(step.maneuver.type, step.maneuver.modifier);
      return {
        instruction: step.name || maneuver.spokenCue,
        spokenCue: buildSpokenCue(maneuver, step.name),
        maneuverType: maneuver.maneuverType,
        hapticKey: maneuver.hapticKey,
        latitude: lat,
        longitude: lon,
        distanceMeters: step.distance || 0,
      };
    });

  if (!steps.length) return null;

  const last = steps[steps.length - 1];
  if (last.maneuverType !== 'arrive') {
    steps.push({
      instruction: 'Arrive',
      spokenCue: 'You have arrived',
      maneuverType: 'arrive',
      hapticKey: 'navigationArrived',
      latitude: destination.latitude,
      longitude: destination.longitude,
      distanceMeters: 0,
    });
  }

  return {
    steps,
    totalDistanceMeters: route.distance || leg.distance || 0,
    totalDurationSeconds: route.duration || leg.duration || 0,
  };
}

async function fetchRouteFromGoogleDirections(origin, destination) {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode: 'walking',
    alternatives: 'false',
    units: 'metric',
    key: GOOGLE_MAPS_API_KEY,
  });

  const res = await fetch(`${GOOGLE_DIRECTIONS_BASE}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google Directions failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  if (data.status !== 'OK' || !data.routes?.length) {
    return null;
  }

  const route = data.routes[0];
  const leg = route.legs?.[0];
  if (!leg?.steps?.length) return null;

  const steps = leg.steps
    .map((step) => {
      const maneuverText = step.maneuver || '';
      const instructionText =
        step.html_instructions?.replace(/<[^>]+>/g, ' ') ||
        step.instructions ||
        maneuverText ||
        'Continue straight';

      const maneuver = mapManeuver(maneuverText, instructionText);
      const spokenCue = simplifyStepInstruction(instructionText);

      return {
        instruction: spokenCue,
        spokenCue,
        maneuverType: maneuver.maneuverType,
        hapticKey: maneuver.hapticKey,
        latitude: step.end_location?.lat ?? destination.latitude,
        longitude: step.end_location?.lng ?? destination.longitude,
        distanceMeters: step.distance?.value || 0,
      };
    })
    .filter((step) => step.instruction);

  if (!steps.length) return null;

  return {
    steps: compressRouteSteps(
      steps.concat({
        instruction: 'Arrive',
        spokenCue: 'You have arrived',
        maneuverType: 'arrive',
        hapticKey: 'navigationArrived',
        latitude: destination.latitude,
        longitude: destination.longitude,
        distanceMeters: 0,
      })
    ),
    totalDistanceMeters: leg.distance || route.legs?.[0]?.distance || 0,
    totalDurationSeconds: leg.duration || route.legs?.[0]?.duration || 0,
  };
}

function mapOrsInstruction(type, instruction) {
  const text = (instruction || '').toLowerCase();

  if (type === 10 || type === 11 || text.includes('arrive')) {
    return { maneuverType: 'arrive', hapticKey: 'navigationArrived', spokenCue: 'You have arrived' };
  }
  if (text.includes('left')) {
    return { maneuverType: 'left', hapticKey: 'navTurnLeft', spokenCue: instruction || 'Turn left now' };
  }
  if (text.includes('right')) {
    return { maneuverType: 'right', hapticKey: 'navTurnRight', spokenCue: instruction || 'Turn right now' };
  }
  if (text.includes('straight') || text.includes('continue')) {
    return { maneuverType: 'straight', hapticKey: 'navContinue', spokenCue: instruction || 'Continue straight' };
  }

  return { maneuverType: 'other', hapticKey: 'navigationTurn', spokenCue: instruction || 'Follow the path ahead' };
}

function buildRouteFromOrsData(data, destination) {
  const route = data.routes?.[0];
  const segment = route?.segments?.[0];
  const geometry = route?.geometry?.coordinates || route?.geometry || [];
  if (!segment?.steps?.length) return null;

  const steps = segment.steps.map((step) => {
    const pointIndex = step.way_points?.[0] ?? 0;
    const point = geometry[Math.min(pointIndex, geometry.length - 1)] || [
      destination.longitude,
      destination.latitude,
    ];
    const [lon, lat] = Array.isArray(point) ? point : [destination.longitude, destination.latitude];
    const maneuver = mapOrsInstruction(step.type, step.instruction);
    return {
      instruction: step.instruction || maneuver.spokenCue,
      spokenCue: maneuver.spokenCue,
      maneuverType: maneuver.maneuverType,
      hapticKey: maneuver.hapticKey,
      latitude: lat,
      longitude: lon,
      distanceMeters: step.distance || 0,
    };
  });

  const last = steps[steps.length - 1];
  if (last?.maneuverType !== 'arrive') {
    steps.push({
      instruction: 'Arrive',
      spokenCue: 'You have arrived',
      maneuverType: 'arrive',
      hapticKey: 'navigationArrived',
      latitude: destination.latitude,
      longitude: destination.longitude,
      distanceMeters: 0,
    });
  }

  return {
    steps,
    totalDistanceMeters: route.distance || segment.distance || 0,
    totalDurationSeconds: route.duration || segment.duration || 0,
  };
}

async function fetchRouteFromOpenRouteService(origin, destination) {
  if (!ORS_API_KEY) return null;

  const payload = {
    coordinates: [
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
    ],
    instructions: true,
  };

  const attempts = [
    {
      name: 'bearer',
      url: `${ORS_BASE}/v2/directions/foot-walking/json`,
      headers: {
        Authorization: `Bearer ${ORS_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    },
    {
      name: 'raw-header',
      url: `${ORS_BASE}/v2/directions/foot-walking/json`,
      headers: {
        Authorization: ORS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    },
    {
      name: 'query-key',
      url: `${ORS_BASE}/v2/directions/foot-walking/json?api_key=${encodeURIComponent(ORS_API_KEY)}`,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    const res = await fetch(attempt.url, {
      method: 'POST',
      headers: attempt.headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      lastError = new Error(`OpenRouteService routing failed (${attempt.name}, ${res.status}): ${body}`);
      continue;
    }

    const data = await res.json();
    const route = buildRouteFromOrsData(data, destination);
    if (!route) return null;
    return route;
  }

  throw lastError || new Error('OpenRouteService routing failed');
}

/**
 * Fetch a walking route to a destination query string.
 * Works without API keys via Nominatim + OSRM public endpoints.
 * Uses Geoapify geocoding first when EXPO_PUBLIC_GEOAPIFY_API_KEY is set.
 */
export async function fetchWalkingRoute(destinationQuery) {
  if (!destinationQuery?.trim()) {
    return { ok: false, message: 'No destination provided. Please try again.' };
  }

  try {
    const origin = await getOriginCoordinates();
    if (!origin) {
      return {
        ok: false,
        message: 'Location permission is required for navigation. Enable location in settings.',
      };
    }

    let destination = null;

    try {
      destination = await geocodeWithGoogle(destinationQuery.trim(), origin);
    } catch (err) {
      console.warn('Google geocoding error:', err.message);
    }

    if (!destination) {
      try {
        destination = await geocodeWithGeoapify(destinationQuery.trim(), origin);
      } catch (err) {
        console.warn('Geoapify geocoding error:', err.message);
      }
    }

    if (!destination) {
      destination = await geocodeWithNominatim(destinationQuery.trim(), origin);
    }

    if (!destination) {
      return {
        ok: false,
        message: `Could not find ${destinationQuery}. Please try a different place name.`,
      };
    }

    let route = null;
    let routingProvider = null;

    if (GOOGLE_MAPS_API_KEY) {
      try {
        route = await fetchRouteFromGoogleDirections(origin, destination);
        if (route) routingProvider = 'google';
      } catch (err) {
        console.warn('Google Directions error:', err.message);
      }
    }

    if (!route && ORS_API_KEY) {
      try {
        route = await fetchRouteFromOpenRouteService(origin, destination);
        if (route) routingProvider = 'ors';
      } catch (err) {
        console.warn('OpenRouteService routing error:', err.message);
      }
    }

    if (!route && OSRM_BASE && OSRM_BASE !== 'https://router.project-osrm.org') {
      try {
        route = await fetchRouteFromOsrm(origin, destination);
        if (route) routingProvider = 'osrm';
      } catch (err) {
        console.warn('OSRM routing error:', err.message);
      }
    }

    if (!route) {
      return {
        ok: false,
        message: 'No walking route found. Try a closer or clearer destination.',
      };
    }

    console.warn(
      `[routing] geocode=${destination.provider || 'unknown'} route=${routingProvider || 'unknown'} steps=${route.steps.length}`
    );

    return {
      ok: true,
      destinationName: destination.name,
      destination,
      origin,
      steps: route.steps,
      summaryDistance: formatDistance(route.totalDistanceMeters),
      summaryDuration: formatDuration(route.totalDurationSeconds),
      totalDistanceMeters: route.totalDistanceMeters,
      totalDurationSeconds: route.totalDurationSeconds,
    };
  } catch (err) {
    console.warn('fetchWalkingRoute error:', err);
    return {
      ok: false,
      message: 'Navigation is unavailable right now. Check your connection and try again.',
    };
  }
}

export { haversineMeters, formatDistance };
