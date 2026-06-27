# VisionVoice — MVP (Free Stack)

AI-powered accessibility app for blind and visually impaired users.
**100% free APIs. No credit card required.**

---

## ⚡ Setup (< 1 hour to running on your phone)

### Step 1 — Get 2 free API keys (takes ~5 minutes total)

**Groq** (for voice + chat — fastest free AI available):
1. Go to https://console.groq.com
2. Sign up (free, no credit card)
3. Click **API Keys** → **Create API Key** → copy it

**OpenRouter** (for camera vision features — free models):
1. Go to https://openrouter.ai
2. Sign up (free, no credit card)
3. Click **Keys** → **Create Key** → copy it
4. Free models cost $0 — no credits needed

---

### Step 2 — Install Expo Go on your phone
- iOS: https://apps.apple.com/app/expo-go/id982107779
- Android: https://play.google.com/store/apps/details?id=host.exp.exponent

---

### Step 3 — Create project and copy files

```bash
npx create-expo-app VisionVoice --template blank
cd VisionVoice
```
Copy all files from this zip into the `VisionVoice/` folder.

---

### Step 4 — Install dependencies

```bash
npx expo install expo-camera expo-av expo-haptics expo-speech expo-file-system
npx expo install react-native-safe-area-context react-native-screens
npm install @react-navigation/native @react-navigation/bottom-tabs
```

---

### Step 5 — Add your keys

```bash
cp .env.example .env
```

Open `.env` and paste your Groq and OpenRouter keys.

---

### Step 6 — Run it

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone → live in 30 seconds.

---

## 🏗️ What's Built

| Feature | API Used | Cost |
|---|---|---|
| 🎙️ Voice → Text (Whisper) | Groq | Free |
| 🤖 AI Assistant (Llama 3.3 70B) | Groq | Free |
| 🔊 Text → Speech | expo-speech (device built-in) | Free |
| 👁️ Scene Description | OpenRouter (Llama Vision) | Free |
| 📄 Text Reader | OpenRouter (Llama Vision) | Free |
| 📦 Object Identification | OpenRouter (Llama Vision) | Free |
| 💵 Currency Detection | OpenRouter (Llama Vision) | Free |
| 📳 Haptic Patterns (10 types) | expo-haptics (device built-in) | Free |

**Total monthly cost: $0**

---

## 📊 Free Tier Rate Limits

| Service | Limit | Enough for? |
|---|---|---|
| Groq chat | 30 req/min, 14,400/day | ~200 voice queries/day |
| Groq Whisper | 20 req/min, 2,000/day | ~2,000 recordings/day |
| OpenRouter free | Varies by model | Light to moderate use |

---

## 📁 Project Structure

```
VisionVoice/
├── App.js                    # Navigation
├── screens/
│   ├── HomeScreen.js         # AI Voice Assistant
│   ├── CameraScreen.js       # Scene / Text / Object / Currency
│   └── SettingsScreen.js     # Haptics tester + speech speed
└── services/
    ├── ai.js                 # Groq + OpenRouter (zero OpenAI)
    └── haptics.js            # 10 haptic patterns
```

---

## 🗺️ What's Next (Phase 2)

- [ ] SOS emergency button
- [ ] Safe Walk Mode (continuous narration)
- [ ] Braille text converter
- [ ] Volunteer video call network
- [ ] Community accessibility map
