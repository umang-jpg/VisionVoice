import { Linking } from 'react-native';
import * as Speech from 'expo-speech';

/**
 * Normalizes a phone number by removing all non-digit characters except leading +.
 * @param {string} phone - raw number string
 * @returns {string} normalized number
 */
function normalizePhone(phone) {
  return (phone || '').replace(/[^\d+]/g, '');
}

/**
 * Opens the phone dialer pre-filled with the saved volunteer number.
 * Never throws. Does not place the call automatically — user must tap
 * the call button in their phone's dialer UI; this is an OS-level
 * restriction on both iOS and Android, not a limitation to work around.
 * @param {string} volunteerNumber - raw number string from settings
 */
export async function callVolunteer(volunteerNumber) {
  const number = normalizePhone(volunteerNumber);

  if (!number) {
    Speech.stop();
    Speech.speak('No volunteer number is set. Add one in Settings.');
    return;
  }

  Speech.stop();
  Speech.speak('Opening your phone to call your volunteer.');

  try {
    await Linking.openURL(`tel:${number}`);
  } catch (err) {
    console.warn('Volunteer call error:', err);
    Speech.speak('Could not open the phone dialer.');
  }
}
