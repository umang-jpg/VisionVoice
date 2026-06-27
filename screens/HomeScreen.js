import React, { useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useVoice } from '../context/VoiceContext';
import { useSettings } from '../context/SettingsContext';
import { getTheme, getShadows } from '../constants/theme';
import WaveformLoader from '../components/WaveformLoader';
import AnimatedBackground from '../components/AnimatedBackground';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { recordingState, messages, startListening, stopListening, clearConversation } = useVoice();
  const { theme: themeMode } = useSettings();
  
  const theme = getTheme(themeMode);
  const shadows = getShadows(theme);
  const styles = useMemo(() => createStyles(theme, shadows), [theme, shadows]);
  const scrollRef = useRef(null);

  const isListening = recordingState === 'listening';
  const isProcessing = recordingState === 'processing';
  const isIdle = recordingState === 'idle';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [messages, recordingState]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AnimatedBackground theme={theme} themeMode={themeMode} />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="visibility" size={28} color={theme.primary} />
          <Text style={styles.headerTitle}>VISIONVOICE</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {messages.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={clearConversation}
              accessible
              accessibilityLabel="Clear conversation"
              accessibilityRole="button"
            >
              <Feather name="trash-2" size={24} color={theme.semantic.danger} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Settings')}
            accessible
            accessibilityLabel="Settings"
            accessibilityRole="button"
          >
            <Feather name="settings" size={24} color={theme.onBackground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Tap the mic to chat, or use tabs for Camera and Navigation.</Text>
          </View>
        ) : (
          messages.map((msg, idx) => (
            <AnimatedMessageBubble 
              key={idx} 
              msg={msg} 
              isUser={msg.role === 'user'} 
              theme={theme} 
              styles={styles} 
              shadows={shadows} 
            />
          ))
        )}

        {isProcessing && (
          <View style={styles.processingBox} accessible accessibilityLabel="Thinking">
            <WaveformLoader size="small" color={theme.onBackground} />
            <Text style={styles.processingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function AnimatedMessageBubble({ msg, isUser, theme, styles, shadows }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0], // slight upward translation
  });

  return (
    <Animated.View 
      style={[
        styles.bubble, 
        isUser ? styles.userBubble : styles.botBubble,
        shadows.neoSm,
        { opacity: anim, transform: [{ translateY }] }
      ]}
      accessible
      accessibilityLabel={`${isUser ? 'You' : 'Assistant'} said: ${msg.text}`}
    >
      <Text style={[styles.bubbleRole, { color: isUser ? theme.primary : theme.onBackground }]}>
        {isUser ? 'YOU' : 'VISIONVOICE'}
      </Text>
      <Text style={styles.bubbleText}>{msg.text}</Text>
    </Animated.View>
  );
}

function createStyles(theme, shadows) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 4,
      borderBottomColor: theme.border,
      zIndex: 10,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 24,
      fontFamily: 'Anybody_800ExtraBold',
      color: theme.primary,
      letterSpacing: -0.5,
    },
    settingsBtn: {
      minHeight: 60,
      minWidth: 60,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    content: {
      padding: 16,
    },
    emptyBox: {
      padding: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 60,
    },
    emptyText: {
      fontSize: 18,
      fontFamily: 'SpaceMono_400Regular',
      color: theme.semantic.neutral,
      textAlign: 'center',
      lineHeight: 26,
    },
    bubble: {
      padding: 16,
      marginBottom: 16,
      borderWidth: 4,
      borderColor: theme.border,
      borderRadius: 0,
      width: '90%',
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: theme.surfaceContainerLow,
      borderRightWidth: 8,
      borderRightColor: theme.primary,
    },
    botBubble: {
      alignSelf: 'flex-start',
      backgroundColor: theme.surface,
      borderLeftWidth: 8,
      borderLeftColor: theme.onBackground,
    },
    bubbleRole: {
      fontSize: 12,
      fontFamily: 'SpaceMono_700Bold',
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    bubbleText: {
      fontSize: 16,
      fontFamily: 'SpaceMono_400Regular',
      color: theme.onBackground,
      lineHeight: 24,
    },
    processingBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
    },
    processingText: {
      fontSize: 14,
      fontFamily: 'SpaceMono_700Bold',
      color: theme.onBackground,
    },
    clearBtn: {
      minHeight: 60,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
