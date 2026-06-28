import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { getTheme, getShadows } from '../constants/theme';
import { transcribeAudio, extractDestination } from '../services/ai';
import { requestLocationPermission } from '../services/locationService';
import { fetchWalkingRoute } from '../services/routing';
import { createNavigationTracker } from '../services/navigationTracking';
import { playHapticPattern } from '../services/haptics';
import NavigationMap from '../components/NavigationMap';
import WaveformLoader from '../components/WaveformLoader';

const TRIPLE_TAP_WINDOW_MS = 600;

function createStyles(theme, shadows) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingHorizontal: 20,
    },
    statusBox: {
      backgroundColor: theme.surface,
      borderWidth: 4,
      borderColor: theme.border,
      padding: 18,
      marginBottom: 16,
      ...shadows.neo,
    },
    statusHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    statusHeaderText: {
      flex: 1,
    },
    statusLabel: {
      color: theme.semantic.neutral,
      fontSize: 11,
      fontFamily: 'SpaceMono_700Bold',
      fontWeight: '700',
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    statusText: {
      color: theme.onBackground,
      fontSize: 22,
      fontFamily: 'Anybody_800ExtraBold',
      fontWeight: '800',
    },
    destinationText: {
      color: theme.semantic.neutral,
      fontSize: 18,
      fontFamily: 'SpaceMono_400Regular',
      fontWeight: '600',
      marginTop: 10,
    },
    stepText: {
      color: theme.onBackground,
      opacity: 0.65,
      fontSize: 15,
      fontFamily: 'SpaceMono_400Regular',
      marginTop: 8,
      lineHeight: 22,
    },
    statusBadge: {
      width: 52,
      height: 52,
      borderWidth: 3,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.semantic.accent,
    },
    hintText: {
      color: theme.onBackground,
      opacity: 0.6,
      fontSize: 15,
      fontFamily: 'SpaceMono_400Regular',
      marginTop: 8,
      marginBottom: 24,
      textAlign: 'center',
      lineHeight: 22,
    },
    spacer: {
      flex: 1,
    },
    cancelBtn: {
      alignSelf: 'stretch',
      paddingVertical: 18,
      paddingHorizontal: 28,
      backgroundColor: theme.surface,
      borderWidth: 4,
      borderColor: theme.semantic.danger,
      minHeight: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      ...shadows.neoSm,
    },
    cancelText: {
      color: theme.semantic.danger,
      fontSize: 17,
      fontFamily: 'Anybody_800ExtraBold',
      fontWeight: '800',
      letterSpacing: 0.5,
    },
  });
}

export default function NavigationScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const { hapticEnabled, speechRate, theme: themeMode } = useSettings();
  const theme = getTheme(themeMode);
  const shadows = getShadows(theme);
  const styles = useMemo(() => createStyles(theme, shadows), [theme, shadows]);

  const [status, setStatus] = useState('idle');
  const [statusText, setStatusText] = useState('Ready');
  const [destinationLabel, setDestinationLabel] = useState('');
  const [activeRoute, setActiveRoute] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [distanceToNextTurn, setDistanceToNextTurn] = useState(null);
  const [totalSteps, setTotalSteps] = useState(0);
  const [userPosition, setUserPosition] = useState(null);
  const [cueFlashActive, setCueFlashActive] = useState(false);
  const [gpsLost, setGpsLost] = useState(false);

  const cueFlashTimerRef = useRef(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const isRecordingRef = useRef(false);
  const trackerRef = useRef(null);
  const routeRef = useRef(null);
  const tapTimesRef = useRef([]);
  const hasSpokenIntroRef = useRef(false);

  const speak = useCallback(
    (text) => {
      Speech.stop();
      Speech.speak(text, { rate: speechRate });
    },
    [speechRate]
  );

  const setNavStatus = useCallback((nextStatus, text) => {
    setStatus(nextStatus);
    setStatusText(text);
  }, []);

  const stopTracking = useCallback(() => {
    if (trackerRef.current) {
      trackerRef.current.stop();
      trackerRef.current = null;
    }
    routeRef.current = null;
  }, []);

  const resetToIdle = useCallback(() => {
    stopTracking();
    setDestinationLabel('');
    setActiveRoute(null);
    setCurrentStepIndex(0);
    setDistanceToNextTurn(null);
    setTotalSteps(0);
    setUserPosition(null);
    setCueFlashActive(false);
    setGpsLost(false);
    if (cueFlashTimerRef.current) {
      clearTimeout(cueFlashTimerRef.current);
      cueFlashTimerRef.current = null;
    }
    setNavStatus('idle', 'Ready');
  }, [setNavStatus, stopTracking]);

  const flashCueHighlight = useCallback(() => {
    setCueFlashActive(true);
    if (cueFlashTimerRef.current) clearTimeout(cueFlashTimerRef.current);
    cueFlashTimerRef.current = setTimeout(() => {
      setCueFlashActive(false);
      cueFlashTimerRef.current = null;
    }, 400);
  }, []);

  const handleArrival = useCallback(() => {
    stopTracking();
    setNavStatus('arrived', 'Arrived');
    speak('You have arrived.');
    if (hapticEnabled) playHapticPattern('navigationArrived');
    setTimeout(() => resetToIdle(), 3000);
  }, [hapticEnabled, resetToIdle, setNavStatus, speak, stopTracking]);

  const startLiveNavigation = useCallback(
    async (routeData) => {
      routeRef.current = routeData;
      setActiveRoute(routeData);
      setCurrentStepIndex(0);
      setDistanceToNextTurn(null);
      setTotalSteps(routeData.steps.length);
      setUserPosition(routeData.origin || null);
      setNavStatus('navigating', 'Navigating');

      const tracker = createNavigationTracker({
        steps: routeData.steps,
        onProgress: ({
          currentStepIndex: stepIdx,
          distanceToNextTurn: dist,
          totalSteps: stepsTotal,
          userPosition: position,
        }) => {
          setCurrentStepIndex(stepIdx);
          setDistanceToNextTurn(dist);
          setTotalSteps(stepsTotal);
          if (position) setUserPosition(position);
          // GPS updates are flowing — clear any lost-signal indicator
          setGpsLost(false);
        },
        onCue: (step, isRepeat) => {
          const prefix = isRepeat ? 'Reminder. ' : '';
          speak(`${prefix}${step.spokenCue}`);
          if (hapticEnabled) {
            playHapticPattern(step.hapticKey);
          }
          flashCueHighlight();
        },
        onArrive: handleArrival,
        onError: (code) => {
          if (code === 'location_denied') {
            speak('Location permission is required for turn-by-turn navigation.');
            if (hapticEnabled) playHapticPattern('error');
            resetToIdle();
          } else if (code === 'location_unavailable') {
            speak('I could not get your current location. Please make sure GPS is enabled and try again.');
            if (hapticEnabled) playHapticPattern('error');
            resetToIdle();
          } else if (code === 'gps_lost') {
            speak('I lost your GPS signal. Navigation will continue once it is back.');
            if (hapticEnabled) playHapticPattern('warning');
            setGpsLost(true);
            // Do NOT call resetToIdle() here — gps_lost is recoverable mid-walk.
            // The tracker keeps retrying internally; only location_denied and
            // location_unavailable end the session.
          }
        },
      });

      trackerRef.current = tracker;
      const started = await tracker.start();
      if (!started) return;

      speak(`Navigation started. ${routeData.steps.length} steps. ${routeData.summaryDistance}.`);
      if (hapticEnabled) playHapticPattern('response');
    },
    [flashCueHighlight, hapticEnabled, handleArrival, resetToIdle, setNavStatus, speak]
  );

  const resolveRoute = useCallback(
    async (destinationQuery) => {
      setNavStatus('routing', 'Finding route…');
      speak('Finding walking route.');

      const result = await fetchWalkingRoute(destinationQuery);

      if (!result.ok) {
        speak(result.message);
        if (hapticEnabled) playHapticPattern('error');
        resetToIdle();
        return;
      }

      setDestinationLabel(result.destinationName);
      speak(
        `Route found to ${result.destinationName}. ${result.summaryDistance}, about ${result.summaryDuration}. Starting guidance.`
      );
      await startLiveNavigation(result);
    },
    [hapticEnabled, resetToIdle, setNavStatus, speak, startLiveNavigation]
  );

  const processDestinationTranscript = useCallback(
    async (transcript) => {
      setNavStatus('processing', 'Processing…');

      const destination = await extractDestination(transcript);

      if (!destination) {
        speak('I could not understand the destination. Triple tap and try again.');
        if (hapticEnabled) playHapticPattern('error');
        setNavStatus('idle', 'Ready');
        return;
      }

      setDestinationLabel(destination);
      await resolveRoute(destination);
    },
    [hapticEnabled, resolveRoute, setNavStatus, speak]
  );

  const stopDestinationRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;

    isRecordingRef.current = false;
    setNavStatus('processing', 'Processing…');
    if (hapticEnabled) playHapticPattern('stop');

    try {
      await recorder.stop();
      
      // Reset audio mode to disable recording and restore high-quality playback routing
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recorder.uri;
      const transcript = await transcribeAudio(uri);

      if (!transcript || transcript.trim().length < 2) {
        speak("I didn't catch that. Triple tap and say your destination.");
        if (hapticEnabled) playHapticPattern('error');
        setNavStatus('idle', 'Ready');
        return;
      }

      await processDestinationTranscript(transcript);
    } catch (err) {
      console.warn('Navigation recording error:', err);
      speak('Something went wrong. Please try again.');
      if (hapticEnabled) playHapticPattern('error');
      setNavStatus('idle', 'Ready');
    }
  }, [hapticEnabled, recorder, processDestinationTranscript, setNavStatus, speak]);

  const startDestinationRecording = useCallback(async () => {
    if (isRecordingRef.current || status === 'navigating' || status === 'routing') return;

    setNavStatus('listening', 'Listening…');
    if (hapticEnabled) playHapticPattern('start');
    Speech.stop();
    Speech.speak('Where do you want to go?', {
      rate: speechRate,
      onDone: async () => {
        try {
          await AudioModule.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
          await recorder.prepareToRecordAsync();
          recorder.record();
          isRecordingRef.current = true;
        } catch (err) {
          console.warn('Start navigation recording failed:', err);
          speak('Could not start recording. Check microphone permission.');
          if (hapticEnabled) playHapticPattern('error');
          setNavStatus('idle', 'Ready');
        }
      },
      onError: () => {
        // If TTS itself fails, do not leave the user stuck in "Listening…"
        // with no mic ever started — fall back to starting the recording
        // anyway so the feature still works.
        (async () => {
          try {
            await AudioModule.setAudioModeAsync({
              allowsRecordingIOS: true,
              playsInSilentModeIOS: true,
            });
            await recorder.prepareToRecordAsync();
            recorder.record();
            isRecordingRef.current = true;
          } catch (err) {
            console.warn('Start navigation recording failed after TTS error:', err);
            if (hapticEnabled) playHapticPattern('error');
            setNavStatus('idle', 'Ready');
          }
        })();
      },
    });
  }, [hapticEnabled, recorder, setNavStatus, speechRate, status]);

  const handleTripleTap = useCallback(() => {
    const now = Date.now();
    tapTimesRef.current = tapTimesRef.current.filter((t) => now - t < TRIPLE_TAP_WINDOW_MS);
    tapTimesRef.current.push(now);

    if (tapTimesRef.current.length >= 3) {
      tapTimesRef.current = [];
      if (status === 'listening') {
        stopDestinationRecording();
      } else if (status === 'idle' || status === 'arrived') {
        startDestinationRecording();
      }
    }
  }, [startDestinationRecording, status, stopDestinationRecording]);

  const handleCancelNavigation = useCallback(() => {
    stopTracking();
    speak('Navigation cancelled.');
    if (hapticEnabled) playHapticPattern('stop');
    resetToIdle();
  }, [hapticEnabled, resetToIdle, speak, stopTracking]);

  useFocusEffect(
    useCallback(() => {
      if (!hasSpokenIntroRef.current) {
        hasSpokenIntroRef.current = true;
        setTimeout(() => speak('You are on the Navigation screen.'), 400);
      }
      requestLocationPermission();

      return () => {
        if (isRecordingRef.current) {
          recorder.stop().catch(() => { });
          isRecordingRef.current = false;
        }
      };
    }, [recorder, speak])
  );

  useEffect(() => () => {
    stopTracking();
    if (cueFlashTimerRef.current) clearTimeout(cueFlashTimerRef.current);
  }, [stopTracking]);

  const liveProgressText =
    status === 'navigating' && totalSteps > 0
      ? `Step ${currentStepIndex + 1} of ${totalSteps} · ${distanceToNextTurn ?? '—'} meters to next turn`
      : '';

  useEffect(() => {
    if (route.params?.cancel) {
      handleCancelNavigation();
      navigation.setParams({ cancel: undefined });
    }
  }, [route.params?.cancel, handleCancelNavigation, navigation]);

  const isBusy = status === 'processing' || status === 'routing';
  const isListening = status === 'listening';
  const isNavigating = status === 'navigating';

  let badgeColor = theme.semantic.accent;
  let badgeIcon = 'map-pin';
  if (isListening) {
    badgeColor = theme.semantic.danger;
    badgeIcon = 'mic';
  } else if (isBusy || isNavigating) {
    badgeColor = theme.semantic.success;
    badgeIcon = isNavigating ? 'navigation' : 'loader';
  }
  // GPS lost mid-navigation — override badge to warn without killing the route
  if (gpsLost && isNavigating) {
    badgeColor = theme.semantic.neutral;
    badgeIcon = 'wifi-off';
  }

  const statusBorderColor = cueFlashActive ? theme.semantic.neutral : theme.border;

  return (
    <Pressable
      style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }]}
      onPress={handleTripleTap}
      accessible={false}
      accessibilityLabel="Navigation screen. Triple tap anywhere to speak your destination."
      accessibilityHint="Triple tap to start or stop destination recording"
    >
      {activeRoute ? (
        <NavigationMap activeRoute={activeRoute} userPosition={userPosition} />
      ) : null}

      <View
        style={[styles.statusBox, { borderColor: statusBorderColor }]}
        accessible
        accessibilityLabel={`Status: ${statusText}${liveProgressText ? `. ${liveProgressText}` : ''}`}
      >
        <View style={styles.statusHeaderRow}>
          <View style={styles.statusHeaderText}>
            <Text style={styles.statusLabel}>STATUS</Text>
            <Text style={styles.statusText}>{statusText}</Text>
            {destinationLabel ? (
              <Text
                style={styles.destinationText}
                accessibilityLabel={`Destination: ${destinationLabel}`}
              >
                {destinationLabel}
              </Text>
            ) : null}
            {liveProgressText ? (
              <Text style={styles.stepText} accessibilityLiveRegion="polite">
                {liveProgressText}
              </Text>
            ) : null}
          </View>

          <View
            style={[styles.statusBadge, { backgroundColor: badgeColor }]}
            accessible
            accessibilityLabel={
              isListening
                ? 'Listening for destination'
                : isBusy
                  ? 'Processing destination'
                  : gpsLost && isNavigating
                    ? 'GPS signal lost, waiting to recover'
                    : isNavigating
                      ? 'Navigation in progress'
                      : 'Ready to set destination'
            }
          >
            {isBusy ? (
              <WaveformLoader size="small" color={theme.onPrimary} />
            ) : (
              <Feather name={badgeIcon} size={24} color={theme.onPrimary} />
            )}
          </View>
        </View>
      </View>

      <Text style={styles.hintText}>
        Triple-tap anywhere to speak your destination
        {isListening ? ' · Triple-tap again to stop' : ''}
      </Text>

      <View style={styles.spacer} />

      {isNavigating ? (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleCancelNavigation}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Cancel navigation"
          accessibilityHint="Stops turn-by-turn guidance"
        >
          <Text style={styles.cancelText}>Cancel navigation</Text>
        </TouchableOpacity>
      ) : null}
    </Pressable>
  );
}
