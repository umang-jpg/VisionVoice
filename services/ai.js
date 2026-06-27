// ─────────────────────────────────────────────────────────────
//  VisionVoice · AI Service
//  Stack (100% free, no credit card required):
//
//  STT  → Groq Whisper large-v3         (console.groq.com)
//  Chat → Groq Llama 3.3 70B            (console.groq.com)
//  Vision → OpenRouter free vision model (openrouter.ai)
// ─────────────────────────────────────────────────────────────

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const OPENROUTER_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

export function sanitizeForSpeech(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/[*_`#]/g, '') // remove asterisks, underscores, backticks, header symbols
    .replace(/ {2,}/g, ' ')  // collapse double spaces
    .trim();
}

// ── Model config (change here if you want to try different ones) ──
const MODELS = {
  chat: 'openai/gpt-oss-120b',          // Groq — fast, smart, free
  stt: 'whisper-large-v3',                   // Groq — best free STT available
  vision: 'meta-llama/llama-3.2-11b-vision-instruct', // OpenRouter free
  textUtility: 'openai/gpt-oss-20b', // Groq — fast, lightweight, for title/cleanup tasks
  // vision alternatives (uncomment to try):
  // vision: 'qwen/qwen2.5-vl-7b-instruct:free',
  // vision: 'google/gemma-3-12b-it:free',
};

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// ── System prompt tuned for blind users ───────────────────────
const SYSTEM_PROMPT = `You are VisionVoice, an AI assistant built exclusively for blind and visually impaired users.

Rules:
- Keep responses SHORT (1-3 sentences) unless the user explicitly asks for more detail
- Use clear directional language: left, right, front, behind, above, below
- Be warm but efficient — users hear your words aloud, so every extra word costs time
- Confirm before irreversible actions
- If unclear, ask ONE simple question
- You help with: navigation, reading, identifying objects, answering questions, composing messages, general tasks`;

// ── Shared fetch helper with retry ───────────────────────────
async function apiFetch(url, options, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);

      // Rate limited — wait and retry
      if (res.status === 429 && attempt < retries) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '3', 10);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`HTTP ${res.status}: ${errBody}`);
      }

      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  1. SPEECH TO TEXT — Groq Whisper
// ─────────────────────────────────────────────────────────────
export async function transcribeAudio(uri) {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    });
    formData.append('model', MODELS.stt);
    formData.append('language', 'en');
    formData.append('response_format', 'json');

    const data = await apiFetch(
      `${GROQ_BASE}/audio/transcriptions`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_KEY}` },
        body: formData,
      }
    );

    return data?.text?.trim() || null;
  } catch (err) {
    console.error('[STT] Groq Whisper error:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  2. CHAT — Groq Llama 3.3 70B
// ─────────────────────────────────────────────────────────────
export async function chat(messages) {
  try {
    const data = await apiFetch(
      `${GROQ_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODELS.chat,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages,
          ],
          max_tokens: 300,
          temperature: 0.7,
          stream: false,
        }),
      }
    );

    const content = data?.choices?.[0]?.message?.content
      ?? "I'm having trouble connecting right now. Please try again.";
    return sanitizeForSpeech(content);
  } catch (err) {
    console.error('[Chat] Groq error:', err.message);
    return sanitizeForSpeech("Sorry, I couldn't reach the assistant. Please check your connection.");
  }
}

// ─────────────────────────────────────────────────────────────
//  3. VISION helpers (shared) — OpenRouter free vision model
// ─────────────────────────────────────────────────────────────
function truncateToFourSentences(text) {
  if (typeof text !== 'string') return text;
  // Match sentence-ending punctuation (. ! ?) followed by whitespace or end of string
  const sentenceEndRegex = /([.!?])(\s+|$)/g;
  let match;
  let count = 0;
  let index = -1;
  while ((match = sentenceEndRegex.exec(text)) !== null) {
    count++;
    if (count === 4) {
      index = match.index + match[1].length;
      break;
    }
  }
  if (index !== -1) {
    return text.substring(0, index).trim();
  }
  return text;
}

async function visionRequest(imageBase64, prompt) {
  try {
    const data = await apiFetch(
      `${OPENROUTER_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://visionvoice.app',  // OpenRouter asks for this
          'X-Title': 'VisionVoice',
        },
        body: JSON.stringify({
          model: MODELS.vision,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
          max_tokens: 450,
        }),
      }
    );

    const content = data?.choices?.[0]?.message?.content?.trim()
      ?? 'Could not analyze the image. Please try again.';
    return truncateToFourSentences(content);
  } catch (err) {
    console.error('[Vision] OpenRouter error:', err.message);
    return 'Unable to analyze the image right now. Please try again.';
  }
}

// ─────────────────────────────────────────────────────────────
//  Shared: parse "key: value" structured vision output
// ─────────────────────────────────────────────────────────────
function parseStructuredVision(raw, fields) {
  const result = {};
  for (const field of fields) {
    // Match "field: value" case-insensitively, capture the rest of the line
    const regex = new RegExp(`^${field}\\s*:\\s*(.+)`, 'im');
    const match = raw.match(regex);
    const value = match?.[1]?.trim() ?? '';
    result[field] = (value === '' || value.toLowerCase() === 'unknown') ? null : value;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
//  4. SCENE DESCRIPTION — for Camera screen
// ─────────────────────────────────────────────────────────────
export async function describeScene(imageBase64) {
  const prompt = `Describe what is in front of the user.
Rules:
- Describe this scene in EXACTLY 1 to 4 short spoken sentences. Not 5. Not 6. Count your sentences before responding — if you have written more than 4, delete sentences until exactly 4 or fewer remain.
- Speak as if describing this out loud to a blind friend in person — natural, casual, spoken language. No labels, no fields, no colons, no bullet points, no Markdown, no asterisks.
- Mention only what matters most: any immediate hazard first if one exists, then the general space, then one or two of the most important objects or landmarks. Skip minor details entirely — do not try to describe everything in the frame.
- If you are unsure about something, say so in one word and move on. Do not hedge at length.`;

  const raw = await visionRequest(imageBase64, prompt);
  return sanitizeForSpeech(raw);
}

// ─────────────────────────────────────────────────────────────
//  5. TEXT READING — for Camera screen (read mode)
// ─────────────────────────────────────────────────────────────
export async function readTextFromImage(imageBase64) {
  const prompt = `Your ONLY task is to read aloud any text visible in this image, exactly as it appears. You are NOT describing an object, a scene, a label's material, color, or container. Ignore everything in the image except the text itself.

Output ONLY the text content you can read, in natural reading order (top to bottom, left to right). If there are multiple lines, separate them naturally as you would when reading aloud.

Do NOT describe what the text is printed on, what shape or color the object is, or any visual context. If text is visible, transcribe it — nothing else.

If NO readable text is visible anywhere in the image, respond with exactly: No text found. Do not describe the image instead.

Keep your response to a MAXIMUM of 4 sentences. If the text itself is very long, summarize the key content briefly rather than transcribing everything verbatim, but still output text content — never switch to describing the object.

No Markdown, no asterisks, no bullet points, no labels like "Text:" or "Object:" — plain spoken transcription only. Count your sentences before responding — if you have written more than 4, delete sentences until exactly 4 or fewer remain.`;

  const raw = await visionRequest(imageBase64, prompt);
  const cleaned = sanitizeForSpeech(raw);

  // ── Sanity check: detect object-description language leak ────────────────
  // If the model ignored the OCR instruction and fell back to describing the
  // object/scene, these patterns will fire. Log a warning so it's visible
  // during testing. Still return the response — no blocking, no retry.
  const descriptionLeakPatterns = [
    /^this is a/i,
    /^the object/i,
    /^i can see a/i,
    /^the image (shows|contains|depicts)/i,
    /^this (image|photo|picture)/i,
    /^in (this|the) (image|photo|picture)/i,
    /^a (red|blue|green|white|black|yellow|orange|purple|brown|grey|gray|pink)\s/i,
    /^the (label|container|bottle|box|package|surface|background)/i,
  ];
  const isDescriptionLeak = descriptionLeakPatterns.some(p => p.test(cleaned));
  if (isDescriptionLeak) {
    console.warn(
      '[readTextFromImage] ⚠️ REGRESSION: model returned object-description instead of OCR transcription.\n' +
      'Response was:', cleaned
    );
  }

  return cleaned;
}

// ─────────────────────────────────────────────────────────────
//  6. OBJECT / PRODUCT IDENTIFICATION
// ─────────────────────────────────────────────────────────────
export async function identifyObject(imageBase64) {
  const prompt = `Identify the main object in the image for a blind user.
Rules:
- Describe the object in EXACTLY 1 to 4 short spoken sentences. Not 5. Not 6. Count your sentences before responding — if you have written more than 4, delete sentences until exactly 4 or fewer remain.
- Speak as if describing this out loud to a blind friend in person — natural, casual, spoken language. No labels, no fields, no colons, no bullet points, no Markdown, no asterisks.
- Mention only what matters most: any immediate hazard first if one exists, then state what the main object is, its color, material, and position if relevant. Skip minor details entirely.
- If you are unsure about something, say so in one word and move on. Do not hedge at length.`;

  const raw = await visionRequest(imageBase64, prompt);
  return sanitizeForSpeech(raw);
}

// ─────────────────────────────────────────────────────────────
//  7. CURRENCY IDENTIFICATION
// ─────────────────────────────────────────────────────────────
export async function identifyCurrency(imageBase64) {
  const prompt = `Identify the currency in this image for a blind person.
Rules:
- State only the denomination and currency in the shortest possible natural phrase (e.g. 'A coin of 10 Indian Rupees' or 'A note of 100 US Dollars') in EXACTLY 1 to 4 short spoken sentences. Not 5. Not 6. Count your sentences before responding — if you have written more than 4, delete sentences until exactly 4 or fewer remain.
- Speak as if describing this out loud to a blind friend in person — natural, casual, spoken language. No labels, no fields, no colons, no bullet points, no Markdown, no asterisks.
- Mention only what matters most: any immediate hazard first if one exists, then the currency denomination. No hedging language, no extra description, no explanation of how you identified it.
- If you are unsure about something, say so in one word and move on. Do not hedge at length.`;

  const raw = await visionRequest(imageBase64, prompt);
  return sanitizeForSpeech(raw);
}

// ─────────────────────────────────────────────────────────────
//  8. CLOTHING DESCRIPTION (color, pattern, type)
// ─────────────────────────────────────────────────────────────
export async function describeClothing(imageBase64) {
  const prompt = `Describe the clothing item(s) in this image for a blind person choosing an outfit.
Rules:
- Describe the clothing in EXACTLY 1 to 4 short spoken sentences. Not 5. Not 6. Count your sentences before responding — if you have written more than 4, delete sentences until exactly 4 or fewer remain.
- Speak as if describing this out loud to a blind friend in person — natural, casual, spoken language. No labels, no fields, no colons, no bullet points, no Markdown, no asterisks.
- Mention only what matters most: any immediate hazard first if one exists, then include the type of garment, main color(s), pattern or design, and any visible brand or text. Skip minor details entirely.
- If you are unsure about something, say so in one word and move on. Do not hedge at length.`;

  const raw = await visionRequest(imageBase64, prompt);
  return sanitizeForSpeech(raw);
}

// ─────────────────────────────────────────────────────────────
//  9. DESTINATION EXTRACTION — for Navigation screen
// ─────────────────────────────────────────────────────────────
const DESTINATION_PREFIXES = [
  /^take me to\s+/i,
  /^go to\s+/i,
  /^navigate to\s+/i,
  /^directions to\s+/i,
  /^walk to\s+/i,
  /^get me to\s+/i,
  /^head to\s+/i,
  /^i want to go to\s+/i,
  /^i need to go to\s+/i,
  /^bring me to\s+/i,
];

/**
 * Extract a destination place query from a voice transcript.
 * Returns null if no usable destination is found.
 */
export async function extractDestination(transcript) {
  if (!transcript?.trim()) return null;

  let text = transcript.trim().replace(/[.,!?]+$/, '');

  for (const prefix of DESTINATION_PREFIXES) {
    if (prefix.test(text)) {
      text = text.replace(prefix, '').trim();
      break;
    }
  }

  if (text.length >= 2 && text.length <= 120) {
    return text;
  }

  if (!GROQ_KEY) return null;

  try {
    const data = await apiFetch(
      `${GROQ_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODELS.chat,
          messages: [
            {
              role: 'system',
              content:
                'Extract only the destination place name from the user message. Reply with ONLY the place name, nothing else. If no destination, reply with NONE.',
            },
            { role: 'user', content: transcript },
          ],
          max_tokens: 40,
          temperature: 0,
        }),
      }
    );

    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw || raw.toUpperCase() === 'NONE' || raw.length < 2) return null;
    return raw.replace(/^["']|["']$/g, '');
  } catch (err) {
    console.warn('[extractDestination] error:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  10. MEMORY LOG GENERATION — from camera scan results
// ─────────────────────────────────────────────────────────────
/**
 * Convert raw vision output into a short memory-log sentence + keywords.
 * Uses OpenRouter text-only model (same API key). Returns { logText, keywords } or null.
 */
export async function generateMemoryLog(rawVisionOutput) {
  if (!rawVisionOutput || !OPENROUTER_KEY) return null;

  try {
    const data = await apiFetch(
      `${OPENROUTER_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://visionvoice.app',
          'X-Title': 'VisionVoice',
        },
        body: JSON.stringify({
          model: MODELS.textUtility,
          messages: [
            {
              role: 'user',
              content: `Convert this raw scene description into ONE short natural sentence (max 12 words) suitable for a memory log, written in past tense, e.g. 'Pen was on the kitchen counter.' Then list 2-4 lowercase single-or-two-word keywords from that sentence (the key objects and locations only, not adjectives).

Respond in EXACTLY this format and nothing else:
LOG: <sentence>
KEYWORDS: <comma-separated keywords>

Raw description: ${rawVisionOutput}`,
            },
          ],
          max_tokens: 100,
          temperature: 0.3,
        }),
      },
      3
    );

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    // Defensive parse
    const logMatch = content.match(/LOG:\s*(.+)/i);
    const kwMatch = content.match(/KEYWORDS:\s*(.+)/i);

    if (!logMatch) return null;

    const logText = logMatch[1].trim();
    const keywords = kwMatch
      ? kwMatch[1].split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
      : [];

    return {
      logText: sanitizeForSpeech(logText),
      keywords,
    };
  } catch (err) {
    console.warn('[generateMemoryLog] error:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  11. STUDY NOTE GENERATION — from voice transcript
// ─────────────────────────────────────────────────────────────
/**
 * Convert a raw voice transcript into a structured study note with title.
 * Returns { title, content } or null.
 */
export async function generateStudyNote(transcript) {
  if (!transcript || !OPENROUTER_KEY) return null;

  try {
    const data = await apiFetch(
      `${GROQ_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODELS.textUtility,
          messages: [
            {
              role: 'user',
              content: `You are a study note organizer. Given a spoken transcript, extract:
(a) A short title (1-3 words) that captures the topic — this becomes the keyword.
(b) A clean, organized version of the note content — fix grammar, remove filler words, keep all facts.

Respond in EXACTLY this format and nothing else:
TITLE: <short title>
NOTE: <cleaned up note content>

Transcript: ${transcript}`,
            },
          ],
          max_tokens: 400,
          temperature: 0.3,
        }),
      },
      3
    );

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const titleMatch = content.match(/TITLE:\s*(.+)/i);
    const noteMatch = content.match(/NOTE:\s*([\s\S]+)/i);

    if (!titleMatch || !noteMatch) return null;

    return {
      title: sanitizeForSpeech(titleMatch[1].trim()),
      content: sanitizeForSpeech(noteMatch[1].trim()),
    };
  } catch (err) {
    console.warn('[generateStudyNote] error:', err.message);
    return null;
  }
}

