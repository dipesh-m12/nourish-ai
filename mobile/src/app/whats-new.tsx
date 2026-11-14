import Constants from 'expo-constants';
import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMarkWhatsNewSeen } from '@/api/profiles';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { WHATS_NEW } from '@/constants/whats-new';

/** What changed in this version: four points, one line each, then back to the day. */
export default function WhatsNewScreen() {
  const markSeen = useMarkWhatsNewSeen();
  const reduceMotion = useReducedMotion();
  const release = WHATS_NEW[0]!;
  const version = Constants.expoConfig?.version ?? release.version;

  const done = () => {
    markSeen.mutate(version);
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard');
  };

  return (
    <SafeAreaView className="flex-1 bg-bg px-6">
      <View className="flex-1 justify-center">
        <View className="self-start rounded-full bg-primary-soft px-3 py-1">
          <Text className="font-sans-semibold text-sm text-primary-dark">v{release.version}</Text>
        </View>
        <Heading className="mt-3">What’s new</Heading>

        <View className="mt-8 gap-6">
          {release.points.map((p, i) => (
            <Animated.View
              key={p.title}
              entering={reduceMotion ? undefined : FadeInDown.delay(120 + i * 90).duration(350)}
              className="flex-row items-center gap-4"
            >
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-card">
                <p.icon size={22} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-semibold text-base">{p.title}</Text>
                <Text className="text-sm text-muted">{p.body}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>
      <Button className="mb-4" label="Let’s go" onPress={done} />
    </SafeAreaView>
  );
}
