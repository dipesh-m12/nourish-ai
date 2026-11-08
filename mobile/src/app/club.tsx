import { router, useLocalSearchParams } from 'expo-router';
import { Check, Smartphone, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCancelSubscription, useStartCheckout, useSubscription } from '@/api/subscription';
import { CatFace } from '@/components/companion/cat-face';
import { AccordionItem } from '@/components/ui/accordion-item';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SkeletonBlock, SkeletonGroup } from '@/components/ui/skeleton';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import { useToast } from '@/store/toast';

/** Payments need the phone app (Razorpay Checkout runs in a native WebView). */
const WEB = Platform.OS === 'web';

type Cell = true | false | string;

/** What each plan gets. "soon" marks things promised for later, so nothing is oversold. */
const FEATURES: { label: string; free: Cell; club: Cell }[] = [
  { label: 'Snap meals, calories & macros', free: true, club: true },
  { label: 'AI plan built on your why', free: true, club: true },
  { label: 'Challenges, streaks & photo proof', free: true, club: true },
  { label: 'Daily briefing', free: true, club: true },
  { label: 'Burn & exercise library', free: true, club: true },
  { label: 'Mochi, your companion', free: true, club: true },
  { label: 'Nourish assistant (chat + voice)', free: '5 msgs', club: 'Unlimited' },
  { label: 'Log anything by just saying it', free: false, club: true },
  { label: 'New companions as they launch', free: false, club: 'soon' },
  { label: 'Keep more than one companion', free: false, club: 'soon' },
];

const FAQ = [
  {
    q: 'Can I cancel?',
    a: 'Anytime, from Profile. Autopay stops and you keep the Club until your paid month ends. Days already paid aren’t refunded.',
  },
  {
    q: 'How am I charged?',
    a: 'Automatically each month. You’ll always see your next bill date here.',
  },
  {
    q: 'Is it safe?',
    a: 'Payments are handled by Razorpay. We never see your card or UPI details.',
  },
];

const dateOf = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

/**
 * Mochi's Club: what Free gets, what the Club adds, and one clear way in (or, for members,
 * their status and how to turn autopay off).
 */
export default function ClubScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast((s) => s.show);
  const sub = useSubscription();
  const start = useStartCheckout();
  const cancel = useCancelSubscription();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const s = sub.data;
  const price = s ? `₹${s.plan.amountPaise / 100}` : '₹149';
  const member = s?.premium ?? false;
  const autopayOn = Boolean(s?.current?.autoRenew);
  // Members with autopay off can line up the next month (it starts when theirs ends).
  const canJoin = s?.configured && (!member || (!autopayOn && !s.upcoming));

  const join = () =>
    start.mutate(undefined, {
      onSuccess: ({ subscriptionId }) =>
        router.push({ pathname: '/checkout', params: { sub: subscriptionId } }),
      onError: (err) => toast(err.message),
    });

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <X size={20} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
        {/* Hero: the cat sells it better than a paragraph would. */}
        <Animated.View entering={FadeInDown.duration(400)} className="items-center">
          <CatFace mood="happy" size={112} />
          <Heading className="mt-2 text-center text-3xl">Mochi’s Club</Heading>
          <Text className="mt-1 text-center text-muted">
            {reason === 'quota'
              ? 'You’ve used your 5 free messages. Keep talking to Nourish.'
              : 'Unlimited Nourish. Mochi approves.'}
          </Text>
        </Animated.View>

        {sub.isPending && <ClubSkeleton />}
        {sub.isError && (
          <View className="mt-6 items-center gap-3 rounded-2xl bg-card p-5">
            <Text className="text-center text-muted">{sub.error.message}</Text>
            <Button variant="secondary" label="Try again" onPress={() => sub.refetch()} />
          </View>
        )}

        {s && member && s.current && (
          <Animated.View
            entering={FadeInDown.delay(80).duration(400)}
            className="mt-6 rounded-3xl border-2 border-primary bg-primary-soft p-5"
          >
            <Text className="font-sans-semibold text-xs uppercase tracking-wider text-primary">
              You’re in the Club
            </Text>
            <Text className="mt-1 font-sans-semibold text-lg">
              {autopayOn
                ? `Renews on ${dateOf(s.current.nextBillAt)}`
                : `Autopay off · Club until ${dateOf(s.current.nextBillAt)}`}
            </Text>
            {s.upcoming && (
              <Text className="mt-1 text-sm text-muted">
                Next month lined up: starts {dateOf(s.upcoming.startAt)}.
              </Text>
            )}
            {(autopayOn || s.upcoming) && (
              <Pressable
                onPress={() => setConfirmCancel(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Turn off autopay"
                className="mt-3 self-start active:opacity-70"
              >
                <Text className="font-sans-semibold text-sm text-danger">Turn off autopay</Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {s && (
          <>
            {/* Plan cards: Free plain, the Club highlighted (pricing-page pattern). */}
            <Animated.View
              entering={FadeInDown.delay(120).duration(400)}
              className="mt-6 flex-row gap-3"
            >
              <PlanCard name="Free" price="₹0" per="forever" />
              <PlanCard name={s.plan.name} price={price} per="a month" highlight />
            </Animated.View>

            {/* Comparison: ticks and crosses, labels short. */}
            <Animated.View
              entering={FadeInDown.delay(180).duration(400)}
              className="mt-4 overflow-hidden rounded-3xl bg-card"
            >
              <View className="flex-row items-center border-b border-line px-4 py-3">
                <Text className="flex-1 font-sans-semibold text-xs uppercase tracking-wider text-muted">
                  What you get
                </Text>
                <Text className="w-16 text-center font-sans-semibold text-xs text-muted">Free</Text>
                <Text className="w-20 text-center font-sans-semibold text-xs text-primary">
                  Club
                </Text>
              </View>
              {FEATURES.map((f, i) => (
                <View
                  key={f.label}
                  className={cn('flex-row items-center px-4 py-3', i > 0 && 'border-t border-line')}
                  accessible
                  accessibilityLabel={`${f.label}. Free: ${describe(f.free)}. Club: ${describe(f.club)}.`}
                >
                  <Text className="flex-1 pr-2 text-sm">{f.label}</Text>
                  <View className="w-16 items-center">
                    <CellMark value={f.free} />
                  </View>
                  <View className="w-20 items-center">
                    <CellMark value={f.club} club />
                  </View>
                </View>
              ))}
            </Animated.View>

            {/* FAQ: questions only until tapped, so the page stays short. */}
            <Animated.View entering={FadeInDown.delay(240).duration(400)} className="mt-6">
              <Text className="mb-3 font-sans-semibold text-sm uppercase tracking-wider text-muted">
                FAQ
              </Text>
              <Animated.View
                layout={LinearTransition.duration(220)}
                className="overflow-hidden rounded-3xl bg-card"
              >
                {FAQ.map((f, i) => (
                  <AccordionItem key={f.q} title={f.q} divider={i > 0}>
                    {f.a}
                  </AccordionItem>
                ))}
              </Animated.View>
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* Sticky CTA: always one clear next step. */}
      {s && (canJoin || !s.configured) && (
        <View
          className="border-t border-line bg-bg px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {/* Checkout runs in a native WebView, which a browser can't host. */}
          {WEB && (
            <View
              className="mb-3 flex-row items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3"
              accessibilityRole="alert"
            >
              <Smartphone size={20} color={colors.accent} />
              <Text className="flex-1 text-sm leading-5 text-ink">
                Joining isn’t available on the web yet. Open Nourish AI on your phone to join.
              </Text>
            </View>
          )}
          <Button
            label={
              !s.configured
                ? 'Payments coming soon'
                : WEB
                  ? 'Join on the mobile app'
                  : member
                    ? `Line up next month · ${price}`
                    : `Join Mochi’s Club · ${price}/mo`
            }
            onPress={join}
            loading={start.isPending}
            disabled={!s.configured || WEB}
          />
          <Text className="mt-2 text-center text-xs text-muted">
            {member && s.current
              ? `Starts ${dateOf(s.current.nextBillAt)}, when your current month ends.`
              : 'Cancel anytime. Renews monthly.'}
          </Text>
        </View>
      )}

      <ConfirmDialog
        visible={confirmCancel}
        title="Turn off autopay?"
        message={`You’ll stay in the Club until ${dateOf(s?.current?.nextBillAt ?? null)}. Days already paid aren’t refunded.`}
        confirmLabel="Turn off"
        destructive
        loading={cancel.isPending}
        error={cancel.isError ? cancel.error.message : null}
        onConfirm={() =>
          cancel.mutate(undefined, {
            onSuccess: () => {
              setConfirmCancel(false);
              toast('Autopay off. Mochi will miss you.');
            },
          })
        }
        onCancel={() => {
          setConfirmCancel(false);
          cancel.reset();
        }}
      />
    </SafeAreaView>
  );
}

function PlanCard({
  name,
  price,
  per,
  highlight,
}: {
  name: string;
  price: string;
  per: string;
  highlight?: boolean;
}) {
  return (
    <View
      className={cn(
        'flex-1 rounded-3xl p-4',
        highlight ? 'border-2 border-primary bg-primary-soft' : 'border border-line bg-card',
      )}
    >
      {highlight && (
        <View className="absolute -top-3 right-3 rounded-full bg-accent px-2.5 py-1">
          <Text className="font-sans-semibold text-[11px] text-white">Most loved</Text>
        </View>
      )}
      <Text className={cn('font-sans-semibold', highlight ? 'text-primary' : 'text-muted')}>
        {name}
      </Text>
      <Text className="mt-2 font-sans-semibold text-3xl">{price}</Text>
      <Text className="text-xs text-muted">{per}</Text>
    </View>
  );
}

const describe = (v: Cell) => (v === true ? 'included' : v === false ? 'not included' : v);

function CellMark({ value, club }: { value: Cell; club?: boolean }) {
  if (value === true) return <Check size={18} color={colors.primary} strokeWidth={3} />;
  if (value === false) return <X size={16} color={colors.muted} strokeWidth={2.5} />;
  return (
    <Text
      className={cn(
        'text-xs',
        club ? 'font-sans-semibold text-primary' : 'text-muted',
        value === 'soon' && 'italic',
      )}
    >
      {value}
    </Text>
  );
}

function ClubSkeleton() {
  return (
    <SkeletonGroup className="mt-6 gap-3" accessible accessibilityLabel="Loading plans">
      <View className="flex-row gap-3">
        <SkeletonBlock className="h-28 flex-1 rounded-3xl" />
        <SkeletonBlock className="h-28 flex-1 rounded-3xl" />
      </View>
      <SkeletonBlock className="h-72 w-full rounded-3xl" />
    </SkeletonGroup>
  );
}
