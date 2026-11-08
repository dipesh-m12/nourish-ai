import '../global.css';
import '@/lib/native-wind-interop';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
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
import { OfflineBanner } from '@/components/offline-banner';
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
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Analytics>
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="new-profile" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            <Stack.Screen name="dashboard" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="exercises" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="assistant" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="adopt" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="club" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen
              name="checkout"
              options={{ animation: 'slide_from_right', gestureEnabled: false }}
            />
            <Stack.Screen name="exercises/[id]" options={{ animation: 'slide_from_right' }} />
          </Stack>
          <OfflineBanner />
          <Toast />
          <UpdateRequired />
          {/* Rendered above the app, which loads underneath while the splash plays. */}
          {!splashDone && <AnimatedSplash onFinish={finishSplash} />}
        </Analytics>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
