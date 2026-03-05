import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  // anchor: 'welcome',
  anchor: 'health',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* <<<<<<< HEAD
      <Stack>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="loginForm" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="getstared" options={{ headerShown: false }} />
        <Stack.Screen name="homepage_user" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
======= */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auths)" />
        <Stack.Screen name="(homepages)" />
        <Stack.Screen name="(healths)" />
        <Stack.Screen name="(profiles)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'Modal', headerShown: true }}
        />

      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
