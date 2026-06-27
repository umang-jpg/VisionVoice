import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@visionvoice_memory_log';
const EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Add a memory entry from a camera scan.
 * @param {string} logText - Short natural sentence describing the scan.
 * @param {string[]} keywords - 2-4 lowercase keywords.
 */
export async function addMemoryEntry(logText, keywords, mode, rawText) {
  try {
    const entries = await _loadRaw();
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      logText,
      keywords: keywords || [],
      timestamp: Date.now(),
      mode: mode || null,
      rawText: rawText || null,
    };
    entries.push(entry);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return entry;
  } catch (err) {
    console.warn('addMemoryEntry error:', err);
    return null;
  }
}

/**
 * Get all non-expired memory entries (most-recent-first).
 * Also prunes expired entries from storage.
 */
export async function getMemoryEntries() {
  try {
    const entries = await _loadRaw();
    const now = Date.now();
    const valid = entries.filter((e) => now - e.timestamp < EXPIRY_MS);

    // Prune expired entries from storage
    if (valid.length !== entries.length) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }

    // Return most-recent-first
    return valid.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.warn('getMemoryEntries error:', err);
    return [];
  }
}

/**
 * Find memory entries matching spoken text using bidirectional substring logic.
 * @param {string} spokenText - Raw transcript, e.g. "where's my pen" or just "pen".
 * @returns {Array} Matching entries, most-recent-first.
 */
export async function findMemoryEntriesByKeyword(spokenText) {
  try {
    const clean = spokenText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (!clean) return [];

    const allEntries = await getMemoryEntries();
    const words = clean.split(/\s+/);

    return allEntries.filter((entry) => {
      // Check if any stored keyword appears in the spoken text
      const keywordInSpoken = entry.keywords.some((kw) =>
        clean.includes(kw.toLowerCase())
      );
      // Check if any spoken word appears in any stored keyword
      const spokenInKeyword = words.some((w) =>
        entry.keywords.some((kw) => kw.toLowerCase().includes(w))
      );
      // Also check against the log text itself
      const inLogText = words.some((w) =>
        entry.logText.toLowerCase().includes(w)
      );
      return keywordInSpoken || spokenInKeyword || inLogText;
    });
  } catch (err) {
    console.warn('findMemoryEntriesByKeyword error:', err);
    return [];
  }
}

/**
 * Delete a single memory entry by id.
 * Follows the same pattern as deleteNote() in services/learnNotes.js.
 */
export async function deleteMemoryEntry(id) {
  try {
    const entries = await _loadRaw();
    const updated = entries.filter((e) => e.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.warn('deleteMemoryEntry error:', err);
    return false;
  }
}

async function _loadRaw() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

