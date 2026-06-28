The BlindVision ecosystem:

1)physical skin sensation embedded haptic display based on the principle of micropneumatic technology.
working principle  of our BlindVision headband :
<img width="698" height="597" alt="image" src="https://github.com/user-attachments/assets/53f6853f-28f4-4a72-aec8-d539172c6fea" />


<img width="200" height="400" alt="image" src="https://github.com/user-attachments/assets/2c7ddb70-779b-4d48-85ff-b6ceb9f5922b" />

<img width="200" height="400" alt="image" src="https://github.com/user-attachments/assets/ccbe30f0-83b5-4dc5-8fd9-de53746409e1" />

<img width="200" height="400" alt="image" src="https://github.com/user-attachments/assets/a1a29f46-7c2e-460b-8b74-c80a545a8ec5" />

<img width="200" height="400" alt="image" src="https://github.com/user-attachments/assets/804743b1-a8fb-42d3-8cd9-ff95e26929b9" />
<img width="200" height="400" alt="image" src="https://github.com/user-attachments/assets/992cb307-a95e-4b2b-87d5-bda0c228830a" />













# 👁️ VisionVoice

**An AI-powered, fully voice-controlled accessibility app for blind and low-vision users.**

VisionVoice is a hands-free mobile assistant built for one core idea: most accessibility apps make their *output* accessible — spoken descriptions, audio readouts — but still assume the user can see the screen to operate them. VisionVoice makes the *input* voice-first too. One mic button drives the entire app: switching screens, capturing photos, searching memory, recording notes, exporting Braille, and navigating — all without ever requiring sight to operate.

Built as a hackathon MVP. 100% free-tier AI infrastructure. No paid APIs, no subscriptions, no credit card required to run.

---

## ✨ Core Idea

> Every other app tells a blind user what it sees. VisionVoice is controlled entirely by voice — one button, every screen, zero screen-time required to operate it.

















---

## 🚀 Features

### 🎙️ One-Button, Hands-Free Control
Every screen, every feature, every mode is reachable through a single global mic control. Voice commands route navigation, trigger camera capture, switch modes, search logs, and export files — no need to locate icons, tabs, or menus by touch.

### 🗣️ Conversational AI Assistant
Tap and talk. Transcribed via Groq Whisper, answered via a Groq-hosted LLM, and read back aloud — a natural conversation, not a command-only interface.

### 👁️ Camera Vision Modes
Point the camera and get a short, natural spoken answer — not a list of labels.
- **Scene** — describes what's in front of you in plain spoken sentences
- **Object** — identifies items held up to the camera
- **Text** — reads visible text aloud
- **Money** — identifies currency and denomination directly (e.g. *"A note of 100 Rupees"*)

All vision responses are capped to a short, natural spoken length — built around the principle that blind users need the answer, not an inventory of visual properties.

### 🧭 Voice-Guided Navigation
Triple-tap anywhere on the Navigation screen and speak a destination. Routes are calculated using a fully free, no-API-key routing stack, with live turn-by-turn spoken cues and haptic confirmation at each step — no visual map required to operate it.

### 🧠 Memory Log
Every camera scan is automatically logged with date, time, and content. Ask later — *"What did I see in the kitchen?"* — and VisionVoice searches and reads the match back aloud. Entries can be deleted directly from the log.

### 📚 Learn Screen — Voice Notes & Braille Export
Speak a note, and it's automatically organized and saved. Export any note directly to a Braille-ready (.brf) file and share it — triggerable entirely by voice, no need to locate a tiny share icon by touch.

### 📳 Semantic Haptic & Audio Feedback
Every state change, error, and action is paired with both haptic and spoken feedback — no information in the app is conveyed by color or visual cue alone.

---

## 🛠️ Tech Stack

- **Framework:** React Native + Expo SDK 54 (Expo Go compatible — no EAS build, no custom dev client, no native modules requiring compilation)
- **Navigation:** React Navigation (bottom tabs)
- **Voice/Audio:** `expo-speech` (text-to-speech), `expo-audio` (recording)
- **Camera:** `expo-camera`
- **Haptics:** `expo-haptics`
- **File handling:** `expo-file-system`

### AI Providers (free tier only)
| Purpose | Provider | Model |
|---|---|---|
| Conversational chat | Groq | `openai/gpt-oss-120b` |
| Speech-to-text | Groq | `whisper-large-v3` |
| Lightweight tasks (memory logs, study notes) | Groq | `openai/gpt-oss-20b` |
| Vision (scene/object/text/currency) | OpenRouter | `meta-llama/llama-3.2-11b-vision-instruct` |

No OpenAI. No Anthropic API. No Google AI. No paid tier of anything.

### Navigation / Routing Stack (free, no API key required)
| Step | Service |
|---|---|
| Geocoding | Geoapify → Nominatim (fallback) |
| Route calculation | OpenRouteService → OSRM (fallback) |

No Google Maps API key — none needed, none planned.

---

## 📱 Setup

### Prerequisites
- Node.js installed
- [Expo Go](https://expo.dev/go) installed on a physical Android/iOS device
- Free API keys from [Groq Console](https://console.groq.com) and [OpenRouter](https://openrouter.ai) (no credit card required for either)

### Install

```bash
git clone https://github.com/<your-username>/visionvoice.git
cd visionvoice
npm install
```

### Configure environment variables

Create a `.env` file in the project root:

### Run

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone.

> ⚠️ **Note:** Groq periodically deprecates older free-tier model IDs. If you hit a `400: not a valid model ID` error, check [Groq's deprecations page](https://console.groq.com/docs/deprecations) and update the model strings in `services/ai.js`.

---

## ♿ Accessibility Standards

Every screen in VisionVoice is built against a fixed set of constraints, not as an afterthought:
- Minimum 60px touch targets on all interactive elements
- Minimum 16–18px body text, 13px minimum for labels
- Full `accessible` / `accessibilityLabel` / `accessibilityHint` coverage on every touchable element
- No information conveyed by color alone — every visual cue is paired with haptic and/or spoken feedback
- Dark theme by default, with a light mode toggle available

---



---


---

## 🙏 Acknowledgments

Built for HACKVERSE as an accessibility-first MVP. Powered entirely by free-tier infrastructure from Groq and OpenRouter.
THANK YOU HACKVERSE
