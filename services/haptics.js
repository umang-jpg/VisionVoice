import * as Haptics from 'expo-haptics';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Haptic pattern library for VisionVoice
 * Each pattern has a distinct rhythm that users can learn to recognize
 */
export const HAPTIC_PATTERNS = {
  // ── App interactions ──────────────────────────────────────────
  start: {
    label: 'Listening',
    description: 'One medium tap — app is listening',
    play: async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
  },

  stop: {
    label: 'Stopped',
    description: 'Two quick light taps — recording stopped',
    play: async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await delay(100);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  },

  response: {
    label: 'AI Response',
    description: 'Success pulse — AI has responded',
    play: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  },

  error: {
    label: 'Error',
    description: 'Error notification pattern',
    play: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  },

  // ── Alerts ────────────────────────────────────────────────────
  message: {
    label: 'New Message',
    description: 'Wave pattern — light, medium, light',
    play: async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await delay(80);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await delay(80);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  },

  warning: {
    label: 'Warning',
    description: 'Three heavy taps — pay attention',
    play: async () => {
      for (let i = 0; i < 3; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        if (i < 2) await delay(180);
      }
    },
  },

  // ── Navigation ────────────────────────────────────────────────
  navigationTurn: {
    label: 'Turn Ahead',
    description: 'Soft then heavy — turn coming up',
    play: async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await delay(250);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
  },

  navigationArrived: {
    label: 'Arrived',
    description: 'Three ascending taps — you have arrived',
    play: async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await delay(120);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await delay(120);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
  },

  navTurnLeft: {
    label: 'Turn Left',
    description: 'Two heavy taps — turn left',
    play: async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(200);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
  },

  navTurnRight: {
    label: 'Turn Right',
    description: 'Light, heavy, light — turn right',
    play: async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await delay(120);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(120);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  },

  navContinue: {
    label: 'Continue Straight',
    description: 'Single medium tap — keep going straight',
    play: async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
  },

  // ── Emergency ─────────────────────────────────────────────────
  sos: {
    label: 'SOS',
    description: 'Morse SOS pattern — S-O-S (· · · — — — · · ·)',
    play: async () => {
      const short = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await delay(150);
      };
      const long = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await delay(400);
      };

      // S (· · ·)
      await short(); await short(); await short();
      await delay(300);
      // O (— — —)
      await long(); await long(); await long();
      await delay(300);
      // S (· · ·)
      await short(); await short(); await short();
    },
  },

  hazard: {
    label: 'Hazard Detected',
    description: 'Rapid double pulses — immediate danger nearby',
    play: async () => {
      for (let i = 0; i < 3; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await delay(100);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await delay(300);
      }
    },
  },
};

/**
 * Play a haptic pattern by key
 * @param {'start'|'stop'|'response'|'error'|'message'|'warning'|'navigationTurn'|'navigationArrived'|'sos'|'hazard'} key
 */
export async function playHapticPattern(key) {
  const pattern = HAPTIC_PATTERNS[key];
  if (!pattern) {
    await Haptics.selectionAsync();
    return;
  }
  try {
    await pattern.play();
  } catch (err) {
    console.warn('Haptic error:', err);
  }
}
