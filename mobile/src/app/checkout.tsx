import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { abandonCheckout, useCheckMembership, useVerifyPayment } from '@/api/subscription';
import { CatFace } from '@/components/companion/cat-face';
import { ConfettiBurst } from '@/components/confetti-burst';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { API_BASE_URL } from '@/lib/api-config';
import { useSession } from '@/store/session';
import type { CheckoutMessage } from '@/types/subscription';

type Phase = 'paying' | 'verifying' | 'done' | 'failed';

/**
 * `intent://pay?…#Intent;scheme=upi;…;end` → `upi://pay?…` (Linking can't open intent URLs);
 * other app links (upi://, phonepe://…) pass through.
 */
function appLink(url: string): string | null {
  if (!url.startsWith('intent://')) return url;
  const scheme = /;scheme=([^;]+)/.exec(url)?.[1];
  const body = url.slice('intent://'.length).split('#Intent')[0];
  if (scheme) return `${scheme}://${body}`;
  const fallback = /;S\.browser_fallback_url=([^;]+)/.exec(url)?.[1];
  return fallback ? decodeURIComponent(fallback) : null;
}

/**
 * Razorpay Checkout inside a WebView (react-native-razorpay needs a dev build; this works in
 * Expo Go). Our server serves the page; it posts the result back, and success is confirmed on
 * the server before anything unlocks.
 */
export default function CheckoutScreen() {
  const { sub } = useLocalSearchParams<{ sub: string }>();
  const token = useSession((s) => s.token);
  const verify = useVerifyPayment();
  const [phase, setPhase] = useState<Phase>('paying');
  const [reason, setReason] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const handled = useRef(false);

  const leave = () => router.back();

  // However the screen closes (✕, back gesture, Android back, dismissing Razorpay), an unpaid
  // checkout is freed and its subscription cancelled. A confirmed payment skips this.
  const paid = useRef(false);
  useEffect(
    () => () => {
      if (!paid.current) void abandonCheckout();
    },
    [],
  );

  // The server hears about a payment from Razorpay's webhooks too, usually within seconds. So
  // before saying "failed" (or when the user comes back from a UPI app) we ask it first.
  const checkMembership = useCheckMembership();
  const confirmFromServer = async (tries: number) => {
    for (let i = 0; i < tries; i++) {
      if (await checkMembership()) {
        paid.current = true;
        setPhase('done');
        return true;
      }
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  };
  const fail = async (why: string) => {
    setPhase('verifying');
    if (await confirmFromServer(3)) return;
    setReason(why);
    setPhase('failed');
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !paid.current) void confirmFromServer(4);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** UPI apps open through upi:// or intent:// links, which a WebView can't load: hand them to Android. */
  const onNavigate = ({ url }: { url: string }) => {
    if (/^(https?|about|data|blob|javascript):/i.test(url)) return true;
    const target = appLink(url);
    if (target) Linking.openURL(target).catch(() => undefined);
    return false;
  };

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: CheckoutMessage;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return; // not ours
    }
    if (msg.type === 'dismissed') return leave();
    if (msg.type === 'failed') return void fail(msg.reason);
    if (handled.current) return;
    handled.current = true;
    setPhase('verifying');
    verify.mutate(
      { paymentId: msg.paymentId, subscriptionId: msg.subscriptionId, signature: msg.signature },
      {
        onSuccess: () => {
          paid.current = true;
          setPhase('done');
        },
        onError: (err) => void fail(err.message),
      },
    );
  };

  if (phase === 'done') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8">
        <Animated.View entering={FadeInDown.duration(450)} className="items-center">
          <CatFace mood="happy" size={180} />
          <Heading className="mt-4 text-center text-3xl">Welcome to Mochi’s Club</Heading>
          <Text className="mt-2 text-center text-muted">
            Talk to Nourish as much as you like. Mochi is purring already.
          </Text>
        </Animated.View>
        <Button className="mt-10 self-stretch" label="Let’s go" onPress={() => router.back()} />
        <ConfettiBurst />
      </SafeAreaView>
    );
  }

  if (phase === 'failed') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8">
        <Animated.View entering={FadeIn.duration(300)} className="items-center">
          <CatFace mood="sad" size={150} />
          <Heading className="mt-4 text-center text-2xl">That didn’t go through</Heading>
          <Text className="mt-2 text-center text-muted">
            {reason ?? 'Something went wrong.'} If money was deducted, it’s sorted automatically.
          </Text>
        </Animated.View>
        <View className="mt-10 gap-2 self-stretch">
          <Button
            label="Try again"
            onPress={() => {
              handled.current = false;
              setReason(null);
              setLoaded(false);
              setAttempt((n) => n + 1); // fresh WebView
              setPhase('paying');
            }}
          />
          <Button variant="ghost" label="Not now" onPress={leave} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={leave}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close checkout"
          className="h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <X size={20} color={colors.ink} />
        </Pressable>
        <Text className="font-sans-semibold">Mochi’s Club</Text>
        <View className="w-10" />
      </View>

      <View className="flex-1">
        <WebView
          key={attempt}
          source={{
            uri: `${API_BASE_URL}/me/subscription/checkout-page/${sub}`,
            headers: { Authorization: `Bearer ${token}` },
          }}
          onMessage={onMessage}
          onLoadEnd={() => setLoaded(true)}
          onShouldStartLoadWithRequest={onNavigate}
          onError={(e) => {
            // Only our own page failing to load is fatal; a payment step erroring isn't proof
            // the payment failed (the server check in `fail` decides).
            if (!e.nativeEvent.url.includes('/checkout-page/')) return;
            void fail('Couldn’t open checkout. Check your connection.');
          }}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
          style={{ backgroundColor: colors.bg }}
        />
        {(!loaded || phase === 'verifying') && (
          <View className="absolute inset-0 items-center justify-center bg-bg">
            <ActivityIndicator color={colors.primary} />
            <Text className="mt-3 text-sm text-muted">
              {phase === 'verifying' ? 'Confirming your payment…' : 'Opening secure checkout…'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
