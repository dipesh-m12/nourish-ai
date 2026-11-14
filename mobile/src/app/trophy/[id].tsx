import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/api/sessions';
import { WalkSummary } from '@/components/formats/walk-summary';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';

/** A finished walk's trophy card, reopened from the activity list (or a link), to share again. */
export default function TrophyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession(id);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/dashboard'));

  if (session.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (session.isError || session.data.status !== 'finished') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8">
        <Text className="text-center text-muted">
          {session.isError ? session.error.message : 'This walk isn’t finished yet.'}
        </Text>
        <Button className="mt-6 self-stretch" label="Back" onPress={close} />
      </SafeAreaView>
    );
  }

  const { data } = session.data;
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-bg px-6">
      <WalkSummary
        result={{
          title: data.title ?? 'Walk',
          path: data.path ?? [],
          metres: data.metres ?? 0,
          movingMs: data.movingMs ?? 0,
          steps: data.steps ?? null,
          calories: data.calories ?? null,
          pauses: data.pauses ?? 0,
          awayMs: data.awayMs,
        }}
        doneLabel="Close"
        onDone={close}
      />
    </SafeAreaView>
  );
}
