import '../global.css';
import '@/lib/native-wind-interop';
// Background tasks must be defined before the OS wakes them (walk tracking, place check-in).
import '@/lib/walk-task';
import '@/lib/place-task';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_900Black,
} from '@expo-google-fonts/barlow-condensed';
import { Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { PostHogErrorBoundary, PostHogProvider } from 'posthog-react-native';
import { type ReactNode, useCallback, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AnimatedSplash } from '@/components/animated-splash';
import { DeviceSync } from '@/components/device-sync';
import { OfflineBanner } from '@/components/offline-banner';
import { ScreenFrame } from '@/components/screen-frame';
import { Toast } from '@/components/toast';
import { UpdateRequired } from '@/components/update-required';
import { colors } from '@/constants/colors';
import { startNetworkMonitoring } from '@/lib/network';
import { posthog } from '@/lib/posthog';
import { queryClient } from '@/lib/query-client';
import { useSession } from '@/store/session';

/** PostHog (analytics + error boundary) only when its keys are configured; otherwise a no-op. */
function Analytics({ children }: { children: ReactNode }) {
  if (!posthog) return children;
  return (
    <PostHogProvider client={posthog}>
      <PostHogErrorBoundary>{children}</PostHogErrorBoundary>
    </PostHogProvider>
  );
}

SplashScreen.preventAutoHideAsync();
// Read the saved JWT from SecureStore before the first screen decides where to go.
useSession.getState().hydrate();
// Track connectivity app-wide (offline banner, paused queries, fast-fail requests).
startNetworkMonitoring();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    BarlowCondensed_900Black,
    Lora_600SemiBold,
    Lora_700Bold,
  });
  const hydrated = useSession((s) => s.hydrated);
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);
  // The native splash stays up until fonts and the saved session are loaded (no flash of the wrong
  // screen); AnimatedSplash then hides it once its identical first frame has painted.
  const ready = fontsLoaded && hydrated;

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Desktop web: a phone-sized frame on a slightly darker page. Phones: full screen. */}
      <ScreenFrame backdrop={colors.line}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Analytics>
            <Stack
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="new-profile" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
              <Stack.Screen
                name="dashboard"
                options={{ animation: 'fade', gestureEnabled: false }}
              />
              <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="exercises" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="assistant" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="adopt" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="club" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="whats-new" options={{ animation: 'fade' }} />
              <Stack.Screen name="week" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="mochi" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="place" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="reminders" />
              <Stack.Screen name="trophy/[id]" options={{ animation: 'fade' }} />
              <Stack.Screen name="workout" options={{ animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen
                name="walk"
                options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
              />
              <Stack.Screen
                name="checkout"
                options={{ animation: 'slide_from_right', gestureEnabled: false }}
              />
              <Stack.Screen name="exercises/[id]" options={{ animation: 'slide_from_right' }} />
            </Stack>
            <OfflineBanner />
            <Toast />
            <UpdateRequired />
            <DeviceSync ready={splashDone} />
            {/* Rendered above the app, which loads underneath while the splash plays. */}
            {!splashDone && <AnimatedSplash onFinish={finishSplash} />}
          </Analytics>
        </QueryClientProvider>
      </ScreenFrame>
    </GestureHandlerRootView>
  );
}
