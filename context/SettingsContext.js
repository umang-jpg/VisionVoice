import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsContext = createContext(null);
const STORAGE_KEY = '@visionvoice_settings';

export function SettingsProvider({ children }) {
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(0.9);
  const [sosEnabled, setSosEnabled] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (parsed.hapticEnabled !== undefined) setHapticEnabled(parsed.hapticEnabled);
          if (parsed.speechRate !== undefined) setSpeechRate(parsed.speechRate);
          if (parsed.sosEnabled !== undefined) setSosEnabled(parsed.sosEnabled);
          if (parsed.theme !== undefined) setTheme(parsed.theme);
        } catch (e) {}
      }
      setIsLoaded(true);
    });
  }, []);

  const saveSettings = (newSettings) => {
    const current = { hapticEnabled, speechRate, sosEnabled, theme, ...newSettings };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  };

  const updateHaptic = (val) => { setHapticEnabled(val); saveSettings({ hapticEnabled: val }); };
  const updateSpeechRate = (val) => { setSpeechRate(val); saveSettings({ speechRate: val }); };
  const updateSos = (val) => { setSosEnabled(val); saveSettings({ sosEnabled: val }); };
  const updateTheme = (val) => { setTheme(val); saveSettings({ theme: val }); };

  return (
    <SettingsContext.Provider
      value={{
        hapticEnabled,
        setHapticEnabled: updateHaptic,
        speechRate,
        setSpeechRate: updateSpeechRate,
        sosEnabled,
        setSosEnabled: updateSos,
        theme,
        setTheme: updateTheme,
      }}
    >
      {isLoaded ? children : null}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
