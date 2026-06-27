import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { Feather } from '@expo/vector-icons';
import {
  getMemoryEntries,
  findMemoryEntriesByKeyword,
  deleteMemoryEntry,
} from '../services/memoryLog';
import { useSettings } from '../context/SettingsContext';
import { playHapticPattern } from '../services/haptics';
import { getTheme, getShadows } from '../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Date/time formatting helpers — no npm package, native Date methods only
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Returns ordinal suffix: 1→"1st", 2→"2nd", 3→"3rd", 4→"4th"… */
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Visual display label for the entry card header.
 * e.g. "Today, 2:14 PM" | "Yesterday, 9:05 AM" | "Jun 15, 3:30 PM"
 */
function formatTimestampDisplay(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();

  const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  const timeStr = date.toLocaleTimeString([], timeOptions);

  if (date.toDateString() === now.toDateString()) {
    return `Today, ${timeStr}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${timeStr}`;
  }
  const dateOptions = { month: 'short', day: 'numeric' };
  return `${date.toLocaleDateString([], dateOptions)}, ${timeStr}`;
}

/**
 * Natural spoken date+time string.
 * e.g. "June 27th, 2:14 PM" — always includes full month name + ordinal day.
 * Used in Speech.speak() calls so the user hears the full context.
 */
function formatTimestampSpoken(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const month = MONTH_NAMES[date.getMonth()];
  const day = ordinal(date.getDate());

  // 12-hour time with AM/PM
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minuteStr = minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`;
  return `${month} ${day}, ${hours}${minuteStr} ${ampm}`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MemoryScreen() {
  const [entries, setEntries] = useState([]);
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { speechRate, hapticEnabled, theme: themeMode } = useSettings();

  const theme = getTheme(themeMode);
  const shadows = getShadows(theme);
  const styles = useMemo(() => createStyles(theme, shadows), [theme, shadows]);

  const loadEntries = async () => {
    const data = await getMemoryEntries(); // already sorted newest-first
    setEntries(data);
  };

  useEffect(() => {
    if (isFocused) {
      loadEntries();
      Speech.speak(
        'You are on the Memory screen. Say a keyword to hear what was logged, or say show all to hear recent entries.',
        { rate: speechRate }
      );
    }
  }, [isFocused, speechRate]);

  // ── Voice query handler ────────────────────────────────────────────────────
  useEffect(() => {
    const handleVoiceQuery = async (query) => {
      const q = query.toLowerCase();

      if (q === 'show all' || q === 'read everything' || q === 'read all') {
        // (b) "show all" — reads up to 5 most-recent entries with date+time prefix each
        const all = await getMemoryEntries();
        if (all.length === 0) {
          Speech.speak('Your memory log is empty.', { rate: speechRate });
        } else {
          const topEntries = all.slice(0, 5);
          const intro = `Reading the ${topEntries.length} most recent entries. `;
          const text = topEntries
            .map((e) => {
              const when = formatTimestampSpoken(e.timestamp);
              const content = e.rawText || e.logText;
              return `${when}. ${content}`;
            })
            .join('. ');
          Speech.speak(intro + text, { rate: speechRate });
          if (hapticEnabled) playHapticPattern('response');
        }
      } else {
        // (c) Normal keyword search — date+time+content on the match
        const matches = await findMemoryEntriesByKeyword(query);
        if (matches.length > 0) {
          const top = matches[0];
          const when = formatTimestampSpoken(top.timestamp);
          const content = top.rawText || top.logText;
          let response = `${when}. ${content}`;
          if (matches.length > 1) {
            response += `. And ${matches.length - 1} more ${matches.length - 1 === 1 ? 'match' : 'matches'} found.`;
          }
          Speech.speak(response, { rate: speechRate });
          if (hapticEnabled) playHapticPattern('response');
        } else {
          Speech.speak('No memory found for that.', { rate: speechRate });
          if (hapticEnabled) playHapticPattern('error');
        }
      }
      navigation.setParams({ voiceQuery: undefined });
    };

    if (route.params?.voiceQuery) {
      Speech.stop();
      handleVoiceQuery(route.params.voiceQuery);
    }
  }, [route.params?.voiceQuery, speechRate, hapticEnabled, navigation]);

  // (a) readEntry — speaks date+time then content
  const readEntry = (entry) => {
    Speech.stop();
    const when = formatTimestampSpoken(entry.timestamp);
    const content = entry.rawText || entry.logText;
    Speech.speak(`${when}. ${content}`, { rate: speechRate });
  };

  // Delete an entry with audio confirmation
  const handleDelete = async (entry) => {
    await deleteMemoryEntry(entry.id);
    Speech.stop();
    Speech.speak('Memory deleted.', { rate: speechRate });
    if (hapticEnabled) playHapticPattern('stop');
    await loadEntries();
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtext}>
          Recent camera scans are automatically summarized and stored here for 48 hours.
        </Text>

        {entries.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No recent memories.</Text>
          </View>
        ) : (
          entries.map((entry) => {
            const displayWhen = formatTimestampDisplay(entry.timestamp);
            const spokenWhen = formatTimestampSpoken(entry.timestamp);
            const content = entry.rawText || entry.logText;

            return (
              // ── Entry card — mirrors LearnScreen noteBox layout ──────────
              <View key={entry.id} style={[styles.entryBox, shadows.neo]}>

                {/* Left/main area — tappable to read aloud */}
                <TouchableOpacity
                  style={styles.entryContent}
                  accessible
                  accessibilityLabel={`${spokenWhen}. ${content}`}
                  accessibilityHint="Double tap to hear this memory"
                  onPress={() => readEntry(entry)}
                >
                  {/* Header row: mode badge + timestamp */}
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryMode}>{entry.mode || 'Camera'}</Text>
                    <Text style={styles.entryTime}>{displayWhen}</Text>
                  </View>

                  {/* Main content */}
                  <Text style={styles.entryLog} numberOfLines={3}>
                    {content}
                  </Text>

                  {/* Keyword badges */}
                  {entry.keywords && entry.keywords.length > 0 && (
                    <View style={styles.keywordRow}>
                      {entry.keywords.map((kw, i) => (
                        <View key={i} style={styles.keywordBadge}>
                          <Text style={styles.keywordText}>{kw}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>

                {/* Right area — delete button, min 60px touch target */}
                <TouchableOpacity
                  style={[styles.deleteBtn]}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`Delete memory entry from ${spokenWhen}`}
                  accessibilityHint="Permanently removes this entry from the memory log"
                  onPress={() => handleDelete(entry)}
                >
                  <Feather name="trash-2" size={22} color={theme.semantic.danger} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(theme, shadows) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: 16,
      paddingTop: 24,
    },
    subtext: {
      color: theme.semantic.neutral,
      fontSize: 15,
      fontFamily: 'SpaceMono_400Regular',
      marginBottom: 24,
      lineHeight: 22,
    },
    emptyBox: {
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      color: theme.semantic.neutral,
      fontSize: 16,
      fontFamily: 'SpaceMono_400Regular',
    },

    // ── Entry card — mirrors LearnScreen noteBox structure ───────────────────
    entryBox: {
      backgroundColor: theme.surfaceContainerLow,
      borderWidth: 4,
      borderColor: theme.border,
      borderRadius: 0,
      marginBottom: 16,
      borderLeftWidth: 8,
      borderLeftColor: theme.semantic.accent,
      flexDirection: 'row',  // content left, delete button right
      alignItems: 'stretch',
    },

    // Left: tappable content area (flex: 1 so it fills remaining width)
    entryContent: {
      flex: 1,
      padding: 16,
    },

    entryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    entryMode: {
      color: theme.primary,
      fontSize: 14,
      fontFamily: 'SpaceMono_700Bold',
      textTransform: 'uppercase',
    },
    entryTime: {
      color: theme.semantic.neutral,
      fontSize: 12,
      fontFamily: 'SpaceMono_400Regular',
    },
    entryLog: {
      color: theme.onBackground,
      fontSize: 16,
      fontFamily: 'Anybody_800ExtraBold',
      lineHeight: 24,
      marginBottom: 12,
    },
    keywordRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    keywordBadge: {
      backgroundColor: theme.onBackground,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 2,
      borderColor: theme.onBackground,
    },
    keywordText: {
      color: theme.background,
      fontSize: 12,
      fontFamily: 'SpaceMono_700Bold',
      textTransform: 'uppercase',
    },

    // Right: delete button column — separated by a left border, 60px+ target
    deleteBtn: {
      width: 60,
      borderLeftWidth: 4,
      borderLeftColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 60,
    },
  });
}
