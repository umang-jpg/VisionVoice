import { Linking } from 'react-native';
import * as SMS from 'expo-sms';
import * as Speech from 'expo-speech';
import { getSosConfig } from './sosConfig';
import { playHapticPattern } from './haptics';

function buildEmergencyMessage(locationMessage) {
  const { userName, age, bloodGroup } = getSosConfig();
  return (
    `VisionVoice SOS: ${userName} may need help and did not dismiss the fall alert. ` +
    `Age: ${age}. Blood group: ${bloodGroup}. ${locationMessage}`
  );
}

function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Open prefilled SMS composer and dial primary emergency contact.
 * MVP only — does not silently send SMS.
 */
export async function sendEmergencyAlert(locationMessage) {
  const config = getSosConfig();
  const message = buildEmergencyMessage(locationMessage);
  const numbers = config.emergencyContacts.map((c) => c.phone);
  const primary = normalizePhone(config.primaryContact.phone);

  Speech.stop();
  Speech.speak('Sending emergency alert.');

  try {
    const available = await SMS.isAvailableAsync();
    if (available) {
      await SMS.sendSMSAsync(numbers, message);
    } else {
      Speech.speak('SMS is not available on this device. Opening phone dialer.');
      await playHapticPattern('error');
    }
  } catch (err) {
    console.warn('SMS error:', err);
    Speech.speak('Could not open messages. Opening phone dialer.');
    await playHapticPattern('error');
  }

  try {
    await Linking.openURL(`tel:${primary}`);
  } catch (err) {
    console.warn('Dialer error:', err);
    Speech.speak('Could not open phone dialer.');
    await playHapticPattern('error');
  }
}
