import React, { createContext, useState, useRef, useCallback, useContext, useEffect } from 'react';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as Speech from 'expo-speech';
import { AccessibilityInfo } from 'react-native';
import { transcribeAudio, chat } from '../services/ai';
import { playHapticPattern } from '../services/haptics';
import { useSettings } from './SettingsContext';
import { navigate, navigationRef } from '../services/navigation';
import {
  matchAppNavigationCommand,
  matchCameraModeCommand,
  matchCaptureCommand,
  matchClearConversationCommand,
  matchCancelNavigationCommand,
  matchBrailleExportCommand,
  matchLearnSearchCommand,
  matchLearnRecordCommand,
  matchVolunteerCallCommand,
} from '../services/navigationCommands';
import { callVolunteer } from '../services/volunteerCall';

const VoiceContext = createContext();


export function VoiceProvider({ children }) {
  const [recordingState, setRecordingState] = useState('idle'); // 'idle' | 'listening' | 'processing'
  const [messages, setMessages] = useState([]);
  const conversationRef = useRef([]);
  const isPreparingRef = useRef(false);

  // expo-audio hook — stable recorder instance for the lifetime of the provider
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const { hapticEnabled, speechRate, volunteerNumber } = useSettings();

  useEffect(() => {
    AudioModule.requestRecordingPermissionsAsync();
  }, []);

  const speak = useCallback((text) => {
    Speech.stop();
    Speech.speak(text, { rate: speechRate, pitch: 1.0 });
  }, [speechRate]);

  const processUserText = useCallback(async (userText) => {
    const updatedConversation = [
      ...conversationRef.current,
      { role: 'user', content: userText },
    ];
    conversationRef.current = updatedConversation;
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);

    const reply = await chat(updatedConversation);

    conversationRef.current = [
      ...updatedConversation,
      { role: 'assistant', content: reply },
    ];
    setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    speak(reply);
    if (hapticEnabled) playHapticPattern('response');
  }, [speak, hapticEnabled]);

  const startListening = async () => {
    if (recordingState !== 'idle' || isPreparingRef.current) return;

    isPreparingRef.current = true;

    try {
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingState('listening');
      isPreparingRef.current = false;

      if (hapticEnabled) playHapticPattern('start');
      Speech.stop();
      AccessibilityInfo.announceForAccessibility(
        'Listening started. Speak your command, then tap the rail again to stop.'
      );
    } catch (err) {
      isPreparingRef.current = false;
      console.error('Start recording failed:', err);
      speak('Could not start recording. Please check microphone permissions.');
      if (hapticEnabled) playHapticPattern('error');
      setRecordingState('idle');
    }
  };

  const stopListening = async () => {
    if (recordingState !== 'listening') return;

    setRecordingState('processing');
    if (hapticEnabled) playHapticPattern('stop');
    AccessibilityInfo.announceForAccessibility('Recording stopped. Processing your request.');

    try {
      await recorder.stop();
      
      // Reset audio mode to disable recording and restore high-quality playback routing
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recorder.uri;

      const userText = await transcribeAudio(uri);

      if (!userText || userText.trim().length < 2) {
        speak("I didn't quite catch that. Please try again.");
        if (hapticEnabled) playHapticPattern('error');
        setRecordingState('idle');
        return;
      }

      // ── Local Command Interception ─────────────────────
      const cleanText = userText.trim().toLowerCase().replace(/[.,!?]+$/, '');
      let handledLocally = true;

      const navMatch = matchAppNavigationCommand(cleanText);
      const cameraModeMatch = matchCameraModeCommand(cleanText);

      if (navMatch) {
        speak(navMatch.speech);
        navigate(navMatch.screen);
      } else if (cameraModeMatch) {
        const modeLabels = {
          describe: 'Scene',
          read: 'Text',
          identify: 'Object',
          currency: 'Money',
        };
        speak(`Switching to ${modeLabels[cameraModeMatch.modeKey] || cameraModeMatch.modeKey} mode`);
        navigate('Camera', { voiceModeKey: cameraModeMatch.modeKey });
      } else if (matchCaptureCommand(cleanText)) {
        speak('Capturing');
        navigate('Camera', { voiceCapture: true });
      } else if (matchClearConversationCommand(cleanText)) {
        clearConversation();
      } else if (matchCancelNavigationCommand(cleanText)) {
        speak('Cancelling navigation');
        navigate('Navigation', { cancel: true });
      } else if (matchBrailleExportCommand(cleanText)) {
        speak('Converting to Braille');
        navigate('Learn', { voiceBrailleExport: true });
      } else if (matchLearnSearchCommand(cleanText)) {
        speak('Searching notes');
        navigate('Learn', { voiceModeKey: 'search' });
      } else if (matchLearnRecordCommand(cleanText)) {
        speak('Starting new note');
        navigate('Learn', { voiceModeKey: 'record' });
      } else if (matchVolunteerCallCommand(cleanText)) {
        await callVolunteer(volunteerNumber);
        if (hapticEnabled) playHapticPattern('stop');
      } else {
        const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null;
        if (currentRoute === 'Memory' || currentRoute === 'Learn') {
          navigate(currentRoute, { voiceQuery: cleanText });
          handledLocally = true;
        } else {
          handledLocally = false;
        }
      }

      if (handledLocally) {
        if (hapticEnabled) playHapticPattern('response');
        setRecordingState('idle');
        return;
      }

      await processUserText(userText);
    } catch (err) {
      console.error('Processing error:', err);
      speak('Something went wrong. Please try again.');
      if (hapticEnabled) playHapticPattern('error');
    }

    setRecordingState('idle');
  };

  const clearConversation = () => {
    conversationRef.current = [];
    setMessages([]);
    speak('Conversation cleared.');
  };

  return (
    <VoiceContext.Provider
      value={{
        recordingState,
        messages,
        startListening,
        stopListening,
        clearConversation,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  return useContext(VoiceContext);
}
