import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useVoice } from '../context/VoiceContext';

const { width, height } = Dimensions.get('window');

// Helper to get 3 dark/custom shades of blue depending on the theme mode
const getCustomBlues = (mode) => {
  if (mode === 'dark') {
    return {
      blue1: '#071638', // Deep Navy
      blue2: '#112966', // Midnight Blue
      blue3: '#224394', // Medium Dark Blue
    };
  } else {
    return {
      blue1: '#0a225c', // Deep Navy
      blue2: '#163b8c', // Midnight Blue
      blue3: '#2a5bbd', // Royal Blue
    };
  }
};

export default function AnimatedBackground({ theme, themeMode }) {
  const { recordingState } = useVoice();

  // We use 3 animated values for loop animations
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;
  
  const colorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let toValue = 0;
    if (recordingState === 'listening') toValue = 1;
    else if (recordingState === 'processing') toValue = 2;

    Animated.timing(colorAnim, {
      toValue,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [recordingState, colorAnim]);

  useEffect(() => {
    const createAnim = (anim, duration) => {
      return Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration,
          useNativeDriver: false, // must match — can't mix with JS-driven color on same node
        })
      );
    };

    const a1 = createAnim(anim1, 35000);
    const a2 = createAnim(anim2, 50000);
    const a3 = createAnim(anim3, 65000);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [anim1, anim2, anim3]);

  // Retrieve custom blues
  const blues = getCustomBlues(themeMode);

  // Interpolate colors for each shape. In recording states, they transition to danger/success colors.
  const animatedColor1 = colorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [blues.blue1, theme.semantic.danger, theme.semantic.success],
  });

  const animatedColor2 = colorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [blues.blue2, theme.semantic.danger, theme.semantic.success],
  });

  const animatedColor3 = colorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [blues.blue3, theme.semantic.danger, theme.semantic.success],
  });

  const animatedColor4 = colorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [theme.primary, theme.semantic.danger, theme.semantic.success],
  });

  const animatedColor5 = colorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [blues.blue2, theme.semantic.danger, theme.semantic.success],
  });

  // Rotation interpolations
  const rotate1 = anim1.interpolate({ inputRange: [0, 1], outputRange: ['45deg', '405deg'] }); // Diamond offset
  const rotate2 = anim2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });   // Reverse
  const rotate3 = anim3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotate4 = anim1.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '450deg'] });   // Triangle offset
  const rotate5 = anim3.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });   // Circle offset reverse

  // Scale interpolations
  const scale1 = anim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.2, 1] });
  const scale2 = anim2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 1] });
  const scale3 = anim3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] });

  // Base opacity
  const baseOpacity = themeMode === 'dark' ? 0.10 : 0.15;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Shape 1: Diamond (Rotated Square, Solid Fill) */}
      <Animated.View
        style={[
          styles.shape,
          {
            backgroundColor: animatedColor1,
            opacity: baseOpacity,
            width: width * 1.3,
            height: width * 1.3,
            top: -width * 0.4,
            left: -width * 0.2,
            transform: [{ rotate: rotate1 }, { scale: scale1 }],
            borderRadius: 0,
          },
        ]}
      />
      
      {/* Shape 2: Circle Ring (Outline Only) */}
      <Animated.View
        style={[
          styles.shape,
          {
            borderColor: animatedColor2,
            borderWidth: 8,
            opacity: baseOpacity * 1.5,
            width: width * 0.9,
            height: width * 0.9,
            borderRadius: (width * 0.9) / 2,
            bottom: -width * 0.2,
            right: -width * 0.3,
            transform: [{ rotate: rotate2 }, { scale: scale2 }],
          },
        ]}
      />
      
      {/* Shape 3: Offset Rectangle (Solid Fill) */}
      <Animated.View
        style={[
          styles.shape,
          {
            backgroundColor: animatedColor3,
            opacity: baseOpacity * 0.8,
            width: width * 1.2,
            height: width * 0.6,
            top: height * 0.4,
            left: -width * 0.3,
            transform: [{ rotate: rotate3 }, { scale: scale3 }],
            borderRadius: 0,
          },
        ]}
      />

      {/* Shape 4: Triangle (Border-based shape, Container animated) */}
      <Animated.View
        style={[
          styles.shapeContainer,
          {
            top: height * 0.15,
            right: -width * 0.15,
            width: width * 0.4,
            height: width * 0.4,
            opacity: baseOpacity * 0.7,
            transform: [{ rotate: rotate4 }, { scale: scale1 }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.triangle,
            {
              borderLeftWidth: width * 0.2,
              borderRightWidth: width * 0.2,
              borderBottomWidth: width * 0.32,
              borderBottomColor: animatedColor4,
            },
          ]}
        />
      </Animated.View>

      {/* Shape 5: Small Circle (Solid Fill) */}
      <Animated.View
        style={[
          styles.shape,
          {
            backgroundColor: animatedColor5,
            opacity: baseOpacity * 0.9,
            width: width * 0.4,
            height: width * 0.4,
            borderRadius: (width * 0.4) / 2,
            bottom: height * 0.15,
            left: width * 0.2,
            transform: [{ rotate: rotate5 }, { scale: scale3 }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shape: {
    position: 'absolute',
  },
  shapeContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
