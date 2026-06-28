import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSosConfig, updateSosConfig as updateSosConfigService } from '../services/sosConfig';

const SettingsContext = createContext(null);
const STORAGE_KEY = '@visionvoice_settings';

export function SettingsProvider({ children }) {
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(0.9);
  const [sosEnabled, setSosEnabled] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [sosProfile, setSosProfile] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Load settings
        const settingsVal = await AsyncStorage.getItem(STORAGE_KEY);
        if (settingsVal) {
          const parsed = JSON.parse(settingsVal);
          if (parsed.hapticEnabled !== undefined) setHapticEnabled(parsed.hapticEnabled);
          if (parsed.speechRate !== undefined) setSpeechRate(parsed.speechRate);
          if (parsed.sosEnabled !== undefined) setSosEnabled(parsed.sosEnabled);
          if (parsed.theme !== undefined) setTheme(parsed.theme);
        }
        
        // Load SOS profile
        const sos = await loadSosConfig();
        setSosProfile(sos);
      } catch (e) {
        console.warn('Error loading settings:', e);
      }
      setIsLoaded(true);
    })();
  }, []);

  const saveSettings = (newSettings) => {
    const current = { hapticEnabled, speechRate, sosEnabled, theme, ...newSettings };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  };

  const updateHaptic = (val) => { setHapticEnabled(val); saveSettings({ hapticEnabled: val }); };
  const updateSpeechRate = (val) => { setSpeechRate(val); saveSettings({ speechRate: val }); };
  const updateSos = (val) => { setSosEnabled(val); saveSettings({ sosEnabled: val }); };
  const updateTheme = (val) => { setTheme(val); saveSettings({ theme: val }); };
  
  const updateSosProfile = async (updates) => {
    const updated = await updateSosConfigService(updates);
    setSosProfile(updated);
  };

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
        sosProfile,
        updateSosProfile,
      }}
    >
      {isLoaded ? children : null}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
