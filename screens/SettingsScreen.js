import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import { HAPTIC_PATTERNS, playHapticPattern } from '../services/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { getTheme, TYPOGRAPHY, getShadows } from '../constants/theme';

const SPEECH_RATES = [
  { label: 'SLOW', value: 0.7 },
  { label: 'NORMAL', value: 0.9 },
  { label: 'FAST', value: 1.2 },
  { label: 'MAX', value: 1.5 },
];

export default function SettingsScreen() {
  const {
    hapticEnabled,
    setHapticEnabled,
    speechRate,
    setSpeechRate,
    sosEnabled,
    setSosEnabled,
    theme: themeMode,
    setTheme,
    volunteerNumber,
    setVolunteerNumber,
    sosProfile,
    updateSosProfile,
  } = useSettings();
  const insets = useSafeAreaInsets();
  const theme = getTheme(themeMode);
  const shadows = getShadows(theme);

  const [sosModalVisible, setSosModalVisible] = useState(false);
  const [volunteerPhoneInput, setVolunteerPhoneInput] = useState(volunteerNumber);
  const [editingContact, setEditingContact] = useState(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [userName, setUserName] = useState(sosProfile?.userName || '');
  const [userAge, setUserAge] = useState(sosProfile?.age?.toString() || '');
  const [userBloodGroup, setUserBloodGroup] = useState(sosProfile?.bloodGroup || '');

  const testPattern = (key) => {
    const pattern = HAPTIC_PATTERNS[key];
    Speech.speak(`Testing: ${pattern.label}. ${pattern.description}.`, { rate: speechRate });
    if (hapticEnabled) {
      setTimeout(() => playHapticPattern(key), 1200);
    }
  };

  const handleOpenSosModal = () => {
    if (sosProfile) {
      setUserName(sosProfile.userName);
      setUserAge(sosProfile.age?.toString() || '');
      setUserBloodGroup(sosProfile.bloodGroup);
      setEditingContact(null);
      setContactName('');
      setContactPhone('');
    }
    setSosModalVisible(true);
  };

  const handleSaveVolunteerNumber = () => {
    setVolunteerNumber(volunteerPhoneInput);
    Speech.speak('Volunteer number saved', { rate: speechRate });
  };

  const handleAddContact = () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      Alert.alert('Required', 'Please enter contact name and phone number');
      return;
    }
    const updatedContacts = sosProfile?.emergencyContacts ? [...sosProfile.emergencyContacts] : [];
    if (editingContact !== null) {
      updatedContacts[editingContact] = { name: contactName.trim(), phone: contactPhone.trim() };
    } else {
      updatedContacts.push({ name: contactName.trim(), phone: contactPhone.trim() });
    }
    updateSosProfile({ emergencyContacts: updatedContacts });
    Speech.speak(editingContact !== null ? 'Contact updated' : 'Contact added', { rate: speechRate });
    setContactName('');
    setContactPhone('');
    setEditingContact(null);
  };

  const handleEditContact = (index) => {
    const contact = sosProfile?.emergencyContacts?.[index];
    if (contact) {
      setEditingContact(index);
      setContactName(contact.name);
      setContactPhone(contact.phone);
    }
  };

  const handleDeleteContact = (index) => {
    const updatedContacts = sosProfile?.emergencyContacts?.filter((_, i) => i !== index) || [];
    updateSosProfile({ emergencyContacts: updatedContacts });
    Speech.speak('Contact deleted', { rate: speechRate });
  };

  const handleSaveSosProfile = () => {
    if (!userName.trim() || !userAge.trim() || !userBloodGroup.trim()) {
      Alert.alert('Required', 'Please fill in all profile fields');
      return;
    }
    if (sosProfile?.emergencyContacts?.length === 0) {
      Alert.alert('Required', 'Please add at least one emergency contact');
      return;
    }
    updateSosProfile({
      userName: userName.trim(),
      age: parseInt(userAge) || 0,
      bloodGroup: userBloodGroup.trim(),
    });
    Speech.speak('Emergency profile saved', { rate: speechRate });
    setSosModalVisible(false);
  };

  const setSpeechRateAndAnnounce = (rate, label) => {
    setSpeechRate(rate);
    Speech.stop();
    Speech.speak(`Speech rate set to ${label}`, { rate });
  };

  const testSpeech = () => {
    Speech.stop();
    Speech.speak(
      'This is a test of the VisionVoice speech system.',
      { rate: speechRate }
    );
  };

  const patternKeys = Object.keys(HAPTIC_PATTERNS);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        accessible={false}
      >
        {/* ── Theme Section ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.onBackground }]}>DISPLAY</Text>

          <View style={[styles.rowBox, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.border }, shadows.neoSm]}>
            <Text style={[styles.rowLabel, { color: theme.onBackground }]}>Dark Mode</Text>
            <Switch
              value={themeMode === 'dark'}
              onValueChange={(val) => {
                const newTheme = val ? 'dark' : 'light';
                setTheme(newTheme);
                Speech.speak(`${newTheme} theme activated`);
              }}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={theme.white}
              accessible
              accessibilityLabel={`Dark mode ${themeMode === 'dark' ? 'enabled' : 'disabled'}`}
            />
          </View>
        </View>

        {/* ── SOS section ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.onBackground }]}>EMERGENCY</Text>

          <View style={[styles.rowBox, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.border }, shadows.neoSm]}>
            <Text style={[styles.rowLabel, { color: theme.onBackground }]}>Fall Detection SOS</Text>
            <Switch
              value={sosEnabled}
              onValueChange={(val) => {
                setSosEnabled(val);
                Speech.speak(val ? 'Fall detection SOS enabled' : 'Fall detection SOS disabled');
              }}
              trackColor={{ false: theme.border, true: theme.semantic.danger }}
              thumbColor={theme.white}
              accessible
              accessibilityLabel={`Fall detection SOS ${sosEnabled ? 'enabled' : 'disabled'}`}
              accessibilityHint="Turns accelerometer fall detection and emergency alerts on or off"
            />
          </View>

          <TouchableOpacity
            style={[styles.editSosBtn, { backgroundColor: theme.primary, borderColor: theme.border }, shadows.neo]}
            onPress={handleOpenSosModal}
            accessible
            accessibilityLabel="Edit emergency profile"
            accessibilityHint="Edit your personal info and emergency contacts"
          >
            <Feather name="edit-2" size={20} color={theme.onPrimary} style={{ marginRight: 8 }} />
            <Text style={[styles.editSosBtnText, { color: theme.onPrimary }]}>EDIT EMERGENCY PROFILE</Text>
          </TouchableOpacity>
        </View>

        {/* ── Volunteer Assistance section ──────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.onBackground }]}>VOLUNTEER ASSISTANCE</Text>

          <View style={[styles.rowBox, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.border }, shadows.neoSm]}>
            <TextInput
              style={[
                { 
                  flex: 1,
                  color: theme.onBackground,
                  fontFamily: 'SpaceMono_700Bold',
                  fontSize: 16,
                },
              ]}
              placeholder="Add a volunteer's number"
              placeholderTextColor={theme.semantic.neutral}
              value={volunteerPhoneInput}
              onChangeText={setVolunteerPhoneInput}
              onBlur={handleSaveVolunteerNumber}
              keyboardType="phone-pad"
              accessible
              accessibilityLabel="Volunteer assistance phone number"
              accessibilityHint="Enter the phone number of a trusted volunteer or friend to call for everyday help"
            />
          </View>
        </View>

        {/* ── Haptics section ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.onBackground }]}>HAPTIC FEEDBACK</Text>

          <View style={[styles.rowBox, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.border }, shadows.neoSm]}>
            <Text style={[styles.rowLabel, { color: theme.onBackground }]}>Enable Haptics</Text>
            <Switch
              value={hapticEnabled}
              onValueChange={(val) => {
                setHapticEnabled(val);
                Speech.speak(val ? 'Haptics enabled' : 'Haptics disabled');
              }}
              trackColor={{ false: theme.border, true: theme.semantic.accent }}
              thumbColor={theme.white}
              accessible
              accessibilityLabel={`Haptic feedback ${hapticEnabled ? 'enabled' : 'disabled'}`}
            />
          </View>

          <Text style={[styles.subheading, { color: theme.onBackground }]}>TEST PATTERNS</Text>
          {patternKeys.map((key, index) => {
            const pattern = HAPTIC_PATTERNS[key];
            const isTilted = index % 2 === 1;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.patternBtn,
                  { backgroundColor: theme.white, borderColor: theme.border },
                  isTilted ? { transform: [{ rotate: '1deg' }] } : {},
                  shadows.neo
                ]}
                onPress={() => testPattern(key)}
                accessible
                accessibilityLabel={`Test ${pattern.label}: ${pattern.description}`}
                accessibilityHint="Plays this haptic pattern and announces its name"
              >
                <View style={[styles.patternIconBox, { backgroundColor: theme.onBackground, borderColor: theme.border }]}>
                  <MaterialIcons name="vibration" size={24} color={theme.background} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.patternLabel, { color: theme.onBackground }]}>{pattern.label.toUpperCase()}</Text>
                  <Text style={[styles.patternDesc, { color: theme.onBackground }]}>{pattern.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Speech section ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.onBackground }]}>SPEECH SPEED</Text>

          <View style={styles.rateRow}>
            {SPEECH_RATES.map((rate, idx) => {
              const isActive = speechRate === rate.value;
              return (
                <TouchableOpacity
                  key={rate.label}
                  style={[
                    styles.rateBtn,
                    { 
                      backgroundColor: isActive ? theme.primary : theme.white,
                      borderColor: theme.border,
                      transform: [{ rotate: idx % 2 === 0 ? '-1deg' : '1deg' }]
                    },
                    shadows.neoSm
                  ]}
                  onPress={() => setSpeechRateAndAnnounce(rate.value, rate.label)}
                  accessible
                  accessibilityLabel={`${rate.label} speech rate`}
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[
                    styles.rateBtnText, 
                    { color: isActive ? theme.onPrimary : theme.onBackground }
                  ]}>
                    {rate.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.testSpeechBtn, { backgroundColor: theme.white, borderColor: theme.border }, shadows.neo]}
            onPress={testSpeech}
            accessible
            accessibilityLabel="Test speech output"
            accessibilityHint="Plays a test sentence at the current speech rate"
          >
            <View style={styles.testSpeechBtnContent}>
              <MaterialIcons name="volume-up" size={24} color={theme.onBackground} style={{ marginRight: 8 }} />
              <Text style={[styles.testSpeechText, { color: theme.onBackground }]}>TEST SPEECH</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── About section ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.onBackground }]}>ABOUT</Text>
          <View style={[styles.aboutBox, { backgroundColor: theme.primary, borderColor: theme.border }, shadows.neo]}>
            <Text style={[styles.aboutText, { color: theme.onPrimary }]}>
              VISIONVOICE MVP v1.0{'\n'}
              AI-POWERED ACCESSIBILITY ASSISTANT{'\n'}
              BUILT FOR BLIND AND VISUALLY IMPAIRED USERS
            </Text>
          </View>
        </View>

      </ScrollView>

      {/* ── SOS Profile Modal ────────────────────────────────────────── */}
      <Modal
        visible={sosModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSosModalVisible(false)}
      >
        <ScrollView style={[styles.modalOverlay, { backgroundColor: theme.background }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }, shadows.neo]}>
            <Text style={[styles.modalTitle, { color: theme.onBackground }]}>EMERGENCY PROFILE</Text>

            {/* Personal Info Section */}
            <Text style={[styles.modalSectionTitle, { color: theme.onBackground }]}>PERSONAL INFO</Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.onBackground }]}>Name</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.onBackground, backgroundColor: theme.surfaceContainerLow }]}
                placeholder="Full name"
                placeholderTextColor={theme.semantic.neutral}
                value={userName}
                onChangeText={setUserName}
                accessible
                accessibilityLabel="Name input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.onBackground }]}>Age</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.onBackground, backgroundColor: theme.surfaceContainerLow }]}
                placeholder="Age"
                placeholderTextColor={theme.semantic.neutral}
                value={userAge}
                onChangeText={setUserAge}
                keyboardType="numeric"
                accessible
                accessibilityLabel="Age input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.onBackground }]}>Blood Group</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.onBackground, backgroundColor: theme.surfaceContainerLow }]}
                placeholder="Blood group (e.g. O+)"
                placeholderTextColor={theme.semantic.neutral}
                value={userBloodGroup}
                onChangeText={setUserBloodGroup}
                accessible
                accessibilityLabel="Blood group input"
              />
            </View>

            {/* Contacts Section */}
            <Text style={[styles.modalSectionTitle, { color: theme.onBackground }]}>EMERGENCY CONTACTS</Text>

            {sosProfile?.emergencyContacts?.map((contact, index) => (
              <View key={index} style={[styles.contactItem, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.border }, shadows.neoSm]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactName, { color: theme.onBackground }]}>{contact.name}</Text>
                  <Text style={[styles.contactPhone, { color: theme.semantic.neutral }]}>{contact.phone}</Text>
                </View>
                <View style={styles.contactActions}>
                  <TouchableOpacity
                    onPress={() => handleEditContact(index)}
                    accessible
                    accessibilityLabel={`Edit ${contact.name}`}
                    style={{ marginRight: 8 }}
                  >
                    <Feather name="edit-2" size={18} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteContact(index)}
                    accessible
                    accessibilityLabel={`Delete ${contact.name}`}
                  >
                    <Feather name="trash-2" size={18} color={theme.semantic.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Add/Edit Contact Form */}
            <Text style={[styles.modalSectionTitle, { color: theme.onBackground }]}>{editingContact !== null ? 'EDIT CONTACT' : 'ADD CONTACT'}</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.onBackground }]}>Contact Name</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.onBackground, backgroundColor: theme.surfaceContainerLow }]}
                placeholder="Name"
                placeholderTextColor={theme.semantic.neutral}
                value={contactName}
                onChangeText={setContactName}
                accessible
                accessibilityLabel="Contact name input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.onBackground }]}>Phone Number</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.onBackground, backgroundColor: theme.surfaceContainerLow }]}
                placeholder="Phone number"
                placeholderTextColor={theme.semantic.neutral}
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
                accessible
                accessibilityLabel="Phone number input"
              />
            </View>

            <TouchableOpacity
              style={[styles.addContactBtn, { backgroundColor: theme.semantic.accent, borderColor: theme.border }, shadows.neo]}
              onPress={handleAddContact}
              accessible
              accessibilityLabel={editingContact !== null ? 'Update contact' : 'Add contact'}
            >
              <Text style={[styles.addContactBtnText, { color: theme.onPrimary }]}>{editingContact !== null ? 'UPDATE CONTACT' : 'ADD CONTACT'}</Text>
            </TouchableOpacity>

            {/* Save and Cancel */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.primary, borderColor: theme.border }, shadows.neo]}
                onPress={handleSaveSosProfile}
                accessible
                accessibilityLabel="Save emergency profile"
              >
                <Text style={[styles.modalBtnText, { color: theme.onPrimary }]}>SAVE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.surface, borderColor: theme.border }, shadows.neo]}
                onPress={() => setSosModalVisible(false)}
                accessible
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.modalBtnText, { color: theme.onBackground }]}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Anybody_800ExtraBold',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  subheading: {
    fontSize: 12,
    fontFamily: 'Anybody_800ExtraBold',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
  },
  rowBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 4,
    borderRadius: 0,
    marginBottom: 12,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: 'SpaceMono_700Bold',
  },
  patternBtn: {
    padding: 16,
    borderWidth: 4,
    borderRadius: 0,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  patternIconBox: {
    padding: 8,
    borderWidth: 4,
    marginRight: 16,
  },
  patternLabel: {
    fontSize: 18,
    fontFamily: 'Anybody_800ExtraBold',
    marginBottom: 4,
  },
  patternDesc: {
    fontSize: 12,
    fontFamily: 'SpaceMono_400Regular',
    lineHeight: 16,
  },
  rateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  rateBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 4,
    borderRadius: 0,
  },
  rateBtnText: {
    fontSize: 14,
    fontFamily: 'SpaceMono_700Bold',
  },
  testSpeechBtn: {
    marginTop: 12,
    padding: 20,
    borderWidth: 4,
    borderRadius: 0,
  },
  testSpeechBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testSpeechText: {
    fontSize: 18,
    fontFamily: 'Anybody_800ExtraBold',
  },
  aboutBox: {
    padding: 20,
    borderWidth: 4,
    borderRadius: 0,
  },
  aboutText: {
    fontSize: 12,
    fontFamily: 'SpaceMono_700Bold',
    lineHeight: 20,
  },
  editSosBtn: {
    padding: 16,
    borderWidth: 4,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSosBtnText: {
    fontSize: 16,
    fontFamily: 'Anybody_800ExtraBold',
  },
  
  // Modal styles
  modalOverlay: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    backgroundColor: 'transparent',
  },
  modalContent: {
    borderWidth: 4,
    borderRadius: 0,
    padding: 20,
    marginBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Anybody_800ExtraBold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalSectionTitle: {
    fontSize: 14,
    fontFamily: 'Anybody_800ExtraBold',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'SpaceMono_700Bold',
    marginBottom: 6,
  },
  input: {
    borderWidth: 4,
    borderRadius: 0,
    padding: 12,
    fontSize: 14,
    fontFamily: 'SpaceMono_400Regular',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 4,
    marginBottom: 12,
    borderRadius: 0,
  },
  contactName: {
    fontSize: 14,
    fontFamily: 'SpaceMono_700Bold',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 12,
    fontFamily: 'SpaceMono_400Regular',
  },
  contactActions: {
    flexDirection: 'row',
  },
  addContactBtn: {
    padding: 12,
    borderWidth: 4,
    borderRadius: 0,
    alignItems: 'center',
    marginBottom: 16,
  },
  addContactBtnText: {
    fontSize: 14,
    fontFamily: 'Anybody_800ExtraBold',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    padding: 16,
    borderWidth: 4,
    borderRadius: 0,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 14,
    fontFamily: 'Anybody_800ExtraBold',
  },
});
