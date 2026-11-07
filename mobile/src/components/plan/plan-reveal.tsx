import * as Haptics from 'expo-haptics';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAcceptChallenges } from '@/api/plan';
import { CalorieRing } from '@/components/calorie-ring';
import { ConfettiBurst } from '@/components/confetti-burst';
import { MacroTiles } from '@/components/macro-tiles';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { WhyCard } from '@/components/why-card';
import { colors } from '@/constants/colors';
import type { Plan } from '@/types/plan';
import { ChallengeRow } from './challenge-row';
import { JourneyCard } from './journey-card';
import { FocusHabits, SampleDay, SectionTitle } from './plan-sections';

const PAGES = ['numbers', 'plan', 'challenges'] as const;
type Page = (typeof PAGES)[number];

const NEXT_LABEL: Record<Exclude<Page, 'challenges'>, string> = {
  numbers: 'See your plan',
  plan: 'Pick your challenges',
};

interface Props {
  name: string;
  plan: Plan;
  onDone: () => void;
}

/**
 * The plan, revealed in three short steps instead of one long scroll:
 * 1. your numbers  2. your plan  3. pick challenges.
 * One idea per screen, the same pattern as onboarding, so it's familiar and easy to read.
 */
export function PlanReveal({ name, plan, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const accept = useAcceptChallenges();
  const [pageIndex, setPageIndex] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const page = PAGES[pageIndex]!;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Android back steps through the reveal before leaving it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pageIndex === 0) return false;
      setPageIndex((i) => i - 1);
      return true;
    });
    return () => sub.remove();
  }, [pageIndex]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const count = picked.size;
  const onPrimary = () => {
    if (page === 'challenges') accept.mutate([...picked], { onSuccess: onDone });
    else setPageIndex((i) => i + 1);
  };
  const primaryLabel =
    page !== 'challenges'
      ? NEXT_LABEL[page]
      : count
        ? `Start with ${count} challenge${count > 1 ? 's' : ''}`
        : 'Start without challenges';

  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-4 px-4 py-2">
        <Pressable
          onPress={() => setPageIndex((i) => i - 1)}
          disabled={pageIndex === 0}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous"
          className={`h-10 w-10 items-center justify-center rounded-full bg-card ${pageIndex === 0 ? 'opacity-0' : ''}`}
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <ProgressBar progress={(pageIndex + 1) / PAGES.length} />
        <Text className="w-10 text-right text-sm text-muted">
          {pageIndex + 1}/{PAGES.length}
        </Text>
      </View>

      {/* key = page: each step mounts fresh, scrolled to top, with its own entrance */}
      <ScrollView
        key={page}
        contentContainerClassName="px-6 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={pageIndex === 0 ? FadeIn.duration(300) : FadeInRight.duration(300)}
        >
          {page === 'numbers' && <NumbersPage name={name} plan={plan} />}
          {page === 'plan' && <PlanPage plan={plan} />}
          {page === 'challenges' && (
            <ChallengesPage plan={plan} picked={picked} onToggle={toggle} />
          )}
        </Animated.View>
      </ScrollView>

      <View
        className="border-t border-line bg-bg px-6 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        {accept.isError && (
          <Text className="mb-2 text-center text-sm text-danger">{accept.error.message}</Text>
        )}
        <Button label={primaryLabel} onPress={onPrimary} loading={accept.isPending} />
      </View>

      {/* Last child = drawn on top. Plays once, with the success haptic, then removes itself. */}
      <ConfettiBurst />
    </View>
  );
}

/** Step 1: the facts. Where you are, where you're going, and the daily numbers that get you there. */
function NumbersPage({ name, plan }: { name: string; plan: Plan }) {
  const { metrics } = plan;
  return (
    <View>
      <Text className="font-sans-semibold text-sm uppercase tracking-wider text-primary">
        Your plan is ready
      </Text>
      <Heading className="mt-1">Here’s your plan, {name}.</Heading>
      <Text className="mt-3 leading-relaxed text-muted">{plan.encouragement}</Text>

      <Animated.View entering={FadeInDown.delay(150).duration(400)} className="mt-6">
        <JourneyCard metrics={metrics} goalType={plan.goal.type} />
      </Animated.View>

      <View className="mt-6 items-center rounded-2xl bg-card py-6">
        <Text className="mb-4 font-sans-semibold text-sm uppercase tracking-wider text-muted">
          Your daily target
        </Text>
        <CalorieRing calories={metrics.dailyCalories} />
      </View>
      <View className="mt-3">
        <MacroTiles
          proteinG={metrics.proteinG}
          carbsG={metrics.carbsG}
          fatG={metrics.fatG}
          delay={900}
          showKcal
        />
      </View>
    </View>
  );
}

/** Step 2: the approach. What to focus on and why, with an example day tucked away. */
function PlanPage({ plan }: { plan: Plan }) {
  return (
    <View className="gap-8">
      <View>
        <Heading className="text-2xl">How you’ll get there</Heading>
        <Text className="mt-3 leading-relaxed">{plan.summary}</Text>
      </View>
      <WhyCard why={plan.goal.why} />
      <View>
        <SectionTitle>Focus on</SectionTitle>
        <FocusHabits habits={plan.focusHabits} />
      </View>
      <SampleDay meals={plan.sampleDay} />
    </View>
  );
}

/** Step 3: commitment. Small, measurable actions the user chooses to take on. */
function ChallengesPage({
  plan,
  picked,
  onToggle,
}: {
  plan: Plan;
  picked: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <View>
      <Heading className="text-2xl">Pick your challenges</Heading>
      <Text className="mb-5 mt-2 text-muted">
        Start with two or three. You can change these later.
      </Text>
      <View className="gap-3">
        {plan.challenges.map((c) => (
          <ChallengeRow
            key={c.id}
            challenge={c}
            selected={picked.has(c.id)}
            onToggle={() => onToggle(c.id)}
          />
        ))}
      </View>
    </View>
  );
}
