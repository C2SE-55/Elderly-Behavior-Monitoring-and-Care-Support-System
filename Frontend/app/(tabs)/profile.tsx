import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useProfile } from '../../hooks/userProfile';
import { COLORS } from '../../constants/color';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { ProfileField } from '../../components/profile/ProfileField';

export default function ProfileScreen() {
  const router = useRouter();
  const { form, setForm } = useProfile();

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const displayRole =
    form.role === 'Caregiver' ? 'Người chăm sóc' : form.role;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          title="Thông tin cá nhân"
          onBack={() => router.back()}
        />

        {/* Form card */}
        <View style={styles.formWrapper}>
          <View style={styles.formCard}>
            <ProfileField
              label="Full Name"
              value={form.fullName}
              onChangeText={text => handleChange('fullName', text)}
            />

            <ProfileField
              label="Username"
              value={form.username}
              onChangeText={text => handleChange('username', text)}
            />

            <ProfileField
              label="Email"
              value={form.email}
              onChangeText={text => handleChange('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <ProfileField
              label="Phone Number"
              value={form.phone}
              onChangeText={text => handleChange('phone', text)}
              keyboardType="phone-pad"
            />

            <ProfileField
              label="Password"
              value={form.password}
              onChangeText={text => handleChange('password', text)}
              secureTextEntry
            />

            <ProfileField
              label="Confirm Password"
              value={form.confirmPassword}
              onChangeText={text => handleChange('confirmPassword', text)}
              secureTextEntry
            />

            <ProfileField
              label="Role"
              value={displayRole}
              editable={false}
            />

            <TouchableOpacity style={styles.submitButton}>
              <Text style={styles.submitButtonText}>Cập Nhật</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  formWrapper: {
    marginTop: -28,
    paddingHorizontal: 20,
  },
  formCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  submitButton: {
    marginTop: 10,
    backgroundColor: COLORS.PURPLE,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});