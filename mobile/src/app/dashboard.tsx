import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMe } from '@/api/profiles';
import { CalorieRing } from '@/components/calorie-ring';
import { MacroTiles } from '@/components/macro-tiles';
import { ProfileAvatar } from '@/components/profile-avatar';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { WhyCard } from '@/components/why-card';
import { colors } from '@/constants/colors';
import { useOnboarding } from '@/store/onboarding';
import { useSession } from '@/store/session';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const token = useSession((s) => s.token);
  const signOut = useSession((s) => s.signOut);
  const startOnboarding = useOnboarding((s) => s.start);
  // Also validates the stored token: a 401 signs out, `token` becomes null, and we redirect.
  const { data: profile, isPending, isError, error, refetch } = useMe();

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

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="px-6 pb-10 pt-4">
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
            <ProfileAvatar name={profile.name} color={profile.avatarColor} size={44} />
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          className="mt-6 items-center rounded-3xl bg-card py-8"
        >
          <Text className="mb-4 font-sans-semibold text-sm uppercase tracking-wider text-muted">
            Today’s target
          </Text>
          <CalorieRing calories={goal.dailyCalories} />
        </Animated.View>

        <View className="mt-4">
          <MacroTiles proteinG={goal.proteinG} carbsG={goal.carbsG} fatG={goal.fatG} delay={200} />
        </View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mt-4">
          <WhyCard why={goal.why} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
