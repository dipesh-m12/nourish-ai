import Constants from 'expo-constants';
import { Linking, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CatFace } from '@/components/companion/cat-face';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { useUpdateGate } from '@/store/update-gate';

/**
 * Full-screen stop for builds the server has blocked (e.g. a security bug in an old version).
 * There's no way past it on purpose: every API call from this build is refused anyway.
 */
export function UpdateRequired() {
  const required = useUpdateGate((s) => s.required);
  if (!required) return null;

  return (
    <SafeAreaView className="absolute inset-0 items-center justify-center bg-bg px-8">
      <Animated.View entering={FadeInDown.duration(400)} className="items-center">
        <CatFace mood="normal" size={150} />
        <Heading className="mt-4 text-center text-3xl">Time to update</Heading>
        <Text className="mt-2 text-center leading-6 text-muted">{required.message}</Text>
      </Animated.View>
      <View className="mt-10 self-stretch">
        {required.updateUrl && (
          <Button label="Update now" onPress={() => Linking.openURL(required.updateUrl!)} />
        )}
      </View>
      <Text className="mt-6 text-xs text-muted">
        You’re on v{Constants.expoConfig?.version ?? '?'}
      </Text>
    </SafeAreaView>
  );
}
