import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useVoice } from '../context/VoiceContext';
import { useSettings } from '../context/SettingsContext';
import { getTheme, getShadows } from '../constants/theme';
import WaveformLoader from './WaveformLoader';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── State-based colour palettes ──────────────────────────────────────────────
const PALETTE = {
  idle: {
    glow1:    '#0a1a4a',   // deep navy — dim pulse phase
    glow2:    '#1e4dff',   // rich blue — bright pulse phase
    border:   '#4c7cff',   // border ring
    shimmer:  'rgba(180, 210, 255, 0.22)', // cool white-blue shimmer band
  },
  listening: {
    glow1:    '#3b0000',
    glow2:    '#ff4500',
    border:   '#ec4e20',
    shimmer:  'rgba(255, 180, 150, 0.20)',
  },
  processing: {
    glow1:    '#052e16',
    glow2:    '#16a34a',
    border:   '#4ade80',
    shimmer:  'rgba(150, 255, 190, 0.18)',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MagicGlow — the visual effect layer
//
// Two independent animations, zero new packages:
//
// [1] BREATHING GLOW RING  (JS thread)
//     An Animated.View with StyleSheet.absoluteFillObject traces the full
//     perimeter of the rail via borderColor + shadowColor/shadowRadius.
//     One continuous ring — no corners to gap, no strips to misalign.
//     Pulses slowly: dim → bright → dim, 2 s per cycle.
//
// [2] DIAGONAL SHIMMER SWEEP  (native thread — pure translateX)
//     A bright, slightly transparent band, skewed ~22° via CSS-style rotation,
//     clipped by the parent's overflow:hidden. Sweeps left→right every 2.8 s
//     then pauses, exactly like Gemini / Apple Pay card shimmer.
//     Zero JS cost after the animation starts (useNativeDriver: true).
// ─────────────────────────────────────────────────────────────────────────────
function MagicGlow({ state, railH }) {
  const glowAnim   = useRef(new Animated.Value(0)).current; // 0=dim 1=bright
  const shimmerAnim = useRef(new Animated.Value(0)).current; // 0=offscreen-left 1=offscreen-right

  const pal = PALETTE[state] || PALETTE.idle;

  // ── [1] Breathing glow ring — JS thread ───────────────────────────────────
  useEffect(() => {
    glowAnim.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [glowAnim, state]);

  // ── [2] Shimmer sweep — native thread ─────────────────────────────────────
  useEffect(() => {
    shimmerAnim.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        // Fast sweep across the full width
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // Pause before next sweep — feels unhurried & premium
        Animated.delay(2100),
        // Reset position instantly (setValue not allowed inside loop,
        // so reset via a 0-duration timing)
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerAnim, state]);

  // Breathing glow interpolations
  const borderColor   = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [pal.glow1, pal.border] });
  const shadowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.0] });
  const shadowRadius  = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 20] });

  // Shimmer band translates from -SCREEN_W (left edge) to +SCREEN_W (right edge)
  const shimmerX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_W * 0.55, SCREEN_W * 1.1],
  });

  // Shimmer band height needs to cover the full rail height even after rotation
  const shimmerH = (railH || 80) * 3;

  return (
    // pointerEvents="none" — touch falls through to the rail TouchableOpacity
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>

      {/* ── [1] Breathing border ring ──────────────────────────────────── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderWidth: 2.5,
            borderColor,
            // iOS shadow bloom
            shadowColor: pal.glow2,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity,
            shadowRadius,
            // Android elevation (solid, not colour-animated, but opacity pulse still works)
            elevation: 10,
          },
        ]}
      />

      {/* ── [2] Diagonal shimmer sweep ─────────────────────────────────── */}
      {/*
        The band is a tall (~railH×3) narrow rectangle rotated 22° so its edges
        run diagonally across the rail. translateX sweeps it across the full width.
        overflow:hidden on the parent (rail) clips it to exact rail bounds.
      */}
      <Animated.View
        style={{
          position: 'absolute',
          // Vertically centre the tall band so it covers top-to-bottom after rotation
          top: -(shimmerH / 2) + (railH || 80) / 2,
          left: 0,
          width: SCREEN_W * 0.28,   // band width before rotation (~quarter of screen)
          height: shimmerH,
          backgroundColor: pal.shimmer,
          transform: [
            { rotate: '22deg' },
            { translateX: shimmerX },
          ],
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function GlobalVoiceRail() {
  const { recordingState, startListening, stopListening } = useVoice();
  const { theme: themeMode } = useSettings();
  const theme   = getTheme(themeMode);
  const shadows = getShadows(theme);
  const insets  = useSafeAreaInsets();
  const [railH, setRailH] = useState(72);

  const styles = useMemo(() => createStyles(theme, shadows), [theme, shadows]);

  const handlePress = () => {
    if (recordingState === 'idle')      startListening();
    else if (recordingState === 'listening') stopListening();
  };

  let titleText = 'TAP TO SPEAK';
  let iconName  = 'mic';
  let iconColor = theme.onPrimary;
  let railBg    = theme.primary;
  let glowState = 'idle';

  if (recordingState === 'listening') {
    titleText = 'LISTENING...';
    iconName  = 'square';
    railBg    = theme.semantic.danger;
    glowState = 'listening';
  } else if (recordingState === 'processing') {
    titleText = 'THINKING...';
    railBg    = theme.semantic.success;
    glowState = 'processing';
  }

  const insetBottom = Math.max(insets.bottom, 16);

  return (
    <TouchableOpacity
      style={[styles.rail, { paddingBottom: insetBottom, backgroundColor: railBg }]}
      onPress={handlePress}
      disabled={recordingState === 'processing'}
      accessible
      accessibilityRole="button"
      accessibilityLabel={
        recordingState === 'processing'
          ? 'Processing your command'
          : recordingState === 'listening'
          ? 'Listening. Tap to stop and send.'
          : 'Tap to start voice command'
      }
      accessibilityState={{
        busy:     recordingState === 'processing',
        expanded: recordingState === 'listening',
      }}
      onLayout={(e) => setRailH(e.nativeEvent.layout.height)}
    >
      {/* Glow effect behind rail content */}
      <MagicGlow state={glowState} railH={railH} />

      {/* Rail content */}
      <View style={styles.content}>
        {recordingState === 'processing' ? (
          <WaveformLoader size="small" color={theme.onPrimary} />
        ) : (
          <Feather name={iconName} size={28} color={iconColor} />
        )}
        <Text style={[styles.text, { color: theme.onPrimary }]}>
          {titleText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(theme, shadows) {
  return StyleSheet.create({
    rail: {
      paddingTop: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      overflow: 'hidden', // clips shimmer band to exact rail bounds
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 50,
    },
    text: {
      fontSize: 18,
      fontFamily: 'Anybody_800ExtraBold',
      marginLeft: 12,
    },
  });
}
