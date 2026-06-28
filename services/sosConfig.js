/**
 * Emergency profile management — loads from AsyncStorage, falls back to defaults.
 * Use getSosConfig() to get the current profile.
 * Use updateSosConfig() to modify it (called from SettingsScreen).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SOS_STORAGE_KEY = '@visionvoice_sos_config';

const DEFAULT_SOS_CONFIG = {
  userName: 'UMANG PAWAR',
  age: 30,
  bloodGroup: 'O+',
  emergencyContacts: [
    { name: 'Umangs dad', phone: '+919823175051' },
  ],
};

let cachedConfig = null;

export async function loadSosConfig() {
  try {
    const stored = await AsyncStorage.getItem(SOS_STORAGE_KEY);
    if (stored) {
      cachedConfig = JSON.parse(stored);
      return cachedConfig;
    }
  } catch (e) {
    console.warn('Failed to load SOS config:', e);
  }
  cachedConfig = DEFAULT_SOS_CONFIG;
  return cachedConfig;
}

export function getSosConfig() {
  if (!cachedConfig) {
    cachedConfig = DEFAULT_SOS_CONFIG;
  }
  return {
    ...cachedConfig,
    primaryContact: cachedConfig.emergencyContacts[0],
  };
}

export async function updateSosConfig(updates) {
  try {
    const current = cachedConfig || DEFAULT_SOS_CONFIG;
    const updated = { ...current, ...updates };
    cachedConfig = updated;
    await AsyncStorage.setItem(SOS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to save SOS config:', e);
    return cachedConfig;
  }
}

export default DEFAULT_SOS_CONFIG;
