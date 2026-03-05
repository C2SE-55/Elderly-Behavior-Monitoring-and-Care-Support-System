import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Logo from '@assets/images/logo.png';

const PRIMARY = '#4B2E83';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* TOP CONTENT */}
      <View style={styles.topContainer}>
        <Text style={styles.welcomeText}>Welcome to</Text>
        <Text style={styles.title}>ECMS</Text>

        <Image
          source={Logo}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* BOTTOM BUTTONS */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/signup')}
        >
          <Text style={styles.primaryText}>Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.secondaryText}>Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F4F4',
    paddingHorizontal: 30,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },

  topContainer: {
    alignItems: 'center',
  },

  welcomeText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6B7280',
  },

  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: PRIMARY,
    marginTop: 5,
  },

  logo: {
    width: 600,
    height: 300,
    marginTop: 50,
  },

  buttonContainer: {
    width: '100%',
  },

  primaryButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 14,
  },

  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  secondaryButton: {
    borderWidth: 1.5,
    borderColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },

  secondaryText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '600',
  },
});