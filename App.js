import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, View, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import {
  Anybody_700Bold,
  Anybody_800ExtraBold,
  Anybody_900Black,
} from '@expo-google-fonts/anybody';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';

import { SettingsProvider, useSettings } from './context/SettingsContext';
import { VoiceProvider } from './context/VoiceContext';
import GlobalVoiceRail from './components/GlobalVoiceRail';
import WaveformLoader from './components/WaveformLoader';
import SOSModal from './components/SOSModal';
import HomeScreen from './screens/HomeScreen';
import CameraScreen from './screens/CameraScreen';
import SettingsScreen from './screens/SettingsScreen';
import NavigationScreen from './screens/NavigationScreen';
import MemoryScreen from './screens/MemoryScreen';
import LearnScreen from './screens/LearnScreen';
import { navigationRef } from './services/navigation';
import { requestLocationPermission, getLocationMessage } from './services/locationService';
import { startFallDetection, stopFallDetection } from './services/fallDetection';
import { sendEmergencyAlert } from './services/sosMessaging';
import { playHapticPattern } from './services/haptics';
import { getTheme } from './constants/theme';

const Tab = createBottomTabNavigator();
const COUNTDOWN_START = 15;
const ANNOUNCE_SECONDS = new Set([10, 5, 4, 3, 2, 1]);

// We map the Feather names to closest MaterialIcons to match the Neo-Brutalist 
// 'Material Symbols Outlined' aesthetic requested, using what's bundled in expo/vector-icons.
const ICON_MAP = {
  mic: 'mic-none',
  camera: 'camera-alt',
  navigation: 'navigation',
  database: 'storage',
  'book-open': 'menu-book',
  settings: 'settings',
};

const TabIcon = ({ name, focused, color }) => (
  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    <MaterialIcons name={ICON_MAP[name] || name} size={focused ? 28 : 24} color={color} />
  </View>
);

function AppShell() {
  const { sosEnabled, hapticEnabled, speechRate, theme: themeMode } = useSettings();
  const [sosVisible, setSosVisible] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [isSending, setIsSending] = useState(false);
  const theme = getTheme(themeMode);

  const countdownRef = useRef(null);
  const dismissedRef = useRef(false);
  const sosActiveRef = useRef(false);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const handleDismiss = useCallback(() => {
    dismissedRef.current = true;
    sosActiveRef.current = false;
    clearCountdown();
    setSosVisible(false);
    setIsSending(false);
    setCountdown(COUNTDOWN_START);

    if (hapticEnabled) {
      playHapticPattern('stop');
    }
    Speech.stop();
    Speech.speak('Alert dismissed.', { rate: speechRate });
  }, [clearCountdown, hapticEnabled, speechRate]);

  const handleSosSend = useCallback(async () => {
    if (dismissedRef.current) return;

    sosActiveRef.current = false;
    setIsSending(true);

    try {
      const locationMessage = await getLocationMessage();
      await sendEmergencyAlert(locationMessage);
    } catch (err) {
      console.warn('SOS send error:', err);
      Speech.stop();
      Speech.speak('Emergency alert failed. Please call for help manually.');
      if (hapticEnabled) {
        playHapticPattern('error');
      }
    } finally {
      setSosVisible(false);
      setIsSending(false);
      setCountdown(COUNTDOWN_START);
    }
  }, [hapticEnabled]);

  const startCountdown = useCallback(() => {
    clearCountdown();
    dismissedRef.current = false;
    setCountdown(COUNTDOWN_START);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 1;

        if (ANNOUNCE_SECONDS.has(next)) {
          Speech.stop();
          Speech.speak(String(next), { rate: speechRate });
        }

        if (next <= 0) {
          clearCountdown();
          if (!dismissedRef.current) {
            handleSosSend();
          }
          return 0;
        }

        return next;
      });
    }, 1000);
  }, [clearCountdown, handleSosSend, speechRate]);

  const handleFallDetected = useCallback(() => {
    if (sosActiveRef.current) return;

    sosActiveRef.current = true;
    setSosVisible(true);
    setIsSending(false);
    setCountdown(COUNTDOWN_START);

    Speech.stop();
    Speech.speak(
      'Fall detected. Tap anywhere if you are okay. Sending alert in 15 seconds.',
      { rate: speechRate }
    );

    if (hapticEnabled) {
      playHapticPattern('sos');
    }

    startCountdown();
  }, [hapticEnabled, speechRate, startCountdown]);

  const onFallRef = useRef(handleFallDetected);
  onFallRef.current = handleFallDetected;

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (sosEnabled) {
      startFallDetection(() => onFallRef.current());
    } else {
      stopFallDetection();
    }
    return () => stopFallDetection();
  }, [sosEnabled]);

  useEffect(() => () => clearCountdown(), [clearCountdown]);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} backgroundColor={theme.background} />
        <NavigationContainer ref={navigationRef}>
          <Tab.Navigator
            screenOptions={{
              headerStyle: { 
                backgroundColor: theme.surface, 
                borderBottomWidth: 4, 
                borderBottomColor: theme.border,
                shadowColor: 'transparent',
                elevation: 0,
              },
              animation: 'shift', // Add subtle screen transition animation
              headerTintColor: theme.primary,
              headerTitleStyle: { 
                fontSize: 24, 
                fontFamily: 'Anybody_800ExtraBold', 
                letterSpacing: 0,
                textTransform: 'uppercase'
              },
              tabBarStyle: {
                backgroundColor: theme.surfaceContainerLow,
                borderTopWidth: 4,
                borderTopColor: theme.border,
                height: 80,
                paddingBottom: 10,
                paddingTop: 10,
              },
              tabBarLabelStyle: {
                fontSize: 12,
                fontFamily: 'SpaceMono_700Bold',
                color: theme.onBackground,
              },
              tabBarActiveTintColor: theme.primary,
              tabBarInactiveTintColor: theme.onBackground + '80',
            }}
          >
            <Tab.Screen
              name="Assistant"
              component={HomeScreen}
              options={{
                title: 'VisionVoice',
                tabBarLabel: 'Assistant',
                tabBarIcon: ({ focused, color }) => (
                  <TabIcon name="mic" focused={focused} color={color} />
                ),
                tabBarAccessibilityLabel: 'AI Assistant tab',
                headerShown: false, // HomeScreen has custom header
              }}
            />
            <Tab.Screen
              name="Camera"
              component={CameraScreen}
              options={{
                title: 'Camera',
                tabBarIcon: ({ focused, color }) => (
                  <TabIcon name="camera" focused={focused} color={color} />
                ),
                tabBarAccessibilityLabel: 'Camera and scene description tab',
                headerShown: false, // CameraScreen has full screen feed
              }}
            />
            <Tab.Screen
              name="Navigation"
              component={NavigationScreen}
              options={{
                title: 'Navigation',
                tabBarLabel: 'Navigate',
                tabBarIcon: ({ focused, color }) => (
                  <TabIcon name="navigation" focused={focused} color={color} />
                ),
                tabBarAccessibilityLabel: 'Navigation and walking directions tab',
              }}
            />
            <Tab.Screen
              name="Memory"
              component={MemoryScreen}
              options={{
                title: 'MEMORY LOG',
                tabBarLabel: 'Memory',
                tabBarIcon: ({ focused, color }) => (
                  <TabIcon name="database" focused={focused} color={color} />
                ),
                tabBarAccessibilityLabel: 'Memory log tab',
              }}
            />
            <Tab.Screen
              name="Learn"
              component={LearnScreen}
              options={{
                title: 'Learn',
                tabBarLabel: 'Learn',
                tabBarIcon: ({ focused, color }) => (
                  <TabIcon name="book-open" focused={focused} color={color} />
                ),
                tabBarAccessibilityLabel: 'Learning and study notes tab',
              }}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                title: 'Settings',
                tabBarIcon: ({ focused, color }) => (
                  <TabIcon name="settings" focused={focused} color={color} />
                ),
                tabBarAccessibilityLabel: 'Settings tab',
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
        <GlobalVoiceRail />
        <SOSModal
          visible={sosVisible}
          countdown={countdown}
          onDismiss={handleDismiss}
          isSending={isSending}
          themeMode={themeMode}
        />
      </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Anybody_700Bold,
    Anybody_800ExtraBold,
    Anybody_900Black,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fbf8ff', alignItems: 'center', justifyContent: 'center' }}>
        <WaveformLoader size="large" color="#0040e0" />
      </View>
    );
  }

  return (
    <SettingsProvider>
      <VoiceProvider>
        <AppShell />
      </VoiceProvider>
    </SettingsProvider>
  );
}
