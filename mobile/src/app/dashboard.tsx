import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMe, useSetShowAgent } from '@/api/profiles';
import { useToday } from '@/api/today';
import { AgentIntroSheet } from '@/components/agent/agent-intro-sheet';
import { AskNourishTag } from '@/components/agent/ask-nourish-tag';
import { BurnSection } from '@/components/burn/burn-section';
import { CalorieCard } from '@/components/dashboard/calorie-card';
import { ChallengeCard } from '@/components/dashboard/challenge-card';
import { MealSheet, type MealSheetRequest } from '@/components/dashboard/meal-sheet';
import { ConsistencyCard } from '@/components/dashboard/consistency-card';
import { ChallengesSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ChallengePickerSheet } from '@/components/dashboard/challenge-picker-sheet';
import { ProofSheet } from '@/components/dashboard/proof-sheet';
import { ProfileAvatar } from '@/components/profile-avatar';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Heading, Text } from '@/components/ui/text';
import { WhyCard } from '@/components/why-card';
import { colors } from '@/constants/colors';
import { useOnboarding } from '@/store/onboarding';
import { useSession } from '@/store/session';
import { useToast } from '@/store/toast';
import type { TodayChallenge } from '@/types/today';
import { localDate } from '@/utils/date';

/** Pause after the dashboard settles before introducing the assistant. */
const INTRO_DELAY_MS = 1500;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** [a, b, c] → [[a, b], [c]]: rows of two, so tiles in a row share one height (Cal AI-style grid). */
function pairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

export default function DashboardScreen() {
  const token = useSession((s) => s.token);
  const signOut = useSession((s) => s.signOut);
  const startOnboarding = useOnboarding((s) => s.start);
  // Also validates the stored token: a 401 signs out, `token` becomes null, and we redirect.
  const { data: profile, isPending, isError, error, refetch } = useMe();
  const date = localDate();
  const today = useToday(date);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [proofFor, setProofFor] = useState<TodayChallenge | null>(null);
  const [mealFor, setMealFor] = useState<MealSheetRequest | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const setShowAgent = useSetShowAgent();
  const toast = useToast((s) => s.show);
  const insets = useSafeAreaInsets();

  // Meet the assistant once: only after the whole day has loaded and settled, so it never
  // covers a half-drawn dashboard. null = never asked.
  const askAboutAgent = profile?.showAgent === null && today.isSuccess && !today.isFetching;
  useEffect(() => {
    if (!askAboutAgent) return;
    const timer = setTimeout(() => setIntroOpen(true), INTRO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [askAboutAgent]);

  const answerIntro = (show: boolean) =>
    setShowAgent.mutate(show, {
      onSuccess: () => {
        setIntroOpen(false);
        toast(show ? 'Nourish is on your dashboard' : 'You can add Nourish from Profile anytime');
      },
      onError: (err) => toast(err.message),
    });

  // Food challenges log through the meal flow, so one photo moves calories AND the challenge.
  const logChallenge = (c: TodayChallenge) =>
    c.logsVia === 'meal'
      ? setMealFor({ challengeId: c.id, challengeLabel: c.tracking.label ?? c.title })
      : setProofFor(c);

  const switchProfile = async () => {
    await signOut();
    router.replace('/');
  };

  const needsOnboarding = profile ? !profile.onboarded || !profile.goal : false;
  useEffect(() => {
    if (needsOnboarding && profile) startOnboarding(profile.id);
  }, [needsOnboarding, profile, startOnboarding]);

  if (!token) return <Redirect href="/" />;

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8">
        <Heading className="text-center text-2xl">Can’t load your day</Heading>
        <Text className="mt-2 text-center text-muted">{error.message}</Text>
        <Button className="mt-6 self-stretch" label="Try again" onPress={() => refetch()} />
        <Button
          className="mt-2 self-stretch"
          variant="ghost"
          label="Switch profile"
          onPress={switchProfile}
        />
      </SafeAreaView>
    );
  }

  // Picked a profile that never finished onboarding — resume it.
  if (needsOnboarding || !profile.goal) return <Redirect href="/onboarding/about" />;

  const { goal } = profile;
  const targets = today.data?.targets ?? {
    calories: goal.dailyCalories,
    proteinG: goal.proteinG,
    carbsG: goal.carbsG,
    fatG: goal.fatG,
  };
  const eaten = today.data?.eaten ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const challenges = today.data?.challenges ?? [];
  const doneCount = challenges.filter((c) => c.progress.done).length;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        contentContainerClassName="px-5 pb-10 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={today.isRefetching}
            onRefresh={() => void today.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <Animated.View
          entering={FadeInDown.duration(400)}
          className="flex-row items-center justify-between"
        >
          <View className="flex-1">
            <Text className="text-muted">{greeting()},</Text>
            <Heading>{profile.name}</Heading>
          </View>
          <Pressable
            onPress={() => router.push('/profile')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
          >
            <ProfileAvatar
              name={profile.name}
              color={profile.avatarColor}
              imageUrl={profile.avatarUrl}
              imageKey={profile.avatarKey}
              size={44}
            />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(400)} className="mt-6">
          <CalorieCard
            targets={targets}
            eaten={eaten}
            challenges={challenges}
            meals={today.data?.meals ?? []}
            date={date}
            onLogMeal={() => setMealFor({})}
          />
        </Animated.View>

        {/* Challenges */}
        <Animated.View
          entering={FadeInDown.delay(160).duration(400)}
          className="mb-3 mt-8 flex-row items-end justify-between"
        >
          <View>
            <Text className="font-sans-semibold text-sm uppercase tracking-wider text-muted">
              Today’s challenges
            </Text>
            {challenges.length > 0 && (
              <Text className="mt-0.5 text-sm">
                {doneCount} of {challenges.length} done
              </Text>
            )}
          </View>
          {challenges.length > 0 && (
            <Pressable
              onPress={() => setPickerOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Edit challenges"
              className="rounded-full bg-card px-3 py-1.5 active:opacity-70"
            >
              <Text className="font-sans-semibold text-sm">Edit</Text>
            </Pressable>
          )}
        </Animated.View>

        {today.isPending && <ChallengesSkeleton />}

        {today.isError && (
          <View className="items-center gap-3 rounded-2xl bg-card p-5">
            <Text className="text-center text-muted">{today.error.message}</Text>
            <Button variant="secondary" label="Try again" onPress={() => today.refetch()} />
          </View>
        )}

        {today.isSuccess && challenges.length === 0 && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <EmptyChallenges onPick={() => setPickerOpen(true)} />
          </Animated.View>
        )}

        {challenges.length > 0 && (
          <View className="mb-3">
            <ConsistencyCard challenges={challenges} />
          </View>
        )}

        <View className="gap-3">
          {pairs(challenges).map((row, r) => (
            <Animated.View
              key={row.map((c) => c.id).join()}
              entering={FadeInDown.delay(200 + r * 80).duration(400)}
              layout={LinearTransition.duration(300)}
              className="flex-row gap-3"
            >
              {row.map((c) => (
                <ChallengeCard key={c.id} challenge={c} onLog={logChallenge} />
              ))}
              {row.length === 1 && <View className="flex-1" />}
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(320).duration(400)} className="mt-8">
          <WhyCard why={goal.why} />
        </Animated.View>

        {today.data?.burn && (
          <View className="mt-8">
            <BurnSection
              burn={today.data.burn}
              date={date}
              kg={profile.weightKg ?? 70}
              delay={400}
            />
          </View>
        )}
      </ScrollView>

      <ChallengePickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSaved={() => today.refetch()}
      />
      <ProofSheet challenge={proofFor} date={date} onClose={() => setProofFor(null)} />
      <MealSheet request={mealFor} date={date} onClose={() => setMealFor(null)} />

      {profile.showAgent && <AskNourishTag bottom={Math.max(insets.bottom, 12) + 20} />}
      <AgentIntroSheet
        visible={introOpen}
        busy={setShowAgent.isPending}
        onAdd={() => answerIntro(true)}
        onLater={() => answerIntro(false)}
      />
    </SafeAreaView>
  );
}

/** Shown when no challenges are taken: explains the value and opens the picker. */
function EmptyChallenges({ onPick }: { onPick: () => void }) {
  return (
    <View className="items-center rounded-3xl bg-card px-6 py-8">
      <Text className="text-center font-sans-semibold text-lg">No challenges yet</Text>
      <Text className="mt-1 text-center text-sm text-muted">Pick two or three to start.</Text>
      <PressableScale
        onPress={onPick}
        accessibilityRole="button"
        accessibilityLabel="Pick challenges"
        className="mt-5 h-11 items-center justify-center rounded-full bg-ink px-6"
      >
        <Text className="font-sans-semibold text-white">Pick challenges</Text>
      </PressableScale>
    </View>
  );
}
