import React, { useEffect, useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
} from 'react-native';
import { getTheme, getShadows } from '../constants/theme';

/**
 * SOSModal — Neo-brutalist emergency alert.
 *
 * Accessibility-first design for blind users:
 * The ENTIRE screen is one tap target — touching anywhere dismisses
 * the alert and cancels sending. No small buttons to hunt for.
 *
 * Props:
 *   visible       — boolean
 *   countdown     — number (seconds remaining)
 *   onDismiss     — () => void  — called on ANY tap (dismisses + cancels)
 *   isSending     — boolean     — true after countdown hits 0
 *   themeMode     — 'light' | 'dark'
 */
export default function SOSModal({
  visible,
  countdown,
  onDismiss,
  isSending,
  themeMode,
}) {
  const theme = getTheme(themeMode);
  const shadows = getShadows(theme);

  // Fast entrance — snappy for an emergency context
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 170,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  const dangerColor = theme.semantic.danger;
  const bg = theme.background;
  const border = theme.border;
  const onBg = theme.onBackground;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      {/*
        ── FULL-SCREEN TAP TARGET ─────────────────────────────
        The entire overlay is a single Pressable.
        Blind users do not need to find a button — any touch
        on any part of the screen dismisses the alert.
      */}
      <Pressable
        style={[styles.overlay, { backgroundColor: dangerColor + 'F0' }]}
        onPress={onDismiss}
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          isSending
            ? 'Sending emergency alert. Tap anywhere to cancel.'
            : `Fall detected. Sending alert in ${countdown} seconds. Tap anywhere if you are okay.`
        }
        accessibilityHint="Tap anywhere on the screen to cancel the emergency alert"
        accessibilityLiveRegion="assertive"
      >
        {/* Card — purely visual, pointerEvents="none" so taps pass through to overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.card,
            {
              backgroundColor: bg,
              borderColor: border,
              ...shadows.neo,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* ── Danger headline band ───────────────── */}
          <View
            style={[
              styles.headlineBand,
              { backgroundColor: dangerColor, borderBottomColor: border },
            ]}
          >
            <Text
              style={[styles.headline, { color: bg }]}
              accessibilityRole="header"
            >
              FALL DETECTED
            </Text>
          </View>

          {/* ── Body ──────────────────────────────── */}
          <View style={styles.body}>
            {!isSending ? (
              <>
                {/* Giant countdown number */}
                <Text
                  style={[
                    styles.countdown,
                    { color: dangerColor, borderColor: border },
                  ]}
                >
                  {countdown}
                </Text>

                <Text style={[styles.subtext, { color: onBg }]}>
                  seconds until alert is sent
                </Text>

                {/* Instruction — large, clear, central */}
                <View
                  style={[
                    styles.instructionBox,
                    { borderColor: dangerColor, backgroundColor: dangerColor + '18' },
                  ]}
                >
                  <Text style={[styles.instruction, { color: dangerColor }]}>
                    TAP ANYWHERE
                  </Text>
                  <Text style={[styles.instructionSub, { color: onBg }]}>
                    if you are okay
                  </Text>
                </View>
              </>
            ) : (
              /* ── Sending state ──────────────────── */
              <View style={styles.sendingBox}>
                <Text style={[styles.sendingText, { color: onBg }]}>
                  Sending emergency alert…
                </Text>
                <Text style={[styles.sendingSubtext, { color: theme.semantic.neutral }]}>
                  Please stay calm.{'\n'}Help is on the way.
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Full-screen tap zone — covers the entire display
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Neo-brutalist card — 4px border, zero radius, hard shadow
  card: {
    width: '100%',
    borderWidth: 4,
    borderRadius: 0,
    overflow: 'hidden',
  },

  // Full-width danger-colour headline strip
  headlineBand: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 4,
    alignItems: 'center',
  },
  headline: {
    fontSize: 32,
    fontFamily: 'Anybody_800ExtraBold',
    letterSpacing: 2,
    textAlign: 'center',
  },

  body: {
    padding: 28,
    alignItems: 'center',
  },

  // Big countdown — visually dominant
  countdown: {
    fontSize: 96,
    fontFamily: 'SpaceMono_700Bold',
    lineHeight: 100,
    textAlign: 'center',
    borderWidth: 4,
    borderRadius: 0,
    paddingHorizontal: 28,
    paddingVertical: 8,
    marginBottom: 14,
    minWidth: 130,
  },

  subtext: {
    fontSize: 16,
    fontFamily: 'SpaceMono_400Regular',
    textAlign: 'center',
    marginBottom: 28,
  },

  // "TAP ANYWHERE" instruction box — large, high-contrast
  instructionBox: {
    width: '100%',
    borderWidth: 4,
    borderRadius: 0,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  instruction: {
    fontSize: 26,
    fontFamily: 'Anybody_800ExtraBold',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 6,
  },
  instructionSub: {
    fontSize: 16,
    fontFamily: 'SpaceMono_400Regular',
    textAlign: 'center',
  },

  // Sending state
  sendingBox: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  sendingText: {
    fontSize: 20,
    fontFamily: 'SpaceMono_700Bold',
    textAlign: 'center',
    marginBottom: 14,
  },
  sendingSubtext: {
    fontSize: 16,
    fontFamily: 'SpaceMono_400Regular',
    textAlign: 'center',
    lineHeight: 26,
  },
});
