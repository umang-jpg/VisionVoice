# BLINDVISION (VisionVoice) — Product Requirements Document

**Version:** 1.0 — Hackathon MVP  
**Last Updated:** June 2026  
**Classification:** Agent Context Document — Full Codebase + Feature Spec  

---

## 1. PROJECT IDENTITY

### 1.1 What This Is

BLINDVISION, branded as **VisionVoice**, is a mobile-first AI-powered sensory extension for blind and visually impaired users. It is not a navigation app. It is not a screen reader. It is a second pair of eyes — a system that watches, remembers, interprets, and acts so that blind users can live independently.

The core thesis drawn from 150+ peer-reviewed papers:

> Every other app tells a blind user what it sees. BLINDVISION tells them what is happening, what matters, what changed, and what to do next.

### 1.2 Target Users

Primary: Fully blind individuals who navigate daily life using touch and hearing exclusively.  
Secondary: Low-vision individuals who have limited but non-zero sight and benefit from high-contrast UI plus audio/haptic augmentation.

### 1.3 Hackathon Context

This is a hackathon prototype. Production-level error handling, test coverage, and performance optimization are explicitly out of scope. The goal is a working, impressive demo that shows judges features they have never seen in any assistive technology product. Three features should be demo-perfect. The rest should be functional.

### 1.4 Demo Pitch

> "We didn't build an app for blind people. We built a sensory system. Every other app gives you labels — a chair, a door, a bus. BLINDVISION gives you situations. The bus is yours, it is 30 seconds away, someone is addressing you about it, the step gap is 20 centimetres, your pasta is done, and someone has been behind you for four turns."

---

## 2. HARD CONSTRAINTS — READ FIRST

Every agent working on this codebase must respect these constraints. They are non-negotiable.

### 2.1 Platform Constraints

- **Mobile ONLY.** This app will never run as a web app, desktop app, or browser extension. All features must be designed for a physical smartphone held in hand or placed in a chest pocket.
- **Expo SDK 54.** This is locked and cannot be changed. Do not upgrade expo, do not suggest upgrading expo, do not use any package that requires a higher SDK. The specific version in package.json is the authority.
- **Expo Go Compatible.** The app must run in Expo Go for demo purposes. No bare workflow, no EAS build, no native modules that require a custom development client unless absolutely necessary and pre-approved.
- **Portrait orientation only.** Locked in app.json. Do not add landscape support.

### 2.2 API Constraints

- **Groq API** for all voice/chat AI. Endpoint: `https://api.groq.com/openai/v1`. Free tier.
- **OpenRouter API** for all vision AI. Endpoint: `https://openrouter.ai/api/v1`. Free tier.
- **No OpenAI.** No Anthropic API. No Google AI. No Azure. Free tier only.
- **Vision Model:** `meta-llama/llama-3.2-11b-vision-instruct` on OpenRouter. This is the locked model for all camera-based features.
- **Chat Model:** `llama-3.3-70b-versatile` on Groq. Locked for all conversation features.
- **STT Model:** `whisper-large-v3` on Groq. Locked for all voice transcription.
- **API Keys** are stored in `.env` file as `EXPO_PUBLIC_GROQ_API_KEY` and `EXPO_PUBLIC_OPENROUTER_API_KEY`. They are already configured and working. Do not touch key management.

### 2.3 Dependency Constraints

Do not add new npm packages without explicit instruction. All required capabilities already exist in the installed dependencies. If a feature seems to require a new package, find a way to implement it with what exists.

Currently installed and available:
- `expo-camera` — camera access and photo capture
- `expo-av` — audio recording and playback
- `expo-haptics` — haptic feedback patterns
- `expo-speech` — text-to-speech output
- `expo-file-system` — file reading and writing
- `expo-sensors` — accelerometer, gyroscope (available via expo SDK, may need import verification)
- `react-native-safe-area-context` — safe area insets
- `react-native-screens` — navigation screens
- `@react-navigation/native` and `@react-navigation/bottom-tabs` — tab navigation

### 2.4 Design Constraints

- **Dark theme only.** Background `#0A0A0A`. No light mode, no theme toggle.
- **Accessibility first.** Every interactive element must have `accessible={true}`, `accessibilityLabel`, and `accessibilityHint` props.
- **Large touch targets.** Minimum 60px height for any tappable element. Blind users navigate by touch.
- **No small text.** Minimum font size 16px for body, 18px preferred. Labels minimum 13px.
- **No visual-only information.** Every piece of information conveyed by color or icon must also be conveyed by audio or haptic.
- **Three Things Rule.** Every AI response must be capped at three prioritized statements. Never output walls of text. Research proved this is the optimal cognitive load for blind users.

---

## 3. COLOR SYSTEM — SEMANTIC NOT DECORATIVE

Colors in this app are a functional accessibility system, not decoration. Each color maps to a meaning that is reinforced by haptic and audio simultaneously.

| Color | Hex | Semantic Meaning | Haptic Pair | Audio Tone |
|---|---|---|---|---|
| Indigo | `#5f0a87` | Neutral / Ready / Default | Single soft pulse | Calm |
| Champagne Mist | `#f5e2c8` | Interactive / Active / Selected / Highlight | — | — |
| Spicy Paprika | `#ec4e20` | Recording / Alert / Danger | Long strong buzz / Continuous | Urgent / Alarm |
| Forest Green | `#248232` | Processing / Safe / Success | Triple light pulse | Positive / Chime |
| Pure Black | `#0A0A0A` | Background | — | — |
| Dark Grey | `#1A1A1A` | Card / Container | — | — |
| Mid Grey | `#333333` | Border / Divider | — | — |
| Dim Grey | `#555555` | Inactive / Hint | — | — |
| White | `#FFFFFF` | Primary text | — | — |
| Muted White | `#888888` | Secondary text | — | — |

---

## 4. CURRENT CODEBASE — FILE BY FILE

### 4.1 Project Root Structure

```
VisionVoice/
├── App.js                    ← Navigation root, tab configuration
├── app.json                  ← Expo configuration, permissions
├── package.json              ← Dependencies (Expo SDK 54)
├── babel.config.js           ← Babel preset expo
├── index.js                  ← Expo entry point (registerRootComponent)
├── .env                      ← API keys (EXPO_PUBLIC_GROQ_API_KEY, EXPO_PUBLIC_OPENROUTER_API_KEY)
├── screens/
│   ├── HomeScreen.js         ← Voice AI assistant (Tab 1)
│   ├── CameraScreen.js       ← Vision features (Tab 2)
│   └── SettingsScreen.js     ← Haptics tester + speech speed (Tab 3)
└── services/
    ├── ai.js                 ← All API calls (Groq + OpenRouter)
    └── haptics.js            ← Haptic pattern library
```

### 4.2 App.js — Navigation Root

**Purpose:** Root component. Wraps everything in SafeAreaProvider and NavigationContainer. Defines the three-tab navigator.

**Current tabs:**
- Tab 1: `Assistant` → renders `HomeScreen` → title `VisionVoice`
- Tab 2: `Camera` → renders `CameraScreen` → title `Camera`
- Tab 3: `Settings` → renders `SettingsScreen` → title `Settings`

**Tab bar configuration:**
- Background: `#0A0A0A`
- Border top: `#1A1A1A`
- Height: 80px, paddingBottom: 10
- Active tint: `#f5e2c8`
- Inactive tint: `#555`
- Icons: emoji-based via `TabIcon` component, size 26px focused / 22px unfocused
- All tabs have `tabBarAccessibilityLabel`

**StatusBar:** style `light`, backgroundColor `#0A0A0A`

**Key import:** `SafeAreaProvider` from `react-native-safe-area-context` wraps everything.

**Known limitation:** Tab-based navigation is not ideal for blind users. Voice navigation across screens is planned as a feature layer on top of this existing structure.

### 4.3 screens/HomeScreen.js — Voice AI Assistant

**Purpose:** Primary interaction screen. User taps microphone button, speaks, gets AI response spoken back. Maintains conversation history.

**State:**
- `isListening` (boolean) — microphone is actively recording
- `isProcessing` (boolean) — API calls in flight
- `messages` (array) — UI conversation history `[{role, text}]`
- `statusText` (string) — current status displayed below mic button

**Refs:**
- `recordingRef` — holds active `Audio.Recording` instance
- `conversationRef` — full conversation array for API context (separate from UI messages)
- `scrollRef` — ScrollView ref for auto-scroll to bottom

**Flow:**
1. User taps mic button → `startListening()` → creates `Audio.Recording` with HIGH_QUALITY preset → sets `allowsRecordingIOS: true`, `playsInSilentModeIOS: true`
2. User taps again → `stopListening()` → stops recording → gets URI
3. URI sent to `transcribeAudio(uri)` in `services/ai.js` → returns text
4. Text appended to `conversationRef.current` and UI messages
5. Full conversation sent to `chat(messages)` → returns AI reply
6. Reply appended to conversation and messages → spoken via `Speech.speak()`
7. `playHapticPattern('response')` fires on success

**Greeting:** On mount, speaks "Welcome to VisionVoice. Tap the large button at the bottom to talk to me." after 600ms delay.

**Clear conversation:** Button appears when messages exist. Clears both `conversationRef.current` and `messages` state.

**Mic button visual states:**
- Default: Indigo (`#5f0a87`) / Champagne Mist (`#f5e2c8`) / Forest Green (`#248232`) gradient background fog, `mic` icon, "Ready"
- Listening: Spicy Paprika (`#ec4e20`) / Champagne Mist (`#f5e2c8`) / Indigo (`#5f0a87`) gradient background fog, `mic` icon highlighted in Champagne Mist (`#f5e2c8`), "Listening…"
- Processing: Forest Green (`#248232`) / Champagne Mist (`#f5e2c8`) / Indigo (`#5f0a87`) gradient background fog, ActivityIndicator, "Thinking…"

**Accessibility:** Mic button has full `accessibilityLabel`, `accessibilityHint`, `accessibilityRole="button"`. Conversation messages have per-bubble accessibility labels.

### 4.4 screens/CameraScreen.js — Vision Features

**Purpose:** Camera-based scene analysis. Four modes currently: Scene Description, Text Reading, Object Identification, Currency Detection.

**State:**
- `permission` — camera permission object
- `modeIndex` (number) — which of the four MODES is active
- `isAnalyzing` (boolean) — vision API call in flight
- `result` (string) — last analysis result

**Refs:**
- `cameraRef` — CameraView ref for taking pictures

**MODES array:**
```javascript
[
  { key: 'describe',  label: '👁️ Scene',    hint: '...',  fn: describeScene },
  { key: 'read',      label: '📄 Text',      hint: '...',  fn: readTextFromImage },
  { key: 'identify',  label: '📦 Object',    hint: '...',  fn: identifyObject },
  { key: 'currency',  label: '💵 Money',     hint: '...',  fn: identifyCurrency },
]
```

**Capture flow:**
1. User taps capture button → `analyze()`
2. `cameraRef.current.takePictureAsync({ base64: true, quality: 0.75, skipProcessing: true })`
3. `photo.base64` sent to current mode's function from `services/ai.js`
4. Result set to state → spoken via `Speech.speak()` → haptic fires
5. Result displayed in tappable result box (tap to replay)

**Mode selection:** Horizontal ScrollView with mode buttons. Active mode highlighted with `#5f0a87` background and `#f5e2c8` border. Also has `cycleMode()` function for gesture-based cycling.

**Permission handling:** If no permission, shows permission request screen with large grant button.

**Greeting:** On mount, speaks "Camera screen. Swipe through modes then tap the large button to analyze."

### 4.5 screens/SettingsScreen.js — Settings

**Purpose:** Haptic pattern testing, speech rate configuration, app information.

**State:**
- `hapticEnabled` (boolean) — whether haptics fire
- `speechRate` (number) — current speech rate (0.7, 0.9, 1.2, 1.5)

**Sections:**
1. Haptic Feedback — enable/disable Switch + test buttons for all 10 haptic patterns from `HAPTIC_PATTERNS`
2. Speech Speed — four rate buttons (Slow, Normal, Fast, Very Fast)
3. Test Speech — plays sample sentence at current rate
4. About — app version and description

**SPEECH_RATES:**
```javascript
[
  { label: 'Slow', value: 0.7 },
  { label: 'Normal', value: 0.9 },
  { label: 'Fast', value: 1.2 },
  { label: 'Very Fast', value: 1.5 },
]
```

**Known gap:** Speech rate and haptic enabled settings are not persisted to AsyncStorage. Each app restart resets them. This should be fixed.

### 4.6 services/ai.js — All AI Calls

**Purpose:** Centralized API service. All Groq and OpenRouter calls. No AI calls happen outside this file.

**Environment variables read:**
```javascript
const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const OPENROUTER_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
```

**Models:**
```javascript
const MODELS = {
  chat: 'llama-3.3-70b-versatile',
  stt: 'whisper-large-v3',
  vision: 'meta-llama/llama-3.2-11b-vision-instruct',
};
```

**Base URLs:**
```javascript
const GROQ_BASE = 'https://api.groq.com/openai/v1';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
```

**System Prompt (current):**
```
You are BlindVision, an AI assistant built exclusively for blind and visually impaired users.

Rules:
- Keep responses SHORT (1-3 sentences) unless the user explicitly asks for more detail
- Use clear directional language: left, right, front, behind, above, below
- Be warm but efficient — users hear your words aloud, so every extra word costs time
- Confirm before irreversible actions
- If unclear, ask ONE simple question
- You help with: navigation, reading, identifying objects, answering questions, composing messages, general tasks
```

**Exported functions:**

`transcribeAudio(uri)` — Groq Whisper. FormData with file, model, language=en. Returns `data.text` trimmed.

`chat(messages)` — Groq Llama chat. Takes full conversation array. Prepends system prompt. max_tokens=300, temperature=0.7. Returns content string.

`describeScene(imageBase64)` — OpenRouter vision. Prompt asks for environment type, main objects with positions, visible text, people, hazards. Under 80 words.

`readTextFromImage(imageBase64)` — OpenRouter vision. Reads all visible text in natural reading order.

`identifyObject(imageBase64)` — OpenRouter vision. Name, color, size, brand, important details.

`identifyCurrency(imageBase64)` — OpenRouter vision. Country, denomination, currency name.

`describeClothing(imageBase64)` — OpenRouter vision. Garment type, color, pattern, brand. Exported but not yet used in UI.

**`apiFetch(url, options, retries=2)` — shared retry helper:**
- Handles 429 rate limit with `retry-after` header parsing
- Retries up to 2 times with exponential backoff
- Throws on non-ok responses after retries exhausted

**`visionRequest(imageBase64, prompt)` — shared vision call:**
- Used by all four vision functions
- Sends base64 image as `data:image/jpeg;base64,${imageBase64}` URL
- max_tokens=450
- Required headers: `HTTP-Referer: https://visionvoice.app`, `X-Title: VisionVoice`

### 4.7 services/haptics.js — Haptic Pattern Library

**Purpose:** Centralized haptic patterns. 10 named patterns with rhythm-based semantics. Each pattern has label, description, and async play function.

**`HAPTIC_PATTERNS` object — all 10 patterns:**

| Key | Label | Pattern | Use Case |
|---|---|---|---|
| `start` | Listening | Single medium impact | App starts recording |
| `stop` | Stopped | Two quick light impacts 100ms apart | Recording stopped |
| `response` | AI Response | Success notification | AI reply received |
| `error` | Error | Error notification | API failure |
| `message` | New Message | Light-medium-light wave 80ms apart | New message alert |
| `warning` | Warning | Three heavy impacts 180ms apart | Caution needed |
| `navigationTurn` | Turn Ahead | Light then heavy 250ms apart | Navigation turn |
| `navigationArrived` | Arrived | Light-medium-heavy ascending 120ms | Destination reached |
| `sos` | SOS | Morse SOS: S·O·S pattern | Emergency |
| `hazard` | Hazard Detected | Three double heavy pulses 300ms apart | Immediate danger |

**`playHapticPattern(key)` — exported function:**
Looks up pattern by key, calls `pattern.play()`. Falls back to `Haptics.selectionAsync()` for unknown keys. All errors caught and warned (never crashes).

**`delay(ms)` — internal helper:**
Returns `Promise` resolving after ms milliseconds. Used between haptic pulses.

---

## 5. THE COGNITIVE PRIORITY ENGINE — FOUNDATION OF EVERYTHING

This is not a feature. It is the architectural decision that runs under every single AI response in the entire app. Every agent must understand and implement this before implementing any feature.

### 5.1 The Problem

Every existing assistive app outputs flat lists: "chair, table, cup, wet floor sign, door, person." The dangerous item is buried. The user must listen to everything to find the thing that matters.

### 5.2 The Solution

Every AI response — regardless of which feature triggered it — must follow this exact output hierarchy:

```
TIER 1: HAZARD — Immediate safety concern. If none, skip silently.
TIER 2: ORIENTATION — Where am I? What space is this? Which way am I facing?
TIER 3: LANDMARKS — Stable reference points (door, window, counter, exit).
TIER 4: RELATIVE POSITIONS — Object A is left of object B.
TIER 5: DETAIL — Only if user explicitly asked for more.
```

### 5.3 The Three Things Rule

Every response is capped at three statements. Research by Hoogsteen 2022 and Salih 2022 proved this is the optimal cognitive load ceiling. More than three statements increases error rate and decision latency for blind users.

### 5.4 Implementation

This is implemented as a system prompt wrapper applied to every API call. The prompt must include:

```
RESPONSE FORMAT — MANDATORY:
Respond with exactly 3 statements or fewer.
Order them by this priority: (1) hazard first, (2) orientation second, (3) landmark or detail third.
If there is no hazard, start with orientation.
Stop after 3 statements. Do not elaborate. User will ask if they need more.
Never output bullet points or numbered lists. Natural speech sentences only.
```

This wrapper is applied in `services/ai.js` at the system prompt level and cannot be overridden by individual feature prompts.

---

## 6. CORE FEATURES — DETAILED SPECIFICATIONS

### FEATURE 1: Kitchen Guardian

**Score:** 9.5/10  
**Daily Use:** 2-3x daily  
**Research Basis:** Li 2021, Li 2024, Wang 2023, Kim 2022, Huh 2025 — Vid2Coach reduced cooking errors 58.5%  
**Screen:** CameraScreen.js (new mode added to MODES array)  

**What It Is:**
Real-time cooking assistance that tracks task state, not just objects. The distinction from existing apps: instead of "I see a pan and a knife", it says "the onions are 60% caramelized, need 2 more minutes, knife blade is facing up on your left."

**Five Sub-Modes (voice-activated within Kitchen mode):**

Sub-mode A — Doneness Judge:
```
Prompt: "Is this food cooked? Answer: (1) whether it is raw, partially cooked, or done, (2) the specific visual evidence, (3) any safety concern if underdone. One sentence each. Maximum 3 sentences."
```

Sub-mode B — Spatial Safety:
```
Prompt: "Describe the positions of any dangerous items (knife, hot pan, open flame, steam) relative to where a blind person's hands might be. Prioritize by danger level. Maximum 3 statements."
```

Sub-mode C — Continuous Danger Watch (polls every 10 seconds):
```
Prompt: "Is there any immediate kitchen danger visible? If yes: describe it in one sentence. If no: say nothing. Only speak when danger exists."
```

Sub-mode D — Cleanliness Check:
```
Prompt: "Is this surface/item clean? Describe: (1) visible residue or contamination, (2) which specific area, (3) whether it is safe to use as-is. Maximum 3 sentences."
```

Sub-mode E — Task State:
```
Prompt: "What cooking stage is visible? Describe: (1) what is currently happening (boiling, browning, melting), (2) estimated progress, (3) what should happen next. Maximum 3 sentences."
```

**Voice Activation:** User says "check doneness" / "am I safe" / "is this clean" / "what's happening" → maps to sub-mode → single camera capture → result spoken.

**Implementation:**
- Add `kitchen` to MODES array in CameraScreen
- Add 5 prompt templates to `services/ai.js`
- Voice command parsing in HomeScreen's chat function recognizes cooking intent

---

### FEATURE 2: Medication Guardian

**Score:** 9.5/10  
**Daily Use:** 2-3x daily  
**Research Basis:** Complete research gap. Turkstra 2023 documents need. No consumer solution exists.  
**Screen:** CameraScreen.js (new mode) + HomeScreen.js (interaction check via chat)  

**Three Sub-Features:**

Sub-feature A — Identify Any Medication:
```
Prompt: "Identify this medication. State: (1) medication name and strength/dosage, (2) how to take it (timing, with/without food), (3) expiry date if visible. If you cannot identify it clearly, say so explicitly. Maximum 3 sentences."
```

Sub-feature B — Drug Interaction Check:
Session state stores medications taken today. Before reading a new medication, system prompt includes today's list:
```
System context: "User has taken these medications today: [LIST]. Check the scanned medication for interactions with this list. If dangerous interaction exists, state it first and urgently. If safe, confirm safety."
```

Sub-feature C — Expiry Scanner:
```
Prompt: "Find and read only the expiry/best before date on this item. State: (1) the exact date, (2) whether it is expired or how many days until expiry, (3) any storage condition visible. Maximum 3 sentences."
```

**Medication log:** Stored in component state during session. User says "I just took [medication]" → chat function parses and adds to log → persisted to AsyncStorage for cross-session tracking.

**Haptic for danger:** Drug interaction warning fires `playHapticPattern('warning')` before speaking.

---

### FEATURE 3: Wardrobe Intelligence

**Score:** 9/10  
**Daily Use:** Every morning  
**Research Basis:** Aghazadeh 2021 documents blind users using physical marking systems. Complete gap for AI solution.  
**Screen:** CameraScreen.js (new mode)  

**Four Sub-Modes:**

Describe garment:
```
Prompt: "Describe this clothing item for a blind person choosing an outfit. State: (1) garment type and cut, (2) main color and any pattern, (3) any visible stains, damage, or issues. Maximum 3 sentences."
```

Color match check (two items held up together):
```
Prompt: "Do these two clothing items match? State: (1) yes or no clearly, (2) why they work or clash (color theory in plain language), (3) what alternative pairing might work if they clash. Maximum 3 sentences."
```

Stain detection:
```
Prompt: "Inspect this item for stains or damage. State: (1) whether stains or damage are visible, (2) exactly where on the item they are, (3) severity (faint/moderate/prominent). If clean, say so in one sentence."
```

Occasion check (user speaks context first):
```
Prompt: "This outfit will be worn to: [USER_CONTEXT]. State: (1) whether it is appropriate for that setting, (2) the strongest element of the outfit, (3) one specific improvement if needed. Maximum 3 sentences."
```

---

### FEATURE 4: Affective Soundscape "Vibe" Reader

**Score:** 9/10  
**Daily Use:** Every time entering a new space  
**Research Basis:** Hou 2024 — affective soundscape captioning matching human expert quality. Ghosh 2024.  
**Screen:** HomeScreen.js (new button) or dedicated gesture  

**What It Does:**
Records 5 seconds of ambient audio before entering any space. Returns emotional and social temperature of the environment — not a list of sounds, but an interpretation of what kind of space it is and what it requires socially.

**Implementation:**
1. User holds phone toward space and taps "Vibe" button (or shakes phone)
2. `Audio.Recording` captures 5 seconds at standard quality
3. Groq Whisper transcribes — captures not just speech but describes ambient sounds
4. Groq Llama receives transcription + this prompt:
```
Prompt: "Based on this audio description, interpret the social and emotional atmosphere of the space. State: (1) emotional tone (calm/tense/loud/celebratory/aggressive), (2) social density and activity level, (3) whether it is safe and appropriate to enter and what to expect. Maximum 3 sentences. Be direct — user is about to enter this space."
```

**Haptic:** Single soft pulse when analysis starts. `response` pattern when result ready.

**Output examples:**
- "Tense atmosphere. At least three overlapping voices at elevated pitch. Exercise caution entering — high conflict energy present."
- "Calm café setting. Light background music, low conversation. Relaxed and easy to navigate."
- "Loud celebration in progress. High energy, frequent movement. Expect crowded paths — announce yourself before moving."

---

### FEATURE 5: Social Turn-Taking Decoder

**Score:** 9/10  
**Daily Use:** Every group conversation  
**Research Basis:** Chemnad 2024, Xie 2025 — complete research gap, zero consumer solutions  
**Screen:** HomeScreen.js (Social Mode — new activation)  

**What It Does:**
Runs in social mode during conversations. Tells the user when they are being addressed, when it is appropriate to speak, and when to wait.

**Three Parallel Signals:**

Signal A — Ambient speech monitoring via Whisper (continuous 3-second chunks):
Looks for: second-person pronouns directed at singular listener, question forms, name mentions, direct address patterns.

Signal B — Camera snapshot every 3 seconds in social mode:
```
Prompt: "Is anyone in this image directing attention toward the camera holder? State: (1) yes or no, (2) if yes, what body language indicates this (eye contact, body orientation, gesture), (3) whether a response is expected. One sentence each."
```

Signal C — Silence detection:
If speech stops and camera indicates attention toward user → notify.

**Notification system:**
- Being addressed: Single haptic pulse + quiet earpiece whisper "You're being asked something"
- Appropriate to speak: Double pulse + "Good moment to respond"  
- Wait: No haptic, quiet whisper "Mid-conversation, wait"

**Activation:** User says "social mode on" to HomeScreen → activates polling loop.

**Privacy note:** No audio is stored. Each 3-second chunk is transcribed and discarded.

---

### FEATURE 6: Prospective Memory Guardian

**Score:** 9/10  
**Daily Use:** Multiple times daily — passive background feature  
**Research Basis:** Turkstra 2023 — clearest documented gap across entire corpus, "near-absent from literature"  
**Screen:** New service + background logic in HomeScreen  

**What It Does:**
Maintains a timestamped world-state log of what the camera has seen. Proactively alerts when things may have changed or when the user should check something.

**Data Structure (AsyncStorage):**
```javascript
{
  "kitchen": {
    "lastScan": "2025-06-20T19:42:00.000Z",
    "objects": [
      { "name": "stove", "state": "off", "position": "back wall" },
      { "name": "kettle", "state": "full", "position": "left counter" },
      { "name": "pill organizer", "state": "visible", "position": "next to kettle" }
    ]
  },
  "bedroom": { ... },
  "front_door": { ... }
}
```

**Proactive triggers:**
- Time-based: If stove/oven was noted in a scan and 3+ hours have passed without re-scan → prompt to check
- Re-entry detection: When user re-enters a room (motion + camera context), compare new scan to stored state → flag changes
- Morning brief: On first app open of the day, summarize state of home from yesterday's scans

**Scan logging:** Every camera capture in any mode triggers a world-state update. The room is auto-identified from the visual context (kitchen items = kitchen, bed = bedroom, etc.).

**Change detection prompt:**
```
"Compare this current scene to the stored state: [STORED_JSON]. List any objects that have moved, disappeared, or changed state. If nothing changed, say nothing. If something changed, describe what and where. Maximum 2 statements."
```

---

### FEATURE 7: "What Was That?" Open-Vocabulary Sound Intelligence

**Score:** 8.5/10  
**Daily Use:** Multiple times daily  
**Research Basis:** Ghosh 2024, Wu 2025, Tang 2024 — audio LLMs, open-vocabulary sound events  
**Screen:** HomeScreen.js (tap anywhere to trigger) or dedicated sound button  

**What It Does:**
User hears an unidentified sound. Taps once anywhere on screen. App records 4 seconds, identifies the sound in open vocabulary (not limited to preset categories), gives location estimate.

**Implementation:**
1. Single tap on any part of HomeScreen → triggers 4-second ambient recording
2. Gyroscope captures phone orientation at time of tap (for directional hint)
3. Whisper transcribes audio including non-speech sounds (it does describe ambient sounds in transcription)
4. Llama receives transcript + orientation data:
```
Prompt: "A blind user just heard an unexpected sound. Based on this audio transcription, identify: (1) what the sound most likely was, (2) estimated distance and direction if inferable, (3) whether it requires any action or attention. Maximum 3 sentences. Be specific and confident."
```

**Gyroscope integration:** Phone orientation (facing direction) added to prompt context. "Phone was facing approximately North-West at time of capture" helps LLM give relative directional output.

**Output examples:**
- "Car door slamming. Approximately 20 feet away, outside the building. No action needed."
- "Glass breaking. To your left, approximately 15 feet. Proceed carefully in that direction."
- "Phone ringtone, not yours. Coming from your right, approximately 10 feet. Someone nearby has a call."

---

### FEATURE 8: Safe Corridor + Haptic Hazard Grade System

**Score:** 8.5/10  
**Daily Use:** Every outdoor walk, every indoor navigation  
**Research Basis:** Paper 18 — tactile feedback reduced obstacle hits 66.6%, clearance time 27.35%  
**Screen:** CameraScreen.js (new Corridor mode) + haptics.js (new patterns)  

**What It Does:**
Camera polls at one frame every 2 seconds. Vision model grades hazards on a 4-level system. Haptic pattern fires per grade. Speech only at Grade 3+. Complete silence during clear walking.

**Four Hazard Grades:**

| Grade | Haptic | Audio | Examples |
|---|---|---|---|
| 0 — Clear | None | Silence | Open path |
| 1 — Minor | Soft single pulse | None | Uneven surface, small lip |
| 2 — Caution | Double pulse | Quiet whisper | Wet floor, low obstacle, step down |
| 3 — Warning | Triple pulse + voice | Normal voice | Person blocking, construction |
| 4 — Danger | Continuous buzz | Urgent voice | Moving vehicle, open hazard |

**Grading Prompt:**
```
"Grade the path hazard visible in this image on this scale:
0 = clear path, no hazard
1 = minor surface irregularity only  
2 = caution needed, obstacle manageable
3 = stop or reroute, significant blockage
4 = immediate danger, do not proceed

Respond with ONLY: GRADE:[number] HAZARD:[one sentence description if grade 1+]
If grade 0, respond with only: GRADE:0"
```

**Implementation:**
- `useEffect` loop in CameraScreen when Corridor mode active
- `setInterval` every 2000ms calling `cameraRef.current.takePictureAsync({ quality: 0.3, skipProcessing: true })`
- Parse GRADE from response → trigger haptic + optional speech
- Loop clears on mode change or screen blur

**New haptic patterns needed in haptics.js:**
```javascript
corridorClear: silence (no call)
corridorMinor: single Light impact
corridorCaution: two Medium impacts 150ms apart
corridorWarning: three Heavy impacts 100ms apart
corridorDanger: continuous: Heavy, 80ms, Heavy, 80ms, Heavy loop
```

---

### FEATURE 9: 3D Audio Target Beacon — "Find It For Me"

**Score:** 8.5/10  
**Daily Use:** Daily — misplaced objects are universal  
**Research Basis:** Scalvini 2023, Paré 2021 — 3D spatial audio for target guidance, minimal training needed  
**Screen:** HomeScreen.js (voice trigger) + new audio module  

**What It Does:**
User names an object. Camera identifies and estimates its position in the frame once via Vision API. From that point, a stereo audio beacon guides the user to the object using spatial audio — no more API calls, entirely local.

**Flow:**
1. User says "find my keys" / "find the door" / "find my phone charger"
2. Camera captures once → Vision API locates the object + estimates frame position (left/center/right, near/far)
3. If found: beacon activates. If not found: "Keys not visible. Try pointing the camera around the room."
4. Beacon uses `expo-av` with stereo panning:
   - Left pan value calculated from object's X position in last known frame
   - Pulse rate increases as estimated proximity increases (based on bounding box size)
   - Pitch rises as user approaches
   - Unique "found" sound when object fills center of frame at close range

**Audio parameters:**
```javascript
// Stereo pan: -1.0 (full left) to +1.0 (full right)
// Pulse interval: 1500ms (far) → 200ms (close)
// Pitch: 200Hz (far) → 800Hz (close)
// "Found" tone: 1000Hz chord, 500ms duration
```

**Beacon update:** Camera re-captures every 1.5 seconds to update object position. Audio responds to new position within 100ms. No API call on update — just frame analysis for position estimation using pixel analysis.

---

### FEATURE 10: Public Transport Interpreter

**Score:** 8/10  
**Daily Use:** Daily for any commuter  
**Research Basis:** Madake 2023, Casanova 2025 — near-complete research gap, explicitly named critical unsolved problem  
**Screen:** CameraScreen.js (new Transport mode with 5 sub-modes)  

**Five Transport Microtasks:**

Microtask A — Bus/Vehicle Number:
```
Prompt: "Identify the vehicle number, route number, or destination shown. State: (1) the number or route, (2) the destination if visible, (3) which door to board from if determinable. Maximum 3 sentences."
```

Microtask B — Departure Board:
```
Prompt: "Read this departure board. State: (1) the most imminent departure including platform and time, (2) its current status (on time/delayed), (3) how many minutes until departure. Maximum 3 sentences."
```

Microtask C — Seat Availability:
```
Prompt: "How many empty seats are visible? State: (1) number of empty seats visible, (2) location of nearest empty seat (rows ahead, aisle/window), (3) any accessibility priority seating visible and its status. Maximum 3 sentences."
```

Microtask D — Boarding Safety:
```
Prompt: "Describe the boarding situation. State: (1) distance to the door, (2) whether there is a gap or step and its estimated size, (3) any obstacle between the user and the door. Maximum 3 sentences."
```

Microtask E — Stop Announcement Monitor:
Whisper monitors ambient audio continuously in 3-second windows. Detects stop announcement patterns → speaks them with context and haptic alert.

---

### FEATURE 11: Financial Document Decoder

**Score:** 8/10  
**Daily Use:** Multiple times weekly  
**Research Basis:** Fayyad 2024, Turkstra 2023 — systemic gap, no validated AI tools for blind-specific financial tasks  
**Screen:** CameraScreen.js (new Finance mode)  

**Five Document Types (auto-detected):**

Auto-detection prompt:
```
"Identify the document type: receipt, bill/invoice, ATM screen, contract/legal, or price tag. Respond with only the type name."
```

Then type-specific prompt fires:

Receipt: Name, total, most expensive item, date.
Bill: Amount due, due date, account reference, payment method.
ATM Screen: Current screen state, what button to press, which key does what.
Contract: Document type, parties, key terms, obligations, any urgent clauses.
Price Tag: Price, product name, any deal/offer, nearby alternative if visible.

**Haptic for high amounts:** If bill total exceeds user-set threshold → `warning` haptic fires before speaking.

---

### FEATURE 12: Echolocation Training Game

**Score:** 8/10  
**Daily Use:** Daily practice, 5-10 minutes  
**Research Basis:** Norman 2021, Dodsworth 2020 — both blind and sighted people learn echolocation. Cortical changes measurable after 10 weeks. Loudspeaker clicks outperform mouth clicks.  
**Screen:** New EchoScreen.js or Settings screen section  

**What It Does:**
Teaches users to echolocate by playing calibrated audio clicks through the phone speaker and training the user to interpret returning echoes. Gamified with levels and scoring.

**Four Levels:**

Level 1 — Wall Distance: Phone clicks. User swipes left/right to guess near/far. Camera depth estimate confirms.

Level 2 — Object Count: Three clicks. How many objects are in front? User answers verbally. Vision API confirms.

Level 3 — Open vs Closed: One click. Is this an open space or enclosed room? Answer. Reverb pattern confirms.

Level 4 — Navigation: Walk from door to destination using only click echoes. No speech guidance. Timer tracked.

**Click audio:** 2-4kHz calibrated pulse, 50ms duration, played via `expo-av`. Recording simultaneously captures 0-400ms echo window. Amplitude decay analysed for distance estimate.

**Scoring:** Personal best stored in AsyncStorage per level. Progress graph shown (text-based for accessibility).

---

## 7. SYSTEM PROMPT — FULL SPECIFICATION

Every AI call in the app must use this base system prompt. Individual feature prompts are appended below it.

```
You are BLINDVISION, an AI sensory extension for blind and visually impaired users.

CORE IDENTITY:
- You are not a chatbot. You are a sensory system. Think like a trusted sighted guide.
- Users hear your words aloud. Every extra word costs them time and cognitive load.
- Silence is a valid and preferred response when there is nothing important to say.

MANDATORY RESPONSE FORMAT:
- Maximum 3 sentences per response. Never exceed this.
- Sentence 1: Hazard or safety information (skip if none exist)
- Sentence 2: Orientation or primary finding
- Sentence 3: Landmark, context, or actionable detail
- No bullet points. No numbered lists. Natural spoken sentences only.
- No filler phrases: "Certainly!", "Great question!", "I can help with that!" — never.

LANGUAGE RULES:
- Use directional language always: left, right, ahead, behind, above, below, clockwise
- Give distances in natural units: "2 steps ahead", "arm's length", "across the room"
- State the most dangerous thing first, always
- When uncertain: say so in one word ("possibly", "likely") and continue
- Never say "I see" — say "There is" or just state the fact

EMOTIONAL CALIBRATION:
- Calm and steady during hazards — panic is contagious
- Efficient and warm in daily tasks
- Never over-explain, never under-inform
```

---

## 8. WORLD STATE SERVICE — NEW SERVICE FILE

A new service file is required: `services/worldState.js`

```javascript
// services/worldState.js
// Manages persistent world state for Prospective Memory Guardian

import AsyncStorage from '@react-native-async-storage/async-storage';

const WORLD_STATE_KEY = 'blindvision_world_state';
const SESSION_LOG_KEY = 'blindvision_session_log';

// Load full world state
export async function getWorldState() { ... }

// Update a room's objects after a scan
export async function updateRoomState(roomName, objects) { ... }

// Get last scan time for a room
export async function getLastScanTime(roomName) { ... }

// Get all rooms not scanned in the last N hours
export async function getStaleRooms(hoursThreshold = 3) { ... }

// Compare new scan to stored state — returns array of changes
export async function detectChanges(roomName, newObjects) { ... }

// Log a session event
export async function logEvent(event) { ... }

// Get today's medication log
export async function getMedicationLog() { ... }

// Add medication to today's log
export async function addMedication(medication) { ... }
```

---

## 9. NAVIGATION ARCHITECTURE — PLANNED EXTENSION

Current tab navigation is kept for low-vision users who can see the screen. A voice navigation layer is added on top:

Voice commands recognized in HomeScreen chat:
- "Camera" / "Show camera" / "Take photo" → navigate to Camera tab
- "Settings" → navigate to Settings tab
- "Home" / "Go back" → navigate to Home tab
- "Kitchen mode" → navigate to Camera + activate kitchen sub-mode
- "Find [object]" → activate 3D beacon mode
- "Social mode" / "Listening mode" → activate turn-taking decoder
- "Corridor mode" / "Safe walk" → activate safe corridor mode
- "What was that" → trigger sound identification
- "Emergency" / "SOS" → activate emergency protocol

Navigation via voice uses React Navigation's `navigation.navigate()` called from HomeScreen with a ref passed from App.js.

---

## 10. HAPTIC VOCABULARY — COMPLETE SPECIFICATION

Extended from current 10 patterns to full semantic vocabulary:

| Key | Pattern | Meaning |
|---|---|---|
| `start` | Single medium | Recording started |
| `stop` | Two light, 100ms | Recording stopped |
| `response` | Success notification | AI response ready |
| `error` | Error notification | Something failed |
| `message` | Light-medium-light | New information |
| `warning` | Three heavy, 180ms | Caution needed |
| `navigationTurn` | Light then heavy | Turn coming |
| `navigationArrived` | Ascending triple | Destination reached |
| `sos` | Morse SOS | Emergency |
| `hazard` | Double heavy x3 | Immediate danger |
| `corridorClear` | None | Path clear (silence = safe) |
| `corridorMinor` | Single light | Surface irregularity |
| `corridorCaution` | Double medium | Manageable obstacle |
| `corridorWarning` | Triple heavy | Reroute needed |
| `corridorDanger` | Continuous heavy | Stop immediately |
| `beaconFar` | Single pulse, 1.5s interval | Target far away |
| `beaconNear` | Double pulse, 0.5s interval | Target getting close |
| `beaconFound` | Long success buzz | Target reached |
| `addressed` | Single soft | Someone is talking to you |
| `waitToSpeak` | None | Do not interrupt |
| `medicationWarning` | Three heavy | Drug interaction risk |
| `expiryAlert` | Warning notification | Item expired |

---

## 11. FILE STRUCTURE — TARGET STATE

```
VisionVoice/
├── App.js                         ← Navigation root (minimal changes)
├── app.json                       ← Expo config (add expo-sensors plugin)
├── package.json                   ← Add @react-native-async-storage/async-storage
├── babel.config.js                ← Unchanged
├── index.js                       ← Unchanged
├── .env                           ← API keys (already configured)
│
├── screens/
│   ├── HomeScreen.js              ← Voice AI + sound detection + social mode
│   ├── CameraScreen.js            ← All camera modes (extended)
│   ├── SettingsScreen.js          ← Settings + echo training game
│   └── EchoTrainingScreen.js      ← Optional: dedicated echo game screen
│
├── services/
│   ├── ai.js                      ← All AI calls (extended with new prompts)
│   ├── haptics.js                 ← Extended haptic vocabulary
│   ├── worldState.js              ← NEW: Persistent world state management
│   ├── audioAnalysis.js           ← NEW: Ambient sound processing helpers
│   └── navigation.js             ← NEW: Voice navigation command parser
│
└── constants/
    ├── prompts.js                 ← NEW: All prompt templates centralized
    ├── colors.js                  ← NEW: Color system constants
    └── hapticMap.js               ← NEW: Haptic-to-situation mapping
```

---

## 12. ADDITIONAL FEATURES FROM RESEARCH — BACKLOG

These features are validated by research and worth building if time permits after the core 12. Listed without full spec — agent should request detailed spec before implementing.

**From Sensory Substitution Research (Prompt 1):**
- Live scene sonification: visual frame → stereo audio tones, runs locally, zero API cost
- Reverb Room Reader: plays audio burst, analyses echo to determine room size and type
- Compressed spatial audio navigation: quiet background audio layer encoding nearby space, runs continuously
- Surface texture sonar: identifies floor surface type → plays distinct audio texture per surface
- Phone echolocation mode: calibrated speaker clicks + microphone echo analysis for distance estimation

**From Cognitive Psychology Research (Prompt 2):**
- Survey Map Builder: builds queryable spatial model of frequently visited spaces across sessions
- "First Glance" mode: camera answers "what would a sighted person notice first in 2 seconds?" — priority-ranked output
- Socially actionable image captions: interprets photos received in messaging context (who, mood, what response is expected)

**From Safety Research (Prompt 3):**
- "Am I Being Followed?" tail detection: accelerometer + ambient audio pace correlation, routes to safety, haptic-only alerts
- Biometric Distress Engine: accelerometer variance + voice tone + session silence as combined distress signal
- Dynamic Evacuation Navigator: emergency mode with step counting, haptic metronome, camera-based path hazard polling
- Fall Detection + Auto-Escalation: accelerometer fall signature → 15-second response window → GPS-located SMS if no response

**From Daily Living Research (Prompt 4):**
- Pre/post grocery shopping loop: smart list builder from conversation + pantry state tracking
- "Find It For Me" pantry mode: locate specific item on a cluttered shelf by name
- Grocery product verification: "Is this the right thing?" one-tap product ID confirmation

**From Frontier AI Research (Prompt 5):**
- Distributed Brain Offload Mode: holds multi-step tasks in working memory across time with proactive reminders
- Context carry engine: session context threads across all features (medication + shopping + schedule awareness)

---

## 13. PERFORMANCE REQUIREMENTS

- Voice response latency: Groq Whisper + Llama chain should complete in under 3 seconds on good network
- Vision response latency: OpenRouter vision call should complete in under 5 seconds
- Safe Corridor polling: 2-second interval maximum. If previous call not complete, skip frame
- Haptic response: immediate (< 50ms from trigger)
- Speech response: begins within 200ms of text receipt
- App cold start: under 3 seconds to interactive state

**Rate limit awareness:**
- Groq: 30 req/min chat, 20 req/min Whisper
- Safe Corridor mode at 2s interval = 30 req/min — at the limit. Build request queue with drop-oldest strategy.
- OpenRouter: varies by model — implement retry with exponential backoff (already exists in `apiFetch`)

---

## 14. ACCESSIBILITY REQUIREMENTS

Every screen must satisfy:

1. Every touchable element: `accessible={true}`, `accessibilityLabel` (what it is), `accessibilityHint` (what it does when activated)
2. Every state change: announced via `Speech.speak()` within 200ms
3. Every error: announced AND haptic fired AND visible in UI
4. No purely visual information: color meaning always paired with audio or haptic
5. Focus management: on screen load, first interactive element receives accessibility focus
6. Screen reader compatible: all components work with VoiceOver (iOS) and TalkBack (Android)
7. Minimum touch target: 60px height, 44px width on all interactive elements
8. Text sizes: body 18px minimum, labels 13px minimum, headers 24px minimum

---

## 15. WHAT NOT TO BUILD

Features explicitly excluded from scope:

- GPS turn-by-turn navigation (Google Maps, Apple Maps do this better and for free)
- Social media posting or management
- Email composition or management
- Calendar management
- Any feature requiring a paid API tier
- Any feature requiring native modules outside Expo Go
- Any web interface or dashboard
- Push notifications (requires additional Expo setup outside hackathon scope)
- User accounts or authentication
- Multi-language support (English only for MVP)
- Video recording or processing
- Real-time volunteer connection (Be My Eyes does this — we don't clone it)

---

## 16. DEMO SCRIPT — HACKATHON PRESENTATION

The following sequence demonstrates maximum impact in minimum time for judges:

**Minute 1 — The Pitch:**
State the problem. Show the gap. State the solution in one sentence.

**Minute 2 — Kitchen Guardian:**
Point camera at a kitchen scene. Say "check safety." Show the prioritized response — danger first. Contrast with a generic app that lists objects flatly.

**Minute 3 — Affective Soundscape:**
Walk up to a "room" (even a crowded area in the venue). Tap Vibe. Let the phone listen. Show the emotional and social interpretation. Judges will have never seen a phone interpret the "feel" of a room.

**Minute 4 — Social Turn-Taking:**
Have a helper start a conversation nearby. Activate Social Mode. Show the phone detecting when the judge addresses the user vs when they are talking to someone else. Haptic pulse when addressed.

**Minute 5 — Prospective Memory:**
Show the world state log from a previous scan. Show it detecting that the chair moved from its earlier position. "This is the feature that 50 research papers said nobody had built."

**Close:** "Every other app tells you what it sees. BLINDVISION tells you what is happening, what changed, and what to do. It is not an app. It is a sensory system."

---

*End of PRD — BLINDVISION v1.0 Hackathon MVP*  
*Agent Instructions: Read this entire document before touching any file. The Cognitive Priority Engine in Section 5 is the foundation — implement it before any feature. Every feature prompt must pass through the system prompt in Section 7.*
