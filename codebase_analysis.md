# VisionVoice — Codebase Analysis

## 🏗️ App Overview

**VisionVoice** is an AI-powered accessibility assistant built with **React Native + Expo** for **blind and visually impaired users**. It combines:
- 🎙️ Voice → AI chat (speech recognition + LLM response read aloud)
- 📷 Camera → AI vision (scene, text OCR, object/currency ID, clothing)
- 📳 Haptic feedback patterns (distinct rhythms for different events)

All AI is 100% free-tier:
- **STT**: Groq Whisper large-v3
- **Chat**: Groq Llama 3.3 70B
- **Vision**: OpenRouter meta-llama/llama-3.2-11b-vision-instruct

---

## 📁 File-by-File Breakdown

### Root

#### [`App.js`](file:///d:/UMNAAG/app/VisionVoice/App.js)
The entry point. Sets up:
- `SafeAreaProvider` wrapper
- `NavigationContainer` with `createBottomTabNavigator`
- 3 tabs: **Assistant** (HomeScreen), **Camera** (CameraScreen), **Settings** (SettingsScreen)
- Dark theme (`#0A0A0A` background) with emoji icons for tabs
- Accessibility labels on all tab buttons

#### [`index.js`](file:///d:/UMNAAG/app/VisionVoice/index.js)
Standard Expo entry registration — imports `App.js` via `expo/AppEntry`.

#### [`app.json`](file:///d:/UMNAAG/app/VisionVoice/app.json)
Expo config: app name, slug, version, icon paths, and splash screen config.

#### [`package.json`](file:///d:/UMNAAG/app/VisionVoice/package.json)
Key dependencies:
| Package | Role |
|---|---|
| `expo` ~54 | Framework |
| `expo-av` | Audio recording |
| `expo-camera` ~17 | Camera access |
| `expo-speech` | TTS playback |
| `expo-haptics` | Haptic feedback |
| `expo-file-system` | (available but unused currently) |
| `@react-navigation/bottom-tabs` | Tab navigation |
| `react-native-safe-area-context` | Safe area insets |

---

### 📱 `screens/`

#### [`HomeScreen.js`](file:///d:/UMNAAG/app/VisionVoice/screens/HomeScreen.js) — **The AI Voice Assistant**
**Purpose**: Voice-to-AI chat interface — the primary screen.

**State:**
- `isListening` — recording in progress
- `isProcessing` — waiting for AI response
- `messages[]` — displayed conversation bubbles
- `statusText` — mic button label
- `conversationRef` — full OpenAI-format message history (multi-turn context)
- `recordingRef` — active `Audio.Recording` instance

**Flow:**
1. User taps mic → `startListening()` → `Audio.Recording.createAsync()` → haptic `start`
2. User taps again → `stopListening()` → haptic `stop`
3. `transcribeAudio(uri)` → Groq Whisper STT
4. Adds user message to conversation + UI bubbles
5. `chat(messages)` → Groq Llama 3.3 70B
6. Speaks reply with `expo-speech`, haptic `response`

**UI:** Chat bubble list (user right-aligned, assistant left with blue left border), large mic button at bottom (color/border changes per state: blue idle, red recording, green processing).

**Accessibility:** Full `accessibilityLabel`, `accessibilityHint`, `accessibilityRole` on all interactive elements. Auto-announces greeting on mount.

**Limitations (gaps):**
- Speech rate not wired to Settings — always fixed at 0.9
- Haptic setting from Settings not respected
- No persistence (conversation lost on reload)
- No silence detection / auto-stop

---

#### [`CameraScreen.js`](file:///d:/UMNAAG/app/VisionVoice/screens/CameraScreen.js) — **The AI Vision Screen**
**Purpose**: Point camera → tap → get AI description spoken aloud.

**Modes array** (easily extendable):
| Key | Label | AI Function |
|---|---|---|
| `describe` | 👁️ Scene | `describeScene()` |
| `read` | 📄 Text | `readTextFromImage()` |
| `identify` | 📦 Object | `identifyObject()` |
| `currency` | 💵 Money | `identifyCurrency()` |

**Flow:**
1. Mode selected (tap pills or cycle button)
2. Tap large capture button → `takePictureAsync({ base64: true })`
3. Calls relevant AI vision function with base64 image
4. Speaks result + haptic `response`
5. Result box shown — tap to replay speech

**UI:** Full-screen camera preview, mode pill selector (horizontal scroll), result card at bottom, large capture button.

**Limitations (gaps):**
- No front camera / selfie mode
- `describeClothing()` defined in `ai.js` but **not included** in MODES
- No flash control
- Camera always stays active (battery drain)

---

#### [`SettingsScreen.js`](file:///d:/UMNAAG/app/VisionVoice/screens/SettingsScreen.js) — **Settings & Configuration**
**Purpose**: Haptic and speech configuration panel.

**State:**
- `hapticEnabled` (Switch) — controls whether test patterns play
- `speechRate` — selected from 4 presets (0.7 / 0.9 / 1.2 / 1.5)

**Features:**
- Enable/disable haptics toggle
- List of ALL haptic patterns with test buttons (plays haptic + announces description)
- Speech speed selector (4 preset buttons)
- "Test Speech" button — plays pangram sentence
- About section (app version/name)

**Critical Gap**: `speechRate` and `hapticEnabled` state are **local to this screen**. HomeScreen and CameraScreen have no access to these settings — they're essentially display-only preferences that don't propagate.

---

### ⚙️ `services/`

#### [`services/ai.js`](file:///d:/UMNAAG/app/VisionVoice/services/ai.js) — **All AI API Calls**
Central AI module. Clean, well-structured.

**Config:**
- `GROQ_KEY` / `OPENROUTER_KEY` from `EXPO_PUBLIC_*` env vars
- `MODELS` object — easy to swap models in one place
- `SYSTEM_PROMPT` — tuned for blind users (short responses, directional language)

**`apiFetch(url, options, retries=2)`** — shared helper:
- Handles `429` rate limiting with `retry-after` header
- Exponential backoff on other errors
- Up to 3 total attempts

**Exported functions:**
| Function | API | Model | Max Tokens |
|---|---|---|---|
| `transcribeAudio(uri)` | Groq | whisper-large-v3 | — |
| `chat(messages)` | Groq | llama-3.3-70b-versatile | 300 |
| `describeScene(base64)` | OpenRouter | llama-3.2-11b-vision | 450 |
| `readTextFromImage(base64)` | OpenRouter | llama-3.2-11b-vision | 450 |
| `identifyObject(base64)` | OpenRouter | llama-3.2-11b-vision | 450 |
| `identifyCurrency(base64)` | OpenRouter | llama-3.2-11b-vision | 450 |
| `describeClothing(base64)` | OpenRouter | llama-3.2-11b-vision | 450 |

> ⚠️ `describeClothing` is defined but **never called** — not wired to CameraScreen MODES.

---

#### [`services/haptics.js`](file:///d:/UMNAAG/app/VisionVoice/services/haptics.js) — **Haptic Pattern Library**
A well-designed, semantic haptic vocabulary for non-visual feedback.

**Patterns:**
| Key | Pattern | Use Case |
|---|---|---|
| `start` | 1× Medium | Recording started |
| `stop` | 2× Light (100ms gap) | Recording stopped |
| `response` | Success notification | AI replied |
| `error` | Error notification | Something failed |
| `message` | Light-Medium-Light wave | New message |
| `warning` | 3× Heavy (180ms gap) | Pay attention |
| `navigationTurn` | Light → delay → Heavy | Turn ahead |
| `navigationArrived` | L→M→H ascending | Arrived |
| `sos` | Morse SOS (···−−−···) | Emergency |
| `hazard` | 3× double-Heavy bursts | Immediate danger |

**`playHapticPattern(key)`** — exported utility, graceful fallback to `selectionAsync` for unknown keys.

---

## 🔴 Current Gaps & Issues

| Issue | Impact |
|---|---|
| Settings not shared globally (no Context/AsyncStorage) | High — speech rate/haptics don't work cross-screen |
| `describeClothing` not wired up | Medium — feature exists in ai.js, missing from CameraScreen |
| No silence/auto-stop for recording | Medium — user must manually stop |
| Speech rate hardcoded in HomeScreen (`rate: 0.9`) | High |
| No conversation persistence | Medium — reloading clears history |
| Camera stays on even when screen not focused | Low — battery drain |

---

## 💡 Unique Feature Ideas

### 🆕 High Impact
1. **SOS / Emergency Mode** — Long-press home button → SOS haptic + auto-call/message feature using expo-sms or expo-linking
2. **Global Settings Context** — Share speechRate + hapticEnabled across all screens via React Context + AsyncStorage persistence
3. **Auto-stop Recording** — Silence detection using audio metering (stop after 2s of silence)
4. **Clothing Mode** — Wire up the existing `describeClothing()` to CameraScreen as a 5th mode
5. **Live Audio Description** — Continuous camera + periodic scene narration every few seconds
6. **Offline Fallback** — Detect no internet → switch to on-device TTS-only mode with helpful message

### 🎨 UX Enhancements
7. **Animated Waveform** — Visualize audio recording with a live waveform animation
8. **Conversation History** — AsyncStorage-based persistent chat logs
9. **Gesture Navigation** — Swipe left/right on HomeScreen to switch modes (no button needed)
10. **Battery & Speed Info** — Read device status (battery %, time) aloud on demand

### 🌐 Advanced
11. **Multi-language STT** — Add language selector in Settings, pass `language` param to Whisper
12. **Navigation Assistant Mode** — GPS location + describe surroundings combo
13. **Contacts Reader** — Read contacts out loud, compose voice messages
14. **Barcode/QR Scanner** — Add a barcode mode to CameraScreen using expo-barcode-scanner
