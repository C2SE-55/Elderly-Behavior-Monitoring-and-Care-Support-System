import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useMemo, useState } from "react";

import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCurrentToken, hydrateAuthFromStorage } from "@/services/api";

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await hydrateAuthFromStorage();
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const root = useMemo(() => String(segments?.[0] || ""), [segments]);

  useEffect(() => {
    if (!hydrated) return;
    const token = getCurrentToken();
    const authed = !!token;
    const inAuth = root === "(auths)";
    const inHome = root === "(homepages)";

    // When not logged in: allow only auth screens and logged-out homepage.
    if (!authed && !inAuth && !inHome) {
      router.replace("/(homepages)/homepage_user");
      return;
    }

    // When logged in: keep user out of auth screens.
    if (authed && inAuth) {
      router.replace("/(tabs)");
    }
  }, [hydrated, root, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{ headerShown: false }}
          initialRouteName="index"
        >
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(admin)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(auths)" />
          <Stack.Screen name="(homepages)" />
          <Stack.Screen name="(screens)" />
          <Stack.Screen name="(healths)" />
          <Stack.Screen name="(profiles)" />
          <Stack.Screen
            name="modal"
            options={{ presentation: 'modal', title: 'Modal', headerShown: true }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
