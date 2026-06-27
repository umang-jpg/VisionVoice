import * as Location from 'expo-location';

/**
 * Request foreground location permission once at startup.
 * Never throws — returns boolean granted status.
 */
export async function requestLocationPermission() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('Location permission error:', err);
    return false;
  }
}

/**
 * Fetch a short location string for emergency messages.
 * Returns Google Maps link when available, otherwise a safe fallback.
 */
export async function getLocationMessage() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      return 'Location unavailable';
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = location.coords;
    return `Location: https://maps.google.com/?q=${latitude},${longitude}`;
  } catch (err) {
    console.warn('Location fetch error:', err);
    return 'Location unavailable';
  }
}
