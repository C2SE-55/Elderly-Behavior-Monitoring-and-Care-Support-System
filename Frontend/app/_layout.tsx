import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Platform } from "react-native";
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
    // When not logged in: allow only auth screens and logged-out start screen.
    if (!authed && !inAuth && !inHome) {
      router.replace("/(homepages)/getstared");
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
          screenOptions={{
            headerShown: false,
            animation: Platform.OS === "ios" ? "default" : "slide_from_right",
            gestureEnabled: false,
            fullScreenGestureEnabled: false,
            animationDuration: 230,
          }}
          initialRouteName="index"
        >
          <Stack.Screen
            name="(tabs)"
            options={{
              animation: "fade_from_bottom",
              animationDuration: 220,
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="(admin)"
            options={{
              animation: "fade_from_bottom",
              animationDuration: 220,
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
            }}
          />
          <Stack.Screen name="(auths)" options={{ animation: "fade", animationDuration: 180 }} />
          <Stack.Screen name="(homepages)" options={{ animation: "fade", animationDuration: 180 }} />
          <Stack.Screen
            name="(screens)"
            options={{
              animation: "slide_from_right",
              animationDuration: 230,
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="(healths)"
            options={{
              animation: "slide_from_right",
              animationDuration: 230,
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="(profiles)"
            options={{
              animation: "slide_from_right",
              animationDuration: 230,
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="modal"
            options={{
              presentation: 'modal',
              title: 'Modal',
              headerShown: true,
              animation: "slide_from_bottom",
              animationDuration: 240,
            }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
