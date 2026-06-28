# ANTIGRAVITY TASK: Wire navigation logic into NavigationScreen.js

## SCOPE — READ THIS FIRST

You are integrating three already-written, already-correct service files into the existing `NavigationScreen.js`. You are **not** designing new UI, **not** inventing new metrics or telemetry, and **not** rewriting the screen's structure beyond what's specified below.

**Do not add anything not explicitly listed in this document.** No fake latency displays, no decorative stats, no "AI confidence" readouts, no replacing existing components. If you believe something is missing, stop and ask rather than inventing it. This is a hard rule — deviation here has caused rework before.

This is a hackathon MVP. It needs to work for the demo. It does not need to handle every edge case beyond what's specified — ship the happy path plus the three error paths below, and stop.

---

## FILES YOU ARE GIVEN (do not modify their internals)

Drop these into `services/` exactly as provided:
- `services/locationService.js`
- `services/routing.js`
- `services/navigationTracking.js`

These are tested against the contract `NavigationScreen.js` already expects. Do not rename exports, do not change their function signatures, do not "improve" their internals. If a bug is found in them, flag it — don't silently patch it inside a wiring task.

---

## STEP 1 — Install the one new dependency

```
npx expo install expo-location
```

Do not install anything else. No turf, no geolib, no other location/maps package.

---

## STEP 2 — Add environment variables

Add to `.env` (do not commit real keys to source control if this repo is public):

```
EXPO_PUBLIC_GEOAPIFY_API_KEY=your_key_here
EXPO_PUBLIC_ORS_API_KEY=your_key_here
```

Both are free, no-credit-card signups (geoapify.com, openrouteservice.org). If a key is temporarily missing, the routing service still works via its keyless fallbacks (Nominatim, OSRM) — so don't block on having both keys before testing.

---

## STEP 3 — Add the new haptic pattern keys

Open `services/haptics.js`. Add these four keys to the `HAPTIC_PATTERNS` object, following the exact same shape as the existing 10 patterns (`label`, `description`, `play()` async function). Match the existing file's style — do not change how existing patterns are defined.

| Key | Suggested pattern (match existing rhythm-based style) | Label | Description |
|---|---|---|---|
| `navigationTurn` | Light then heavy impact, 250ms apart | "Turn Ahead" | "A turn is coming up" |
| `navigationStraight` | (silent — see note below) | "Continue Straight" | "Path continues straight ahead" |
| `navigationArrived` | Light-medium-heavy ascending, 120ms apart | "Arrived" | "You have reached your destination" |
| `navigationUturn` | Three quick heavy impacts, 100ms apart | "Turn Around" | "A U-turn is required" |

**Note on `navigationStraight`:** per the existing app's design language (silence = calm/neutral, per your color-haptic-audio semantic system), this can be a no-op in `playHapticPattern()` — i.e. resolve immediately without firing any actual `Haptics.*` call. Confirm this against the existing `navigationTurn`/`navigationArrived` keys that may already exist as stubs from earlier scaffolding — if they already exist in the file, just confirm their pattern definitions are real (not placeholders) rather than re-adding them.

Do not touch any of the other 10 existing patterns.

---

## STEP 4 — Fix the screen's error handling (this is the one required logic change)

`NavigationScreen.js` currently only branches on one error code:

```js
onError: (code) => {
  if (code === 'location_denied') {
    speak('Location permission is required for turn-by-turn navigation.');
    if (hapticEnabled) playHapticPattern('error');
    resetToIdle();
  }
},
```

The tracker can emit **three** codes: `location_denied`, `location_unavailable`, `gps_lost`. Only one is currently handled — on the other two, the screen will silently hang on "Routing…" with no spoken feedback and no way to recover except navigating away. For a blind user this is a dead end, not just a rough edge.

Replace that block with:

```js
onError: (code) => {
  if (code === 'location_denied') {
    speak('Location permission is required for turn-by-turn navigation.');
    if (hapticEnabled) playHapticPattern('error');
    resetToIdle();
  } else if (code === 'location_unavailable') {
    speak('I could not get your current location. Please make sure GPS is enabled and try again.');
    if (hapticEnabled) playHapticPattern('error');
    resetToIdle();
  } else if (code === 'gps_lost') {
    speak('I lost your GPS signal. Navigation will continue once it is back.');
    if (hapticEnabled) playHapticPattern('warning');
    // Do NOT call resetToIdle() here — gps_lost is recoverable mid-walk.
    // The tracker keeps retrying internally; only location_denied and
    // location_unavailable end the session.
  }
},
```

This is the only required code change inside `NavigationScreen.js`'s existing logic. Everything else in that file already matches the service contract correctly — do not touch `resolveRoute`, `startLiveNavigation`, `handleArrival`, or the triple-tap recording flow.

---

## STEP 5 — Confirm there is no `expo-audio` import anywhere

`NavigationScreen.js` as currently written imports from `expo-audio`:

```js
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
```

This package is **not** in `package.json` — only `expo-av` (`~16.0.8`) is installed. This is a separate, pre-existing bug unrelated to the navigation logic you're wiring, but it will block this screen from running at all until fixed.

Fix it by switching to the equivalent `expo-av` API:

```js
import { Audio } from 'expo-av';
```

Replace the recorder usage (`useAudioRecorder`, `recorder.prepareToRecordAsync()`, `recorder.record()`, `recorder.stop()`, `recorder.uri`, `AudioModule.setAudioModeAsync`) with `expo-av`'s `Audio.Recording` class and `Audio.setAudioModeAsync` — this is the same pattern already used elsewhere in this codebase (see how recording works in `HomeScreen.js`'s `startListening()`/`stopListening()` for the existing convention to match). Use that as your reference implementation for API shape — don't invent a different recording pattern.

**Known related bug to watch for:** there's a documented audio-quality regression in this app traced to `setAudioModeAsync()` not resetting to playback-safe defaults after recording stops on Android, which causes rough/muddy TTS afterward. When you implement the stop-recording path here, explicitly reset the audio mode to playback defaults (`allowsRecordingIOS: false`, standard playback category) after `recording.stopAndUnloadAsync()` — mirror whatever fix pattern already exists elsewhere in the codebase for this issue, if one exists. Flag it if you can't find one rather than guessing at the fix.

---

## STEP 6 — Visual/UI conformance (apply existing design system, do not invent new components)

`NavigationScreen.js` already uses the established pattern correctly:

```js
const { hapticEnabled, speechRate, theme: themeMode } = useSettings();
const theme = getTheme(themeMode);
const shadows = getShadows(theme);
const styles = useMemo(() => createStyles(theme, shadows), [theme, shadows]);
```

Keep this pattern exactly as-is. Do not introduce a raw `COLORS` or `SHADOWS` constant anywhere — that pattern is a known crash source elsewhere in this codebase (`App.js` previously imported a nonexistent `SHADOWS` constant instead of calling `getShadows(theme)` — don't repeat that mistake here).

If you add any new UI element as part of wiring (for example, a status text for `gps_lost` state), it must:
- Use `theme.semantic.danger` / `theme.semantic.success` / `theme.semantic.accent` / `theme.semantic.neutral` for any color-coded meaning — never a raw hex value
- Use `shadows.neo` or `shadows.neoSm` for any new bordered/card element, matching the 4px-border neo-brutalist style already present in this file (`statusBox`, `cancelBtn`, etc.)
- Use `SpaceMono_*` or `Anybody_*` font families already referenced in this file's `createStyles()` — don't introduce a new font
- Meet the 60px minimum touch target and full `accessible`/`accessibilityLabel`/`accessibilityHint` coverage already established on `cancelBtn` and the root `Pressable` — match that same level of coverage on anything new
- Never convey the `gps_lost` vs `location_denied` vs normal states through color alone — pair with the spoken message (already true via Step 4) and, where visually distinguishable, a badge icon change (the file already has a `badgeIcon`/`badgeColor` pattern driven by `status` — extend that same pattern for a `gps_lost` indicator if you add one, rather than building a separate indicator system)

**Do not add:** progress bars with percentage estimates, distance-remaining countdown animations, map zoom controls, or any other navigation-app-style chrome not already present in this file. The existing `NavigationMap` component and live step-progress text (`liveProgressText`) are sufficient for the demo. If `NavigationMap` needs new props to render the live route polyline from `RouteStep.coordinates`, that's in scope — passing the resolved `activeRoute` through is already wired, just confirm `NavigationMap` actually consumes `routeData.steps[].coordinates` for drawing the path, and flag it if it doesn't rather than silently leaving the map blank.

---

## STEP 7 — Test checklist before calling this done

Walk through these manually (or have Antigravity simulate via mocked GPS coordinates if device testing isn't available):

1. Triple-tap on the Navigation screen with no destination spoken yet → mic should start, haptic `start` fires, status reads "Listening…"
2. Speak a destination → triple-tap again to stop → status moves through "Processing…" → "Finding route…" → "Navigating"
3. Deny location permission (or test on a simulator with location services off) → confirm `location_denied` path speaks the message and returns to idle, not a silent hang
4. Force a GPS-unavailable state if possible (e.g. airplane mode mid-route) → confirm `gps_lost` speaks its message and **does not** kill the active route — navigation should resume speaking turn cues once GPS returns
5. Confirm `navigationTurn` / `navigationArrived` haptics actually fire on a real device (simulators don't vibrate) — this can't be verified in an emulator, flag it as "needs physical device test" if you can't confirm it
6. Confirm cancel button still works mid-navigation and returns cleanly to idle

If any of these fail, fix only what's needed to pass that specific check — do not use a failed test as justification to refactor unrelated parts of the screen.

---

## OUT OF SCOPE — explicitly do not do these

- Do not touch `CameraScreen.js`, `HomeScreen.js`, `MemoryScreen.js`, `LearnScreen.js`, or `SettingsScreen.js` as part of this task
- Do not add AsyncStorage persistence for navigation history/favorites — not requested
- Do not add a "recent destinations" list — not requested
- Do not change the triple-tap gesture to a button — not requested, the existing interaction pattern is intentional for this screen's hands-free design
- Do not add Google Maps anything, ever, on this screen
