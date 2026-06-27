import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import { describeScene, readTextFromImage, identifyObject, identifyCurrency, generateMemoryLog } from '../services/ai';
import { addMemoryEntry } from '../services/memoryLog';
import { playHapticPattern } from '../services/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getTheme, getShadows } from '../constants/theme';
import WaveformLoader from '../components/WaveformLoader';


const MODES = [
  { key: 'describe',  label: 'Scene',    icon: 'eye',          hint: 'Describe what is in front of me',  fn: describeScene },
  { key: 'read',      label: 'Text',     icon: 'file-text',    hint: 'Read any text in view',             fn: readTextFromImage },
  { key: 'identify',  label: 'Object',   icon: 'box',          hint: 'Identify the object I am holding',  fn: identifyObject },
  { key: 'currency',  label: 'Money',    icon: 'dollar-sign',  hint: 'Identify currency or banknotes',    fn: identifyCurrency },
];

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [modeIndex, setModeIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState('');
  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { hapticEnabled, speechRate, theme: themeMode } = useSettings();
  const route = useRoute();
  const navigation = useNavigation();

  const theme = getTheme(themeMode);
  const shadows = getShadows(theme);
  const styles = useMemo(() => createStyles(theme, shadows), [theme, shadows]);

  const currentMode = MODES[modeIndex];

  const analyze = useCallback(async () => {
    if (!cameraRef.current || isAnalyzing) return;

    setIsAnalyzing(true);
    setResult('');
    if (hapticEnabled) playHapticPattern('start');
    Speech.speak('Analyzing...', { rate: speechRate });

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.75,
        skipProcessing: true,
      });

      const output = await currentMode.fn(photo.base64);
      setResult(output);
      Speech.stop();
      Speech.speak(output, { rate: speechRate });
      if (hapticEnabled) playHapticPattern('response');

      try {
        const memoryResult = await generateMemoryLog(output);
        await addMemoryEntry(
          memoryResult?.logText || output,
          memoryResult?.keywords || [],
          currentMode.label,
          output
        );
      } catch (err) {
        console.warn('Memory log generation failed (non-fatal):', err);
        await addMemoryEntry(output, [], currentMode.label, output);
      }
    } catch (err) {
      console.error('Camera analysis error:', err);
      const msg = 'Could not analyze. Please try again.';
      setResult(msg);
      Speech.speak(msg, { rate: speechRate });
      if (hapticEnabled) playHapticPattern('error');
    }

    setIsAnalyzing(false);
  }, [isAnalyzing, currentMode, hapticEnabled, speechRate]);

  useEffect(() => {
    Speech.speak('Camera screen. Swipe through modes then tap the large button to analyze.', { rate: speechRate });
  }, []);

  // Handle voice-triggered camera mode switching
  useEffect(() => {
    if (route.params?.voiceModeKey) {
      const targetModeKey = route.params.voiceModeKey;
      const idx = MODES.findIndex((m) => m.key === targetModeKey);
      if (idx !== -1) {
        setModeIndex(idx);
        setResult('');
        Speech.stop();
        Speech.speak(MODES[idx].hint, { rate: speechRate });
        if (hapticEnabled) {
          playHapticPattern('stop');
        }
      }
      navigation.setParams({ voiceModeKey: undefined });
    }
  }, [route.params?.voiceModeKey, speechRate, hapticEnabled]);

  // Handle voice-triggered capture
  useEffect(() => {
    if (route.params?.voiceCapture) {
      analyze();
      navigation.setParams({ voiceCapture: undefined });
    }
  }, [route.params?.voiceCapture, analyze]);


  const cycleMode = () => {
    const next = (modeIndex + 1) % MODES.length;
    setModeIndex(next);
    setResult('');
    Speech.speak(MODES[next].hint, { rate: speechRate });
    if (hapticEnabled) playHapticPattern('stop');
  };

  const repeatResult = () => {
    if (result) { Speech.stop(); Speech.speak(result, { rate: speechRate }); }
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.permText}>Camera permission is required</Text>
        <TouchableOpacity style={[styles.permButton, shadows.neo]} onPress={requestPermission}
          accessible accessibilityLabel="Grant camera permission">
          <Text style={styles.permButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back" />

      <View style={styles.controls}>
        {/* ── Mode selector ─────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modeRow}>
          {MODES.map((m, i) => {
            const isActive = modeIndex === i;
            return (
              <TouchableOpacity key={m.key}
                style={[
                  styles.modeBtn,
                  isActive && { backgroundColor: theme.primary, borderColor: theme.border },
                  isActive && shadows.neoSm
                ]}
                onPress={() => { setModeIndex(i); setResult(''); Speech.speak(m.hint, { rate: speechRate }); }}
                accessible accessibilityLabel={m.hint}
                accessibilityState={{ selected: isActive }}>
                <View style={styles.modeBtnContent}>
                  <Feather name={m.icon} size={16} color={isActive ? theme.onPrimary : theme.onBackground} style={{ marginRight: 6 }} />
                  <Text style={[styles.modeBtnText, isActive && { color: theme.onPrimary }]}>{m.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Result box ────────────────────────────── */}
        {result ? (
          <TouchableOpacity style={[styles.resultBox, shadows.neoSm]} onPress={repeatResult}
            accessible accessibilityLabel={`Result: ${result}. Double tap to replay.`}>
            <Text style={styles.resultLabel}>TAP TO REPLAY</Text>
            <ScrollView style={{ maxHeight: 90 }}>
              <Text style={styles.resultText}>{result}</Text>
            </ScrollView>
          </TouchableOpacity>
        ) : null}

        {/* ── Main capture button ───────────────────── */}
        <TouchableOpacity
          style={[
            styles.captureBtn,
            isAnalyzing && { backgroundColor: theme.semantic.success, borderColor: theme.border },
            shadows.neo
          ]}
          onPress={analyze}
          disabled={isAnalyzing}
          accessible
          accessibilityLabel={currentMode.hint}
          accessibilityRole="button">
          {isAnalyzing
            ? <WaveformLoader size="large" color={theme.onPrimary} />
            : <Feather name={currentMode.icon} size={40} color={theme.onPrimary} style={{ marginBottom: 6 }} />}
          <Text style={styles.captureText}>
            {isAnalyzing ? 'ANALYZING…' : currentMode.label.toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(theme, shadows) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    centered: { justifyContent: 'center', alignItems: 'center', padding: 24 },
    camera: { flex: 1 },
    controls: { backgroundColor: theme.surface, padding: 16, gap: 12, borderTopWidth: 4, borderTopColor: theme.border },
    modeRow: { gap: 12, paddingBottom: 4 },
    modeBtn: {
      paddingVertical: 12, paddingHorizontal: 20, borderRadius: 0,
      backgroundColor: theme.surfaceContainerLow, borderWidth: 4, borderColor: theme.border,
    },
    modeBtnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeBtnText: { color: theme.onBackground, fontSize: 16, fontFamily: 'Anybody_800ExtraBold', textTransform: 'uppercase' },
    resultBox: {
      backgroundColor: theme.surfaceContainerLow, borderRadius: 0, padding: 14,
      borderWidth: 4, borderColor: theme.border,
      borderLeftWidth: 8, borderLeftColor: theme.semantic.accent,
    },
    resultLabel: {
      color: theme.onBackground, fontSize: 12, fontFamily: 'SpaceMono_700Bold',
      letterSpacing: 1.2, marginBottom: 6, opacity: 0.8
    },
    resultText: { color: theme.onBackground, fontSize: 16, lineHeight: 24, fontFamily: 'SpaceMono_400Regular' },
    captureBtn: {
      height: 130, backgroundColor: theme.primary, borderRadius: 0,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 4, borderColor: theme.border,
    },
    captureIcon: { fontSize: 44 },
    captureText: { color: theme.onPrimary, fontSize: 24, fontFamily: 'Anybody_800ExtraBold', marginTop: 8 },
    permText: { color: theme.onBackground, fontSize: 20, textAlign: 'center', marginBottom: 20, lineHeight: 30, fontFamily: 'SpaceMono_700Bold' },
    permButton: {
      backgroundColor: theme.primary, paddingVertical: 18, paddingHorizontal: 32,
      borderRadius: 0, borderWidth: 4, borderColor: theme.border,
    },
    permButtonText: { color: theme.onPrimary, fontSize: 18, fontFamily: 'Anybody_800ExtraBold', textTransform: 'uppercase' },
  });
}
