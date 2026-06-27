import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@visionvoice_learn_notes';

/**
 * Add a study note.
 * @param {string} title - Short title / keyword (1-3 words).
 * @param {string} content - Cleaned up note content.
 */
export async function addNote(title, content) {
  try {
    const notes = await _loadRaw();
    const note = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      content,
      timestamp: Date.now(),
    };
    notes.push(note);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return note;
  } catch (err) {
    console.warn('addNote error:', err);
    return null;
  }
}

/**
 * Get all notes, most-recent-first. No expiry.
 */
export async function getAllNotes() {
  try {
    const notes = await _loadRaw();
    return notes.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.warn('getAllNotes error:', err);
    return [];
  }
}

/**
 * Find notes matching spoken text using bidirectional substring matching.
 * @param {string} spokenText - Raw transcript.
 * @returns {Array} Matching notes, most-recent-first.
 */
export async function findNoteByKeyword(spokenText) {
  try {
    const clean = spokenText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (!clean) return [];

    const allNotes = await getAllNotes();
    const words = clean.split(/\s+/).filter((w) => w.length >= 2);

    return allNotes.filter((note) => {
      const titleLower = note.title.toLowerCase();
      // Does the spoken text contain the title?
      const titleInSpoken = clean.includes(titleLower);
      // Does the title contain any spoken word?
      const spokenInTitle = words.some((w) => titleLower.includes(w));
      // Does any spoken word appear in the content?
      const inContent = words.some((w) =>
        note.content.toLowerCase().includes(w)
      );
      return titleInSpoken || spokenInTitle || inContent;
    });
  } catch (err) {
    console.warn('findNoteByKeyword error:', err);
    return [];
  }
}

/**
 * Delete a note by id.
 * @param {string} id - The note id to delete.
 */
export async function deleteNote(id) {
  try {
    const notes = await _loadRaw();
    const filtered = notes.filter((n) => n.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.warn('deleteNote error:', err);
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
