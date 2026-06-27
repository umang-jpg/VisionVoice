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
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Feather } from '@expo/vector-icons';
import { getAllNotes, addNote, findNoteByKeyword, deleteNote } from '../services/learnNotes';
import { generateStudyNote } from '../services/ai';
import { textToBrf, textToBrailleUnicode } from '../services/braille';
import { useSettings } from '../context/SettingsContext';
import { playHapticPattern } from '../services/haptics';
import { getTheme, getShadows } from '../constants/theme';
import WaveformLoader from '../components/WaveformLoader';

const MODES = [
  { key: 'search', label: 'Search', icon: 'search', hint: 'Search existing notes by keyword' },
  { key: 'record', label: 'Record', icon: 'mic', hint: 'Record a new study note' },
];

export default function LearnScreen() {
  const [notes, setNotes] = useState([]);
  const [modeIndex, setModeIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { speechRate, hapticEnabled, theme: themeMode } = useSettings();

  const theme = getTheme(themeMode);
  const shadows = getShadows(theme);
  const styles = useMemo(() => createStyles(theme, shadows), [theme, shadows]);

  const currentMode = MODES[modeIndex];

  const loadNotes = async () => {
    const data = await getAllNotes();
    setNotes(data);
  };

  useEffect(() => {
    if (isFocused) {
      loadNotes();
      Speech.speak('You are on the Learn screen. Swipe through modes to search or record study notes.', { rate: speechRate });
    }
  }, [isFocused, speechRate]);

  // Handle voice queries routed from VoiceContext
  useEffect(() => {
    const handleVoiceQuery = async (transcript) => {
      if (currentMode.key === 'search') {
        const matches = await findNoteByKeyword(transcript);
        if (matches.length > 0) {
          const topMatch = matches[0];
          let response = topMatch.content;
          if (matches.length > 1) {
            response += `. And ${matches.length - 1} more matches found.`;
          }
          Speech.speak(`Found: ${topMatch.title}. ${response}`, { rate: speechRate });
          if (hapticEnabled) playHapticPattern('response');
        } else {
          Speech.speak('No note found for that.', { rate: speechRate });
          if (hapticEnabled) playHapticPattern('error');
        }
      } else if (currentMode.key === 'record') {
        setIsProcessing(true);
        Speech.speak('Organizing your note...', { rate: speechRate });
        const result = await generateStudyNote(transcript);
        if (result) {
          await addNote(result.title, result.content);
          Speech.speak(`Note saved as ${result.title}.`, { rate: speechRate });
          if (hapticEnabled) playHapticPattern('response');
          await loadNotes();
        } else {
          Speech.speak('Could not organize the note. Please try again.', { rate: speechRate });
          if (hapticEnabled) playHapticPattern('error');
        }
        setIsProcessing(false);
      }
      navigation.setParams({ voiceQuery: undefined });
    };

    if (route.params?.voiceQuery && !isProcessing) {
      Speech.stop();
      handleVoiceQuery(route.params.voiceQuery);
    }
  }, [route.params?.voiceQuery, speechRate, hapticEnabled, navigation, currentMode, isProcessing]);

  // Handle voice braille export routed from VoiceContext
  useEffect(() => {
    if (route.params?.voiceBrailleExport) {
      Speech.stop();
      if (notes.length > 0) {
        exportBraille(notes[0]);
      } else {
        Speech.speak('No notes to convert yet.', { rate: speechRate });
        if (hapticEnabled) playHapticPattern('error');
      }
      navigation.setParams({ voiceBrailleExport: undefined });
    }
  }, [route.params?.voiceBrailleExport, notes, speechRate, hapticEnabled, navigation]);

  // Handle voice mode switch — "view notes" → search, "record a note" → record
  useEffect(() => {
    const modeKey = route.params?.voiceModeKey;
    if (!modeKey) return;
    const targetIndex = MODES.findIndex(m => m.key === modeKey);
    if (targetIndex !== -1) {
      setModeIndex(targetIndex);
      Speech.speak(
        modeKey === 'search'
          ? 'Search mode. Say your keyword after tapping the mic.'
          : 'Record mode. Tap the mic and say your note.',
        { rate: speechRate }
      );
    }
    navigation.setParams({ voiceModeKey: undefined });
  }, [route.params?.voiceModeKey, speechRate, navigation]);

  const readNote = (note) => {
    Speech.stop();
    Speech.speak(`${note.title}. ${note.content}`, { rate: speechRate });
  };

  const handleDelete = async (id) => {
    await deleteNote(id);
    Speech.stop();
    Speech.speak('Note deleted.', { rate: speechRate });
    await loadNotes();
  };

  const exportBraille = async (note) => {
    try {
      const brfText = textToBrf(`${note.title}\r\n\r\n${note.content}`);
      const txtText = textToBrailleUnicode(`${note.title}\n\n${note.content}`);

      const fileName = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.brf`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, brfText, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Export Braille BRF',
        });
        Speech.speak('Braille file ready to share', { rate: speechRate });
        if (hapticEnabled) playHapticPattern('response');
      } else {
        Speech.speak('Sharing is not available on this device', { rate: speechRate });
      }
    } catch (err) {
      console.error(err);
      Speech.speak('Failed to export Braille file', { rate: speechRate });
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
          {MODES.map((m, i) => {
            const isActive = modeIndex === i;
            let btnBg = theme.surfaceContainerLow;
            let btnBorder = theme.border;
            let textColor = theme.onBackground;
            if (isActive) {
              btnBg = m.key === 'record' ? theme.semantic.success : theme.primary;
              btnBorder = theme.border;
              textColor = theme.onPrimary;
            }

            return (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.modeBtn,
                  { backgroundColor: btnBg, borderColor: btnBorder },
                  isActive ? shadows.neoSm : null,
                ]}
                onPress={() => { setModeIndex(i); Speech.speak(m.hint, { rate: speechRate }); }}
                accessible
                accessibilityLabel={m.hint}
                accessibilityState={{ selected: isActive }}
              >
                <View style={styles.modeBtnContent}>
                  <Feather name={m.icon} size={16} color={textColor} style={{ marginRight: 6 }} />
                  <Text style={[styles.modeBtnText, { color: textColor }]}>{m.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {isProcessing && (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <WaveformLoader size="large" color={theme.primary} />
            <Text style={{ color: theme.primary, marginTop: 10, fontFamily: 'SpaceMono_700Bold' }}>Processing Note...</Text>
          </View>
        )}

        {notes.length === 0 && !isProcessing ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No notes yet. Switch to Record mode to add one.</Text>
          </View>
        ) : (
          notes.map((note) => (
            <View key={note.id} style={[styles.noteBox, shadows.neo]}>
              <TouchableOpacity
                style={styles.noteContent}
                accessible
                accessibilityLabel={`${note.title}. ${note.content}`}
                accessibilityHint="Double tap to hear this note"
                onPress={() => readNote(note)}
              >
                <Text style={styles.noteTitle}>{note.title}</Text>
                <Text style={styles.noteText} numberOfLines={2}>{note.content}</Text>
              </TouchableOpacity>
              <View style={styles.noteActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  accessible
                  accessibilityLabel="Export as Braille"
                  accessibilityHint="Creates a BRF Braille file for sharing"
                  onPress={() => exportBraille(note)}
                >
                  <Feather name="share" size={24} color={theme.onBackground} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  accessible
                  accessibilityLabel={`Delete note: ${note.title}`}
                  onPress={() => handleDelete(note.id)}
                >
                  <Feather name="trash-2" size={24} color={theme.semantic.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(theme, shadows) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    controls: { backgroundColor: theme.surface, padding: 16, paddingTop: 20, borderBottomWidth: 4, borderBottomColor: theme.border },
    modeRow: { gap: 12, paddingBottom: 4 },
    modeBtn: {
      paddingVertical: 12, paddingHorizontal: 20, borderRadius: 0,
      borderWidth: 4,
    },
    modeBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    modeBtnText: { fontSize: 16, fontFamily: 'Anybody_800ExtraBold', textTransform: 'uppercase' },
    content: { padding: 16 },
    emptyBox: { padding: 24, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: theme.semantic.neutral, fontSize: 16, fontFamily: 'SpaceMono_400Regular', textAlign: 'center' },
    noteBox: {
      backgroundColor: theme.surfaceContainerLow, borderRadius: 0, marginBottom: 16,
      borderWidth: 4, borderColor: theme.border,
      flexDirection: 'row', alignItems: 'stretch',
    },
    noteContent: { flex: 1, padding: 16 },
    noteTitle: { color: theme.onBackground, fontSize: 18, fontFamily: 'Anybody_800ExtraBold', marginBottom: 8 },
    noteText: { color: theme.onBackground, fontSize: 14, fontFamily: 'SpaceMono_400Regular', lineHeight: 22 },
    noteActions: { flexDirection: 'column', borderLeftWidth: 4, borderLeftColor: theme.border, backgroundColor: theme.surface },
    actionBtn: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
    deleteBtn: { borderTopWidth: 4, borderTopColor: theme.border },
  });
}
