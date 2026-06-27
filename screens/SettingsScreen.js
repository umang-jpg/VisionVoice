import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import * as Speech from 'expo-speech';
import { HAPTIC_PATTERNS, playHapticPattern } from '../services/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { MaterialIcons } from '@expo/vector-icons';
import { getTheme, TYPOGRAPHY, getShadows } from '../constants/theme';

const SPEECH_RATES = [
  { label: 'SLOW', value: 0.7 },
  { label: 'NORMAL', value: 0.9 },
  { label: 'FAST', value: 1.2 },
  { label: 'MAX', value: 1.5 },
];

export default function SettingsScreen() {
  const {
    hapticEnabled,
    setHapticEnabled,
    speechRate,
    setSpeechRate,
    sosEnabled,
    setSosEnabled,
    theme: themeMode,
    setTheme,
  } = useSettings();
  const insets = useSafeAreaInsets();
  const theme = getTheme(themeMode);
  const shadows = getShadows(theme);

  const testPattern = (key) => {
    const pattern = HAPTIC_PATTERNS[key];
    Speech.speak(`Testing: ${pattern.label}. ${pattern.description}.`, { rate: speechRate });
    if (hapticEnabled) {
      setTimeout(() => playHapticPattern(key), 1200);
    }
  };

  const setSpeechRateAndAnnounce = (rate, label) => {
    setSpeechRate(rate);
    Speech.stop();
    Speech.speak(`Speech rate set to ${label}`, { rate });
  };

  const testSpeech = () => {
    Speech.stop();
    Speech.speak(
      'This is a test of the VisionVoice speech system.',
      { rate: speechRate }
    );
  };

  const patternKeys = Object.keys(HAPTIC_PATTERNS);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        accessible={false}
      >
        {/* ── Theme Section ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.onBackground }]}>DISPLAY</Text>

          <View style={[styles.rowBox, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.border }, shadows.neoSm]}>
            <Text style={[styles.rowLabel, { color: theme.onBackground }]}>Dark Mode</Text>
            <Switch
              value={themeMode === 'dark'}
              onValueChange={(val) => {
                const newTheme = val ? 'dark' : 'light';
                setTheme(newTheme);
                Speech.speak(`${newTheme} theme activated`);
              }}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={theme.white}
              accessible
              accessibilityLabel={`Dark mode ${themeMode === 'dark' ? 'enabled' : 'disabled'}`}
            />
          </View>
        </View>

        {/* ── SOS section ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.onBackground }]}>EMERGENCY</Text>

          <View style={[styles.rowBox, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.border }, shadows.neoSm]}>
            <Text style={[styles.rowLabel, { color: theme.onBackground }]}>Fall Detection SOS</Text>
            <Switch
              value={sosEnabled}
              onValueChange={(val) => {
                setSosEnabled(val);
                Speech.speak(val ? 'Fall detection SOS enabled' : 'Fall detection SOS disabled');
              }}
              trackColor={{ false: theme.border, true: theme.semantic.danger }}
              thumbColor={theme.white}
              accessible
              accessibilityLabel={`Fall detection SOS ${sosEnabled ? 'enabled' : 'disabled'}`}
              accessibilityHint="Turns accelerometer fall detection and emergency alerts on or off"
            />
          </View>
        </View>

        {/* ── Haptics section ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.onBackground }]}>HAPTIC FEEDBACK</Text>

          <View style={[styles.rowBox, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.border }, shadows.neoSm]}>
            <Text style={[styles.rowLabel, { color: theme.onBackground }]}>Enable Haptics</Text>
            <Switch
              value={hapticEnabled}
              onValueChange={(val) => {
                setHapticEnabled(val);
                Speech.speak(val ? 'Haptics enabled' : 'Haptics disabled');
              }}
              trackColor={{ false: theme.border, true: theme.semantic.accent }}
              thumbColor={theme.white}
              accessible
              accessibilityLabel={`Haptic feedback ${hapticEnabled ? 'enabled' : 'disabled'}`}
            />
          </View>

          <Text style={[styles.subheading, { color: theme.onBackground }]}>TEST PATTERNS</Text>
          {patternKeys.map((key, index) => {
            const pattern = HAPTIC_PATTERNS[key];
            const isTilted = index % 2 === 1;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.patternBtn,
                  { backgroundColor: theme.white, borderColor: theme.border },
                  isTilted ? { transform: [{ rotate: '1deg' }] } : {},
                  shadows.neo
                ]}
                onPress={() => testPattern(key)}
                accessible
                accessibilityLabel={`Test ${pattern.label}: ${pattern.description}`}
                accessibilityHint="Plays this haptic pattern and announces its name"
              >
                <View style={[styles.patternIconBox, { backgroundColor: theme.onBackground, borderColor: theme.border }]}>
                  <MaterialIcons name="vibration" size={24} color={theme.background} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.patternLabel, { color: theme.onBackground }]}>{pattern.label.toUpperCase()}</Text>
                  <Text style={[styles.patternDesc, { color: theme.onBackground }]}>{pattern.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Speech section ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.onBackground }]}>SPEECH SPEED</Text>

          <View style={styles.rateRow}>
            {SPEECH_RATES.map((rate, idx) => {
              const isActive = speechRate === rate.value;
              return (
                <TouchableOpacity
                  key={rate.label}
                  style={[
                    styles.rateBtn,
                    { 
                      backgroundColor: isActive ? theme.primary : theme.white,
                      borderColor: theme.border,
                      transform: [{ rotate: idx % 2 === 0 ? '-1deg' : '1deg' }]
                    },
                    shadows.neoSm
                  ]}
                  onPress={() => setSpeechRateAndAnnounce(rate.value, rate.label)}
                  accessible
                  accessibilityLabel={`${rate.label} speech rate`}
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[
                    styles.rateBtnText, 
                    { color: isActive ? theme.onPrimary : theme.onBackground }
                  ]}>
                    {rate.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.testSpeechBtn, { backgroundColor: theme.white, borderColor: theme.border }, shadows.neo]}
            onPress={testSpeech}
            accessible
            accessibilityLabel="Test speech output"
            accessibilityHint="Plays a test sentence at the current speech rate"
          >
            <View style={styles.testSpeechBtnContent}>
              <MaterialIcons name="volume-up" size={24} color={theme.onBackground} style={{ marginRight: 8 }} />
              <Text style={[styles.testSpeechText, { color: theme.onBackground }]}>TEST SPEECH</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── About section ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.onBackground }]}>ABOUT</Text>
          <View style={[styles.aboutBox, { backgroundColor: theme.primary, borderColor: theme.border }, shadows.neo]}>
            <Text style={[styles.aboutText, { color: theme.onPrimary }]}>
              VISIONVOICE MVP v1.0{'\n'}
              AI-POWERED ACCESSIBILITY ASSISTANT{'\n'}
              BUILT FOR BLIND AND VISUALLY IMPAIRED USERS
            </Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Anybody_800ExtraBold',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  subheading: {
    fontSize: 12,
    fontFamily: 'Anybody_800ExtraBold',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
  },
  rowBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 4,
    borderRadius: 0,
    marginBottom: 12,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: 'SpaceMono_700Bold',
  },
  patternBtn: {
    padding: 16,
    borderWidth: 4,
    borderRadius: 0,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  patternIconBox: {
    padding: 8,
    borderWidth: 4,
    marginRight: 16,
  },
  patternLabel: {
    fontSize: 18,
    fontFamily: 'Anybody_800ExtraBold',
    marginBottom: 4,
  },
  patternDesc: {
    fontSize: 12,
    fontFamily: 'SpaceMono_400Regular',
    lineHeight: 16,
  },
  rateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  rateBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 4,
    borderRadius: 0,
  },
  rateBtnText: {
    fontSize: 14,
    fontFamily: 'SpaceMono_700Bold',
  },
  testSpeechBtn: {
    marginTop: 12,
    padding: 20,
    borderWidth: 4,
    borderRadius: 0,
  },
  testSpeechBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testSpeechText: {
    fontSize: 18,
    fontFamily: 'Anybody_800ExtraBold',
  },
  aboutBox: {
    padding: 20,
    borderWidth: 4,
    borderRadius: 0,
  },
  aboutText: {
    fontSize: 12,
    fontFamily: 'SpaceMono_700Bold',
    lineHeight: 20,
  },
});
