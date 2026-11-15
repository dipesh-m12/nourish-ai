import Constants from 'expo-constants';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Bell, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBriefing } from '@/api/briefing';
import { levelToast, useSetLevel } from '@/api/challenges';
import { useAcceptChallenges, usePlan } from '@/api/plan';
import { useMe, useSetShowAgent } from '@/api/profiles';
import { useToday } from '@/api/today';
import { AgentIntroSheet } from '@/components/agent/agent-intro-sheet';
import { AskNourishTag } from '@/components/agent/ask-nourish-tag';
import { MadeWithLove } from '@/components/dashboard/made-with-love';
import { BurnSection } from '@/components/burn/burn-section';
import { ConfettiBurst } from '@/components/confetti-burst';
import { BriefingCard } from '@/components/dashboard/briefing-card';
import { CalorieCard } from '@/components/dashboard/calorie-card';
import { ChallengeCard } from '@/components/dashboard/challenge-card';
import { MealSheet, type MealSheetRequest } from '@/components/dashboard/meal-sheet';
import { ConsistencyCard } from '@/components/dashboard/consistency-card';
import { ChallengesSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ChallengePickerSheet } from '@/components/dashboard/challenge-picker-sheet';
import { LogSheet, useQuickLog } from '@/components/dashboard/log-sheet';
import { EndedCards } from '@/components/challenges/ended-card';
import { HealthCard } from '@/components/dashboard/health-card';
import { StarterPicks } from '@/components/dashboard/starter-picks';
import { enablePush } from '@/hooks/use-device-registration';
import { syncGeofences } from '@/lib/place-task';
import { useHealthSync } from '@/hooks/use-health-sync';
import { ChallengeMenu } from '@/components/challenges/challenge-menu';
import { GoalSheet } from '@/components/challenges/goal-sheet';
import { RemindersSheet } from '@/components/challenges/reminders-sheet';
import { ProfileAvatar } from '@/components/profile-avatar';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { useOnboarding } from '@/store/onboarding';
import { useSession } from '@/store/session';
import { useToast } from '@/store/toast';
import type { BriefingAction } from '@/types/briefing';
import type { TodayChallenge } from '@/types/today';
import { formatFor } from '@/utils/challenge-format';
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
  // Steps and sleep fill themselves in from Health Connect (Android); web gets nothing.
  const health = useHealthSync(date, today.data?.challenges ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<TodayChallenge | null>(null);
  const [logFor, setLogFor] = useState<TodayChallenge | null>(null);
  const [mealFor, setMealFor] = useState<MealSheetRequest | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  // The PA's top card follows today's data: any log refreshes it.
  const briefing = useBriefing(date, today.dataUpdatedAt);
  const celebrate = useCallback(() => setCelebrating(true), []);
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

  // "What's new" once per version, after the day has loaded (not on top of the assistant ask).
  const version = Constants.expoConfig?.version;
  const showWhatsNew =
    Boolean(version) &&
    profile?.onboarded === true &&
    profile.preferences.whatsNewSeen !== version &&
    !askAboutAgent &&
    today.isSuccess &&
    !today.isFetching;
  useEffect(() => {
    if (!showWhatsNew) return;
    const timer = setTimeout(() => router.push('/whats-new'), INTRO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [showWhatsNew]);

  // Nudges are the point of a PA: ask to allow notifications once the day is on screen and
  // no intro is in the way. Android shows its prompt only the first time; later calls just
  // refresh the token.
  const askPush = profile?.onboarded === true && today.isSuccess && !askAboutAgent && !introOpen;
  useEffect(() => {
    if (!askPush) return;
    const timer = setTimeout(() => void enablePush(), INTRO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [askPush]);

  // Auto check-in watches today's pinned places (only if the user switched it on).
  const placesKey = (today.data?.challenges ?? [])
    .filter((c) => c.place)
    .map((c) => `${c.id}:${c.progress.done}`)
    .join();
  useEffect(() => {
    if (today.data) void syncGeofences(today.data.challenges);
    // Re-sync only when the pinned places or their done state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey]);

  const answerIntro = (show: boolean) =>
    setShowAgent.mutate(show, {
      onSuccess: () => {
        setIntroOpen(false);
        toast(show ? 'Nourish is on your dashboard' : 'You can add Nourish from Profile anytime');
      },
      onError: (err) => toast(err.message),
    });

  // Food challenges log through the meal flow (one photo moves calories AND the challenge);
  // done/not-done ones log in one tap; amounts ask "how much?" first.
  const quickLog = useQuickLog(date);
  const logChallenge = (c: TodayChallenge) => {
    if (c.logsVia === 'meal')
      return setMealFor({ challengeId: c.id, challengeLabel: c.tracking.label ?? c.title });
    // Showing up somewhere: the map screen (pin it once, check in when there).
    if (formatFor(c) === 'place') return router.push({ pathname: '/place', params: { id: c.id } });
    // A walk left running reopens straight on its map.
    if (c.session?.kind === 'walk') return router.push({ pathname: '/walk', params: { id: c.id } });
    if (c.tracking.kind === 'check') return quickLog(c);
    setLogFor(c);
  };

  // The PA's "Add it": starts one plan idea next to the ones already running.
  const plan = usePlan();
  const accept = useAcceptChallenges();
  const setLevel = useSetLevel();
  const addChallenge = (id: string) => {
    const running = (plan.data?.challenges ?? []).filter((c) => c.accepted).map((c) => c.id);
    accept.mutate([...running, id], {
      onSuccess: () => {
        void today.refetch();
        toast('Added to your challenges');
      },
      onError: (err) => toast(err.message),
    });
  };

  /** Briefing actions do the work: open the camera, the right log sheet, or Nourish with the ask. */
  const runBriefingAction = (a: BriefingAction) => {
    if (a.kind === 'log_meal') return setMealFor({});
    if (a.kind === 'ask')
      return router.push({ pathname: '/assistant', params: { prompt: a.prompt } });
    if (a.kind === 'add_challenge') return addChallenge(a.challengeId);
    if (a.kind === 'level_up')
      return setLevel.mutate(
        { id: a.challengeId, date, direction: 'up' },
        { onSuccess: (r) => toast(levelToast(r)), onError: (err) => toast(err.message) },
      );
    const c = today.data?.challenges.find((x) => x.id === a.challengeId);
    if (c) logChallenge(c);
  };

  // A tapped nudge lands here with what to open:
  // /dashboard?open=meal | open=goal | open=reminders | open=challenge&id=… (other screens are their own routes).
  // The sheet is derived from the link (no extra state); closing it clears the link.
  const { open, id } = useLocalSearchParams<{ open?: string; id?: string }>();
  const linked = open === 'challenge' ? today.data?.challenges.find((x) => x.id === id) : undefined;
  const linkedMeal: MealSheetRequest | null =
    open === 'meal'
      ? {}
      : linked?.logsVia === 'meal'
        ? { challengeId: linked.id, challengeLabel: linked.tracking.label ?? linked.title }
        : null;
  const linkedLog = linked && linked.logsVia !== 'meal' ? linked : null;
  const clearLink = () => {
    if (open) router.setParams({ open: undefined, id: undefined });
  };
  // A link to a challenge that has since ended: drop it quietly once the day has loaded.
  const deadLink = open === 'challenge' && !!today.data && !linked;
  useEffect(() => {
    if (deadLink) router.setParams({ open: undefined, id: undefined });
  }, [deadLink]);

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

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        contentContainerClassName="px-5 pb-28 pt-4"
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
              club={profile.club}
              size={44}
            />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(400)} className="mt-6">
          <BriefingCard
            briefing={briefing.data}
            loading={briefing.isPending}
            date={date}
            onAction={runBriefingAction}
            onCelebrate={celebrate}
            companion={today.data?.companion}
            onCompanion={() => router.push('/adopt')}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(400)} className="mt-3">
          <CalorieCard
            targets={targets}
            eaten={eaten}
            meals={today.data?.meals ?? []}
            date={date}
            onLogMeal={() => setMealFor({})}
          />
        </Animated.View>

        {/* Challenges: one title, a count, one add button. Editing lives in each card's ⋯. */}
        <Animated.View
          entering={FadeInDown.delay(160).duration(400)}
          className="mb-3 mt-8 flex-row items-center justify-between"
        >
          <Text className="font-sans-semibold text-sm uppercase tracking-wider text-muted">
            Challenges
          </Text>
          <View className="flex-row gap-3">
            {challenges.length > 0 && (
              <PressableScale
                onPress={() => setRemindersOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Reminders"
                // Same size and weight as the + beside it, a quieter fill.
                className="h-9 w-9 items-center justify-center rounded-full border border-line bg-card"
              >
                <Bell size={18} color={colors.ink} />
              </PressableScale>
            )}
            <PressableScale
              onPress={() => setGoalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Add a challenge"
              className="h-9 w-9 items-center justify-center rounded-full bg-ink"
            >
              <Plus size={18} color="#fff" />
            </PressableScale>
          </View>
        </Animated.View>

        {today.isPending && <ChallengesSkeleton />}

        {today.isError && (
          <View className="items-center gap-3 rounded-2xl bg-card p-5">
            <Text className="text-center text-muted">{today.error.message}</Text>
            <Button variant="secondary" label="Try again" onPress={() => today.refetch()} />
          </View>
        )}

        {today.isSuccess && challenges.length === 0 && (
          <StarterPicks onOther={() => setGoalOpen(true)} />
        )}

        {health.hasAuto && health.status === 'needs_permission' && (
          <HealthCard onAllow={() => void health.ask()} />
        )}

        {today.data && <EndedCards date={date} ended={today.data.ended ?? []} />}

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
                <ChallengeCard key={c.id} challenge={c} onLog={logChallenge} onEdit={setMenuFor} />
              ))}
              {row.length === 1 && <View className="flex-1" />}
            </Animated.View>
          ))}
        </View>

        {today.data?.burn && (
          <View className="mt-8">
            <BurnSection burn={today.data.burn} date={date} delay={400} />
          </View>
        )}

        {/* Bleeds through the column's px-5 (20) and pb-10 (40) so the fade hits the screen edges. */}
        <View className="mt-32">
          <MadeWithLove bleed={{ x: 20, bottom: 112 }} />
        </View>
      </ScrollView>

      <GoalSheet
        visible={goalOpen || open === 'goal'}
        date={date}
        onClose={() => {
          setGoalOpen(false);
          clearLink();
        }}
        onManage={() => {
          setGoalOpen(false);
          clearLink();
          setPickerOpen(true);
        }}
      />
      <RemindersSheet
        visible={remindersOpen || open === 'reminders'}
        date={date}
        onClose={() => {
          setRemindersOpen(false);
          clearLink();
        }}
      />
      <ChallengeMenu
        challenge={menuFor && (challenges.find((c) => c.id === menuFor.id) ?? null)}
        date={date}
        onClose={() => setMenuFor(null)}
      />
      <ChallengePickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSaved={() => today.refetch()}
      />
      <LogSheet
        key={(logFor ?? linkedLog)?.id ?? 'none'}
        challenge={logFor ?? linkedLog}
        date={date}
        onClose={() => {
          setLogFor(null);
          clearLink();
        }}
      />
      <MealSheet
        request={mealFor ?? linkedMeal}
        date={date}
        onClose={() => {
          setMealFor(null);
          clearLink();
        }}
      />

      {celebrating && <ConfettiBurst onFinish={() => setCelebrating(false)} />}
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
