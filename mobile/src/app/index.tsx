import { Redirect, router } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfiles, useStartSession } from '@/api/profiles';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ProfileListSkeleton } from '@/components/profile-list-skeleton';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { HeroCarousel } from '@/components/welcome/hero-carousel';
import { colors } from '@/constants/colors';
import { WELCOME_SLIDES } from '@/constants/welcome-slides';
import { useDelayedFlag } from '@/hooks/use-delayed-flag';
import { useOnboarding } from '@/store/onboarding';
import { useSession } from '@/store/session';
import type { ProfileSummary } from '@/types/profile';

/** Entry: returning users skip straight in; everyone else picks or creates a profile. */
export default function WelcomeScreen() {
  const token = useSession((s) => s.token);
  // Stored token → dashboard, which validates it with GET /me and falls back here on 401.
  if (token) return <Redirect href="/dashboard" />;
  return <ProfilePicker />;
}

function ProfilePicker() {
  const { data: profiles, isPending, isError, refetch, isRefetching } = useProfiles();
  const startSession = useStartSession();
  const startOnboarding = useOnboarding((s) => s.start);
  const showSkeleton = useDelayedFlag(isPending);

  const openProfile = (p: ProfileSummary) => {
    if (startSession.isPending) return;
    startSession.mutate(p.id, {
      onSuccess: ({ profile }) => {
        if (profile.onboarded) {
          router.replace('/dashboard');
        } else {
          startOnboarding(profile.id);
          router.push('/onboarding/about');
        }
      },
    });
  };

  return (
    // Top edge excluded: the hero runs under the status bar.
    <SafeAreaView edges={['bottom']} className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="pb-10" bounces={false}>
        <HeroCarousel slides={WELCOME_SLIDES} />

        <Animated.View entering={FadeInDown.delay(150).duration(500)} className="px-6">
          <Text className="mb-3 mt-8 font-sans-semibold text-sm uppercase tracking-wider text-muted">
            Who’s here?
          </Text>

          {showSkeleton && <ProfileListSkeleton />}

          {isError && (
            <View className="items-center rounded-2xl bg-card p-5">
              <Text className="text-center text-muted">
                Couldn’t load profiles. Is the server running?
              </Text>
              <Button
                label="Try again"
                variant="ghost"
                onPress={() => refetch()}
                loading={isRefetching}
              />
            </View>
          )}

          {startSession.isError && (
            <Text className="mb-3 text-sm text-danger" accessibilityLiveRegion="polite">
              {startSession.error.message}
            </Text>
          )}

          <View className={`gap-3 ${startSession.isPending ? 'opacity-60' : ''}`}>
            {profiles?.map((p, i) => (
              <Animated.View key={p.id} entering={FadeInDown.delay(80 * i).duration(400)}>
                <PressableScale
                  onPress={() => openProfile(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`Continue as ${p.name}`}
                  className="flex-row items-center gap-4 rounded-2xl bg-card p-4"
                >
                  <ProfileAvatar
                    name={p.name}
                    color={p.avatarColor}
                    imageUrl={p.avatarUrl}
                    imageKey={p.avatarKey}
                    club={p.club}
                  />
                  <View className="flex-1">
                    <Text className="font-sans-semibold text-lg">{p.name}</Text>
                    <Text className="text-sm text-muted">
                      {p.onboarded ? 'Continue your plan' : 'Finish setting up'}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={colors.muted} />
                </PressableScale>
              </Animated.View>
            ))}

            {!isPending && !isError && (
              <PressableScale
                onPress={() => router.push('/new-profile')}
                accessibilityRole="button"
                accessibilityLabel="Create a new profile"
                className="flex-row items-center gap-4 rounded-2xl border-2 border-dashed border-line p-4"
              >
                <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
                  <Plus size={22} color={colors.primary} />
                </View>
                <Text className="font-sans-semibold text-lg text-primary">
                  {profiles?.length ? 'New profile' : 'Create your profile'}
                </Text>
              </PressableScale>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
